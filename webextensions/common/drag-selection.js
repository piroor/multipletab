/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  handleMissingReceiverError
} from './common.js';
import * as Constants from './constants.js';
import * as Selection from './selection.js';
import EventListenerManager from '/extlib/EventListenerManager.js';

export default class DragSelection {
  constructor(windowId) {
    this.windowId              = windowId;
    this.selection             = new Map();
    this.willCloseSelectedTabs = false;
    this.allTabsOnDragReady    = [];
    this.pendingTabs           = null;
    this.dragStartTarget       = null;
    this.lastHoverTargets      = new Map();
    this.firstHoverTargets     = new Map();
    this.lastClickedTab        = null;
    this.undeterminedRange     = new Map();
    this.dragEnteredCount      = 0;
    this.inSelectionSession    = false;

    this.onHighlighted = this.onHighlighted.bind(this);
    browser.tabs.onHighlighted.addListener(this.onHighlighted);

    this.onSelectionChange = new EventListenerManager();
    this.onCloseSelectionChange = new EventListenerManager();
    this.onDragSelectionEnd = new EventListenerManager();
  }

  destroy() {
    this.clear();
    browser.tabs.onHighlighted.removeListener(this.onHighlighted);
  }

  cancel() {
    this.dragStartTarget = null;
    this.firstHoverTargets.clear();
    this.lastHoverTargets.clear();
    this.undeterminedRange.clear();
    this.lastClickedTab = null;
    this.willCloseSelectedTabs = false;
    this.dragEnteredCount = 0;
    this.allTabsOnDragReady = [];
    this.inSelectionSession = false;
    this.state = null;
  }

  async clear(options = {}) {
    const tabs = options.force ? (await Selection.getAllTabs(this.windowId)) : this.selectedTabs;
    if (tabs.length > 0) {
      await Promise.all([
        (options.force ? Selection.clearTabStateFromTST : Selection.notifyTabStateToTST)(
          options.force ? this.windowId : tabs.map(tab => tab.id),
          [Constants.kSELECTED, Constants.kREADY_TO_CLOSE],
          false
        ),
        this[this.willCloseSelectedTabs ? 'onCloseSelectionChange' : 'onSelectionChange'].dispatch({
          unselected:    tabs,
          selected:      [],
          dragSelection: this,
          clear:         true,
          bySelf:        true
        })
      ]);
    }
    this.cancel();
    if (tabs.length > 1 || options.force)
      await Selection.clear({
        windowId:    this.windowId,
        force:       true,
        highlighted: options.highlighted
      });
    this.selection.clear();
  }


  has(tab) {
    return this.selection.has(tab.id);
  }

  add(tab) {
    this.selection.set(tab.id, tab);
    this[this.willCloseSelectedTabs ? 'onCloseSelectionChange' : 'onSelectionChange'].dispatch({
      unselected:    [],
      selected:      [tab],
      dragSelection: this,
      bySelf:        true
    });
  }

  delete(tab) {
    this.selection.delete(tab.id);
    this[this.willCloseSelectedTabs ? 'onCloseSelectionChange' : 'onSelectionChange'].dispatch({
      unselected:    [tab],
      selected:      [],
      dragSelection: this,
      bySelf:        true
    });
  }

  get selectedTabs() {
    return Array.from(this.selection.values());
  }

  get selectedTabIds() {
    return Array.from(this.selection.keys());
  }


  /* utilities */

  retrieveTargetTabs(serializedTab, force = false) {
    let tabs = [serializedTab];
    if (serializedTab.children &&
        (force || serializedTab.states.indexOf('subtree-collapsed') > -1)) {
      for (const tab of serializedTab.children) {
        tabs = tabs.concat(this.retrieveTargetTabs(tab, true))
      }
    }
    return tabs;
  }

