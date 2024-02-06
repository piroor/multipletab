/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs,
  shouldIncludeHidden,
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
    this.activeTabId           = null;
    this.lastActiveTabId       = null;

    this.onHighlighted = this.onHighlighted.bind(this);
    browser.tabs.onHighlighted.addListener(this.onHighlighted);
    this.onActivated = this.onActivated.bind(this);
    browser.tabs.onActivated.addListener(this.onActivated);

    this.onSelectionChange = new EventListenerManager();
    this.onCloseSelectionChange = new EventListenerManager();
    this.onDragSelectionEnd = new EventListenerManager();
  }

  destroy() {
    this.clear();
    browser.tabs.onHighlighted.removeListener(this.onHighlighted);
    browser.tabs.onActivated.removeListener(this.onActivated);
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
    this.activeTabId           = null;
    this.lastActiveTabId       = null;
  }

  async clear(options = {}) {
    const tabs = options.force ? (await Selection.getAllTabs(this.windowId)) : this.selectedTabs;
    if (tabs.length > 0) {
      await Promise.all([
        (options.force ? Selection.clearTabStateFromTST : Selection.notifyTabStateToTST)(
          options.force ? this.windowId : tabs.map(tab => tab.id),
          [Constants.kSELECTED, Constants.kREADY_TO_SELECT, Constants.kREADY_TO_CLOSE],
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

  retrieveTargetTabs(serializedTab, { includeHidden, force } = {}) {
    const tabs = [];
    if (shouldIncludeHidden(includeHidden) ||
        !serializedTab.hidden) {
      tabs.push(serializedTab);
      if (serializedTab.children &&
          (force || serializedTab.states.indexOf('subtree-collapsed') > -1)) {
        for (const tab of serializedTab.children) {
          tabs.push(...this.retrieveTargetTabs(tab, { includeHidden, force: true }))
        }
      }
    }
    return tabs;
  }

  // boundaries of beggining and end can be multiple tabs - for example, collapsed tree of Tree Style Tab.
  getTabsBetween(beginningTabs, endTabs, allTabs = [], { includeHidden } = {}) {
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
    let startIndex, endIndex;
    if (beginningTabs[0].index < endTabs[0].index) { // top to bottom
      const lastBeginningTab = beginningTabs[beginningTabs.length - 1];
      for (let i = 0, maxi = allTabs.length; i < maxi; i++) {
        const tab = allTabs[i];
        if (tab.id == lastBeginningTab.id)
          startIndex = i + 1;
        if (tab.id == endTabs[0].id)
          endIndex = i;
        if (startIndex !== undefined &&
            endIndex !== undefined)
          break;
      }
      log(' => top to bottom ', { startIndex, endIndex });
    }
    else {
      const lastEndTab = endTabs[endTabs.length - 1];
      for (let i = 0, maxi = allTabs.length; i < maxi; i++) {
        const tab = allTabs[i];
        if (tab.id == lastEndTab.id)
          startIndex = i + 1;
        if (tab.id == beginningTabs[0].id)
          endIndex = i;
        if (startIndex !== undefined &&
            endIndex !== undefined)
          break;
      }
      log(' => bottom to top ', { startIndex, endIndex });
    }
    const tabs = allTabs.slice(startIndex, endIndex);
    return shouldIncludeHidden(includeHidden) ?
      tabs :
      tabs.filter(tab => !tab.hidden);
  }

  // target can be multiple tabs - for example, collapsed tree of Tree Style Tab.
  toggleStateOfDragOverTabs(targetTabs, { includeHidden } = {}) {
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

      const betweenTabs = this.getTabsBetween(
        this.firstHoverTargets,
        targetTabs,
        this.allTabsOnDragReady,
        { includeHidden }
      );
      log('  betweenTabs ', betweenTabs);
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
    if (this.willCloseSelectedTabs)
      return;
    await Selection.select(this.selectedTabs);
    Selection.clearTabStateFromTST(this.windowId, Constants.kREADY_TO_SELECT);
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

  async onMouseDown(message, { includeHidden } = {}) {
    log('onMouseDown ', message);
    if (message.button != 0)
      return Constants.kCLICK_ACTION_NONE;

    const tab      = message.tab;
    const windowId = message.window || message.windowId || tab.windowId;

    let selected = tab.active;
    if (!selected) {
      if ('highlighted' in tab)
        selected = tab.highlighted;
      else
        selected = this.has(tab);
    }

    const ctrlKeyPressed = /^Mac/i.test(navigator.platform) ? message.metaKey : message.ctrlKey;
    if (!ctrlKeyPressed && !message.shiftKey) {
      log('regular click');
      const window = await browser.windows.get(windowId, { populate: true });
      if (window.tabs.filter(tab => tab.highlighted).length <= 1 ||
          !tab.highlighted) {
        if (!message.closebox)
          await this.clear();
        this.inSelectionSession = false;
      }
      this.lastClickedTab = tab;
      return Constants.kCLICK_ACTION_REGULAR_CLICK;
    }

    const lastActiveTab = message.lastActiveTab || await (
      (this.activeTabId && this.activeTabId != tab.id) ?
        browser.tabs.get(this.activeTabId) :
        this.lastActiveTabId ?
          browser.tabs.get(this.lastActiveTabId) :
          browser.tabs.query({
            active:   true,
            windowId: this.windowId
          }).then(tabs => tabs[0]));

    let tabs = this.retrieveTargetTabs(tab, { includeHidden });
    if (message.shiftKey) {
      const window = await browser.windows.get(windowId, { populate: true });
      const betweenTabs = this.getTabsBetween(
        this.lastClickedTab || lastActiveTab,
        tab,
        window.tabs,
        { includeHidden }
      );
      log('select the clicked tab and tabs between last activated tab ', {
        lastClickedTab: this.lastClickedTab,
        lastActiveTab,
        betweenTabs
      });
      tabs.push(...betweenTabs, this.lastClickedTab || lastActiveTab);
      if (!shouldIncludeHidden(includeHidden))
        tabs = tabs.filter(tab => !tab.hidden);
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
      if (tab.id == lastActiveTab.id) {
        if (this.inSelectionSession) {
          const descendants = tabs.slice(1);
          if (descendants.length > 0) {
            this.add(lastActiveTab);
            const partiallySelected = descendants.filter(tab => tab.highlighted).length != descendants.length;
            selected = partiallySelected ? false : descendants[0].highlighted;
            tabs = tabs.filter(tab => (
              tab.id != lastActiveTab.id &&
              (shouldIncludeHidden(includeHidden) ||
               !tab.hidden)
            ));
          }
        }
        else {
          this.add(lastActiveTab);
          await this.setSelectedStateToCollapsedDescendants(lastActiveTab, true, { includeHidden });
          tabs = [];
        }
      }
      else if (!this.inSelectionSession) {
        this.add(lastActiveTab);
        await this.setSelectedStateToCollapsedDescendants(lastActiveTab, true, { includeHidden });
      }
      for (const tab of tabs) {
        log(' toggle ', { tab, toBeSelected: !selected });
        if (selected)
          this.delete(tab);
        else
          this.add(tab);
      }
      this.inSelectionSession = true;
      this.lastClickedTab = tab;
      this.syncToHighlighted();
      return Constants.kCLICK_ACTION_PARTIAL_SELECT;
    }
    return Constants.kCLICK_ACTION_NONE;
  }
  async setSelectedStateToCollapsedDescendants(tab, selected, { includeHidden } = {}) {
    const tree = await browser.runtime.sendMessage(Constants.kTST_ID, {
      type: configs.getTreeType,
      tab:  tab.id
    }).catch(handleMissingReceiverError);
    if (!tree || !tree.states.includes('subtree-collapsed'))
      return;
    const treeTabs = this.collectTabsRecursively(tree, { includeHidden });
    for (const tab of treeTabs) {
      if (selected)
        this.add(tab);
      else
        this.delete(tab);
    }
  }
  collectTabsRecursively(tab, { includeHidden } = {}) {
    const tabs = [];
    if (shouldIncludeHidden(includeHidden) ||
        !tab.hidden) {
      tabs.push(tab);
      if (tab.children) {
        for (const child of tab.children) {
          tabs.push(...this.collectTabsRecursively(child, { includeHidden }));
        }
      }
    }
    return tabs;
  }

  async onMouseUp(message, { includeHidden } = {}) {
    log('onMouseUp ', message);
    if (message.button != 0)
      return false;

    const tab = message.nearestVisibleAncestor || message.tab;

    // mouseup after long-press on the same target doesn't notify "dragend", so simulate dragexit.
    if (this.dragStartTarget &&
        this.dragStartTarget.id == tab.id)
      this.onDragEnd(message, { includeHidden });

    const ctrlKeyPressed = message.ctrlKey || (message.metaKey && /^Mac/i.test(navigator.platform));
    if (!ctrlKeyPressed &&
        !message.shiftKey &&
        ((!this.dragStartTarget &&
          tab &&
          tab.highlighted) ||
         // dragend on the dragstart tab itself
         (tab &&
          this.dragStartTarget &&
          tab.id == this.dragStartTarget.id &&
          this.selectedTabs.length == 1))) {
      this.clear();
    }
  }

  async onNonTabAreaClick(message, _options = {}) {
    if (message.button != 0)
      return;
    this.clear();
  }


  /* select tabs by dragging */

  async onDragReady(message, options = {}) {
    return this.lastDragReady = this.onDragReadyInternal(message, options);
  }
  async onDragReadyInternal(message, { includeHidden } = {}) {
    log('onDragReady', message);
    const allTabs = await Selection.getAllTabs(this.windowId, { includeHidden });
    if (message.tab.highlighted &&
        allTabs.filter(tab => tab.highlighted).length > 1)
      return false;

    await this.clear({ highlighted: false });
    this.dragEnteredCount = 1;
    this.willCloseSelectedTabs = message.startOnClosebox;
    this.state = this.willCloseSelectedTabs ? Constants.kREADY_TO_CLOSE : Constants.kREADY_TO_SELECT ;
    this.pendingTabs = null;
    this.dragStartTarget = message.tab;
    this.allTabsOnDragReady = allTabs;

    this.add(message.tab);
    this.undeterminedRange.set(message.tab.id, message.tab);
    this.firstHoverTargets.set(message.tab.id, message.tab);
    this.lastHoverTargets.set(message.tab.id, message.tab);

    const startTabs = this.retrieveTargetTabs(message.tab, { includeHidden });
    for (const tab of startTabs) {
      this.add(tab);
      this.undeterminedRange.set(tab.id, tab);
      this.firstHoverTargets.set(tab.id, tab);
      this.lastHoverTargets.set(tab.id, tab);
    }
    Selection.notifyTabStateToTST(startTabs.map(tab => tab.id), this.state, true);
    return true;
  }

  async onDragCancel(message, _options = {}) {
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

  async onDragStart(_message, _options = {}) {
    //console.log('onDragStart', message);
  }

  async onDragEnter(message, { includeHidden } = {}) {
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
    const targetTabs = this.retrieveTargetTabs(message.tab, { includeHidden });
    this.toggleStateOfDragOverTabs(targetTabs, { includeHidden });
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

  async onDragExit(_message, _options = {}) {
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

  async onDragEnd(message, _options = {}) {
    log('onDragEnd', { message, selection: this.selection, willCloseSelectedTabs: this.willCloseSelectedTabs });
    await this.lastDragReady;
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
    const allTabs = await browser.tabs.query({
      windowId: this.windowId
    });
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


  onActivated(activeInfo) {
    if (activeInfo.windowId != this.windowId)
      return;
    this.activeTabId     = activeInfo.tabId;
    this.lastActiveTabId = activeInfo.previousTabId;
  }
};