  // boundaries of beggining and end can be multiple tabs - for example, collapsed tree of Tree Style Tab.
  getTabsBetween(beginningTabs, endTabs, allTabs = []) {
    if (beginningTabs.constructor != Map) {
      const beginningTabsMap = new Map();
      beginningTabsMap.set(beginningTabs.id, beginningTabs);
      beginningTabs = beginningTabsMap;
    }
    if (endTabs.constructor != Map) {
      const endTabsMap = new Map();
      endTabsMap.set(endTabs.id, endTabs);
      endTabs = endTabsMap;
    }
    if (Array.from(endTabs.keys()).sort().join(',') == Array.from(beginningTabs.keys()).sort().join(','))
      return [];
    beginningTabs = Array.from(beginningTabs.values());
    endTabs = Array.from(endTabs.values());
    if (beginningTabs[0].index < endTabs[0].index) { // top to bottom
      return allTabs.slice(beginningTabs[beginningTabs.length - 1].index + 1, endTabs[0].index);
    }
    else { // bottom to top
      return allTabs.slice(endTabs[endTabs.length - 1].index + 1, beginningTabs[0].index);
    }
  }

  // target can be multiple tabs - for example, collapsed tree of Tree Style Tab.
  toggleStateOfDragOverTabs(targetTabs) {
    if (Array.isArray(targetTabs))
      targetTabs = new Map(targetTabs.map(tab => [tab.id, tab]));

    log('toggleStateOfDragOverTabs ', targetTabs);

    const toBeSelected = new Set();
    const toBeUnselected = new Set();
    if (this.firstHoverTargets.size > 0) {
      log('  firstHoverTargets ', this.firstHoverTargets);
      const oldUndeterminedRange = this.undeterminedRange;
      this.undeterminedRange = new Map();
      log('  oldUndeterminedRange ', oldUndeterminedRange);

      const betweenTabs = this.getTabsBetween(this.firstHoverTargets, targetTabs, this.allTabsOnDragReady);
      const newUndeterminedRange = new Map([
        ...this.firstHoverTargets.entries(),
        ...betweenTabs.map(tab => [tab.id, tab]),
        ...targetTabs.entries()
      ]);
      log('  newUndeterminedRange ', newUndeterminedRange);

      for (const id of oldUndeterminedRange.keys()) {
        if (newUndeterminedRange.has(id))
          continue;
        const tab = oldUndeterminedRange.get(id);
        if (this.has(tab)) {
          this.delete(tab);
          toBeUnselected.add(id);
        }
        else {
          this.add(tab);
          toBeSelected.add(id);
        }
      }

      for (const tab of newUndeterminedRange.values()) {
        if (this.undeterminedRange.has(tab.id))
          continue;
        this.undeterminedRange.set(tab.id, tab);
        if (oldUndeterminedRange.has(tab.id))
          continue;
        if (this.has(tab)) {
          this.delete(tab);
          toBeUnselected.add(tab.id);
          toBeSelected.delete(tab.id);
        }
        else {
          this.add(tab);
          toBeSelected.add(tab.id);
          toBeUnselected.delete(tab.id);
        }
      }
    }
    else {
      for (const tab of targetTabs.values()) {
        if (this.undeterminedRange.has(tab.id))
          this.undeterminedRange.delete(tab.id);
        else
          this.undeterminedRange.set(tab.id, tab);
        if (this.has(tab)) {
          this.delete(tab);
          toBeUnselected.add(tab.id);
        }
        else {
          this.add(tab);
          toBeSelected.add(tab.id);
        }
      }
    }
    Selection.notifyTabStateToTST(Array.from(toBeSelected), this.state, true);
    Selection.notifyTabStateToTST(Array.from(toBeUnselected), this.state, false);
  }

  async syncToHighlighted() {
    if (!this.willCloseSelectedTabs)
      await Selection.select(this.selectedTabs);
  }

  async syncFromHighlighted() {
    this.cancel();
    this.selection.clear();
    const selectedTabs = await Selection.getSelection(this.windowId);
    if (selectedTabs.length > 1) {
      for (const tab of selectedTabs) {
        this.add(tab);
      }
    }
  }


  /* event handling */

  async onMouseDown(message) {
    log('onMouseDown ', message);
    if (message.button != 0)
      return Constants.kCLICK_ACTION_NONE;

    const windowId = message.window || message.windowId || message.tab.windowId;

    let selected = message.tab.active;
    if (!selected) {
      if (message.tab.states)
        selected = message.tab.states.includes(Constants.kSELECTED);
      else
        selected = this.has(message.tab);
    }

    const ctrlKeyPressed = /^Mac/i.test(navigator.platform) ? message.metaKey : message.ctrlKey;
    if (!ctrlKeyPressed && !message.shiftKey) {
      log('regular click');
      const window = await browser.windows.get(windowId, { populate: true });
      if (window.tabs.filter(tab => tab.highlighted).length <= 1 ||
          !message.tab.highlighted) {
        await this.clear();
        this.inSelectionSession = false;
        this.lastClickedTab = null;
      }
      return Constants.kCLICK_ACTION_REGULAR_CLICK;
    }

    const lastActiveTab = message.lastActiveTab || (await browser.tabs.query({
      active:   true,
      windowId: this.windowId
    }))[0];

    let tabs = this.retrieveTargetTabs(message.tab);
    if (message.shiftKey) {
      log('select the clicked tab and tabs between last activated tab');
      const window = await browser.windows.get(windowId, { populate: true });
      const betweenTabs = this.getTabsBetween(this.lastClickedTab || lastActiveTab, message.tab, window.tabs);
      tabs = tabs.concat(betweenTabs);
      tabs.push(this.lastClickedTab || lastActiveTab);
      const selectedTabIds = tabs.map(tab => tab.id);
      if (!ctrlKeyPressed) {
        for (const tab of this.selectedTabs.filter(tab => !selectedTabIds.includes(tab.id))) {
          this.delete(tab);
        }
      }
      for (const tab of tabs) {
        this.add(tab);
      }
      this.inSelectionSession = true;
      this.syncToHighlighted();
      return Constants.kCLICK_ACTION_RANGE_SELECT;
    }
    else if (ctrlKeyPressed) {
      log('toggle selection of the tab and all collapsed descendants, inSelectionSession = ', this.inSelectionSession);
      if (message.tab.id == lastActiveTab.id) {
        if (this.inSelectionSession) {
          const descendants = tabs.slice(1);
          if (descendants.length > 0) {
            this.add(lastActiveTab);
            const partiallySelected = descendants.filter(tab => tab.states.includes(Constants.kSELECTED)).length != descendants.length;
            selected = partiallySelected ? false : descendants[0].states.includes(Constants.kSELECTED);
            tabs = tabs.filter(tab => tab.id != lastActiveTab.id);
          }
        }
        else {
          this.add(lastActiveTab);
          await this.setSelectedStateToCollapsedDescendants(lastActiveTab, true);
          tabs = [];
        }
      }
      else if (!this.inSelectionSession) {
        this.add(lastActiveTab);
        await this.setSelectedStateToCollapsedDescendants(lastActiveTab, true);
      }
      for (const tab of tabs) {
        log(' toggle ', { tab, toBeSelected: !selected });
        if (selected)
          this.delete(tab);
        else
          this.add(tab);
      }
      this.inSelectionSession = true;
      this.lastClickedTab = message.tab;
      this.syncToHighlighted();
      return Constants.kCLICK_ACTION_PARTIAL_SELECT;
    }
    return Constants.kCLICK_ACTION_NONE;
  }
  async setSelectedStateToCollapsedDescendants(tab, selected) {
    const tree = await browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_GET_TREE,
      tab:  tab.id
    }).catch(handleMissingReceiverError);
    if (!tree || !tree.states.includes('subtree-collapsed'))
      return;
    const treeTabs = this.collectTabsRecursively(tree);
    for (const tab of treeTabs) {
      if (selected)
        this.add(tab);
      else
        this.delete(tab);
    }
  }
  collectTabsRecursively(tab) {
    let tabs = [tab];
    if (tab.children) {
      for (const child of tab.children) {
        tabs = tabs.concat(this.collectTabsRecursively(child));
      }
    }
    return tabs;
  }

  async onMouseUp(message) {
    log('onMouseUp ', message);
    if (message.button != 0)
      return false;

    // mouseup after long-press on the same target doesn't notify "dragend", so simulate dragexit.
    if (this.dragStartTarget &&
        this.dragStartTarget.id == message.tab.id)
      this.onDragEnd(message);

    const ctrlKeyPressed = message.ctrlKey || (message.metaKey && /^Mac/i.test(navigator.platform));
    if (!ctrlKeyPressed &&
        !message.shiftKey &&
        (!this.dragStartTarget ||
         // dragend on the dragstart tab itself
         (message.tab &&
          message.tab.id == this.dragStartTarget.id &&
          this.selectedTabs.length == 1))) {
      this.clear();
    }
  }

  async onNonTabAreaClick(message) {
    if (message.button != 0)
      return;
    this.clear();
  }


  /* select tabs by dragging */

  async onDragReady(message) {
    return this.lastDragReady = this.onDragReadyInternal(message);
  }
  async onDragReadyInternal(message) {
    log('onDragReady', message);
    const allTabs = await Selection.getAllTabs(this.windowId);
    if (message.tab.highlighted &&
        allTabs.filter(tab => tab.highlighted).length > 1)
      return false;

    await this.clear({ highlighted: false });
    this.dragEnteredCount = 1;
    this.willCloseSelectedTabs = message.startOnClosebox;
    this.state = this.willCloseSelectedTabs ? Constants.kREADY_TO_CLOSE : Constants.kSELECTED ;
    this.pendingTabs = null;
    this.dragStartTarget = message.tab;
    this.allTabsOnDragReady = allTabs;

    this.add(message.tab);
    this.undeterminedRange.set(message.tab.id, message.tab);
    this.firstHoverTargets.set(message.tab.id, message.tab);
    this.lastHoverTargets.set(message.tab.id, message.tab);

    const startTabs = this.retrieveTargetTabs(message.tab);
    for (const tab of startTabs) {
      this.add(tab);
      this.undeterminedRange.set(tab.id, tab);
      this.firstHoverTargets.set(tab.id, tab);
      this.lastHoverTargets.set(tab.id, tab);
    }
    Selection.notifyTabStateToTST(startTabs.map(tab => tab.id), this.state, true);
    return true;
  }

  async onDragCancel(message) {
    //console.log('onDragCancel', message);
    if (this.selection.size > 1) {
      this.onDragSelectionEnd.dispatch(message, {
        dragStartTab: this.dragStartTarget,
        selection:    this.selectedTabs,
        bySelf:       !!this.dragStartTarget
      });
      // don't clear selection state until menu command is processed.
      this.cancel();
    }
    else {
      this.clear();
    }
  }

  async onDragStart(_message) {
    //console.log('onDragStart', message);
  }

  async onDragEnter(message) {
    await this.lastDragReady;
    //console.log('onDragEnter', message, { tab: message.tab, lastHover: this.lastHoverTargets });
    this.dragEnteredCount++;
    // processAutoScroll(event);

    if (this.lastHoverTargets.has(message.tab.id))
      return;

    if (this.pendingTabs) {
      for (const tab of this.pendingTabs) {
        this.add(tab);
        Selection.notifyTabStateToTST(tab.id, this.state, true);
      }
      this.pendingTabs = null;
    }
    /*
    if (this.willCloseSelectedTabs || tabDragMode == TAB_DRAG_MODE_SELECT) {
    */
    const targetTabs = this.retrieveTargetTabs(message.tab);
    this.toggleStateOfDragOverTabs(targetTabs);
    if (this.dragStartTarget &&
        message.tab.id == this.dragStartTarget.id &&
        this.selection.size == targetTabs.length) {
      for (const tab of targetTabs) {
        this.delete(tab);
        Selection.notifyTabStateToTST(tab.id, this.state, false);
      }
      this.syncToHighlighted();
      for (const tab of targetTabs) {
        this.undeterminedRange.set(tab.id, tab);
      }
      this.pendingTabs = targetTabs;
    }
    /*
    }
    else { // TAB_DRAG_MODE_SWITCH:
      browser.tabs.update(message.tab.id, { active: true });
    }
    */
    this.lastHoverTargets.clear({ highlighted: false });
    this.lastHoverTargets.set(message.tab.id, message.tab);
    if (this.firstHoverTargets.size == 0)
      this.firstHoverTargets = new Map(this.lastHoverTargets.entries());
  }

  async onDragExit(_message) {
    await this.lastDragReady;
    this.dragEnteredCount--;
    this.reserveDragExitAllWithDelay();
  }
  dragExitAllWithDelay() {
    //console.log('dragExitAllWithDelay '+this.dragEnteredCount);
    this.cancelDragExitAllWithDelay();
    if (this.dragEnteredCount <= 0) {
      this.firstHoverTargets.clear();
      this.lastHoverTargets.clear();
      this.dragEnteredCount = 0;
      this.undeterminedRange.clear();
    }
  }
  reserveDragExitAllWithDelay() {
    this.cancelDragExitAllWithDelay();
    this.dragExitAllWithDelayTimeout = setTimeout(() => {
      this.dragExitAllWithDelay();
    }, 10);
  }
  cancelDragExitAllWithDelay() {
    if (this.dragExitAllWithDelayTimeout) {
      clearTimeout(this.dragExitAllWithDelayTimeout);
      delete this.dragExitAllWithDelayTimeout;
    }
  }

  async onDragEnd(message) {
    await this.lastDragReady;
    log('onDragEnd', message, this.selection);
    if (this.selection.size > 1)
      this.syncToHighlighted();
    if (this.willCloseSelectedTabs) {
      const allTabs = this.allTabsOnDragReady.slice(0);
      allTabs.reverse();
      const toBeClosedIds = this.selectedTabIds;
      for (const tab of allTabs) {
        if (tab && toBeClosedIds.indexOf(tab.id) > -1)
          await browser.tabs.remove(tab.id);
      }
      this.clear();
    }
    else if (this.selection.size > 1) {
      await this.onDragSelectionEnd.dispatch(message, {
        dragStartTab: this.dragStartTarget,
        selection:    this.selectedTabs,
        bySelf:       !!this.dragStartTarget
      });
      // don't clear selection state until menu command is processed.
      this.cancel();
    }
    else {
      this.clear();
    }
    delete this.lastDragReady;
  }


  async onHighlighted(highlightInfo) {
    if (highlightInfo.windowId != this.windowId)
      return;
    const selectedIds = this.selectedTabIds;
    if (selectedIds.length == 0)
      return;
    const allTabs = await browser.tabs.query({ windowId: this.windowId });
    if (selectedIds.sort().join(',') == highlightInfo.tabIds.sort().join(','))
      return;
    log('DragSelection.onHighlighted: ', {
      selectedIds: selectedIds.join(','),
      highlighted: highlightInfo.tabIds.join(','),
      dragStartTarget: this.dragStartTarget
    });
    this.onSelectionChange.dispatch({
      unselected:    allTabs.filter(tab => selectedIds.includes(tab.id) && !highlightInfo.tabIds.includes(tab.id)),
      selected:      allTabs.filter(tab => !selectedIds.includes(tab.id) && highlightInfo.tabIds.includes(tab.id)),
      dragSelection: this,
      bySelf:        !!this.dragStartTarget
    });
  }
};
