/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  configs,
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
    this.lastHoverTarget       = null;
    this.firstHoverTarget      = null;
    this.lastClickedTab        = null;
    this.undeterminedRange     = new Map();
    this.dragEnteredCount      = 0;
    this.inSelectionSession    = false;

    this.onSelectionChange = new EventListenerManager();
    this.onCloseSelectionChange = new EventListenerManager();
    this.onDragSelectionEnd = new EventListenerManager();
  }

  cancel() {
    this.dragStartTarget = this.firstHoverTarget = this.lastHoverTarget = null;
    this.undeterminedRange.clear();
    this.lastClickedTab = null;
    this.willCloseSelectedTabs = false;
    this.dragEnteredCount = 0;
    this.allTabsOnDragReady = [];
    this.inSelectionSession = false;
    this.state = null;
  }

  clear() {
    if (this.selection.size > 0) {
      Selection.notifyTabStateToTST(
        this.selectedTabIds,
        [Constants.kSELECTED, Constants.kREADY_TO_CLOSE],
        false
      );
      if (this.willCloseSelectedTabs)
        this.onCloseSelectionChange.dispatch(this.selectedTabs, false);
      else
        this.onSelectionChange.dispatch(this.selectedTabs, false);
    }
    this.cancel();
    if (this.selection.size > 1)
      Selection.clear(this.windowId);
    this.selection.clear();
  }


  has(tab) {
    return this.selection.has(tab.id);
  }

  add(tab) {
    this.selection.set(tab.id, tab);
    if (this.willCloseSelectedTabs)
      this.onCloseSelectionChange.dispatch([tab], true);
    else
      this.onSelectionChange.dispatch([tab], true);
  }

  delete(tab) {
    this.selection.delete(tab.id);
    if (this.willCloseSelectedTabs)
      this.onCloseSelectionChange.dispatch([tab], false);
    else
      this.onSelectionChange.dispatch([tab], false);
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

  getTabsBetween(aBegin, end, allTabs = []) {
    if (aBegin.id == end.id)
      return [];
    let inRange = false;
    return allTabs.filter(tab => {
      if (tab.id == aBegin.id || tab.id == end.id) {
        inRange = !inRange;
        return false;
      }
      return inRange;
    });
  }

  toggleStateOfDragOverTabs(params = {}) {
    log('toggleStateOfDragOverTabs ', params);
    const toBeSelected = new Set();
    const toBeUnselected = new Set();
    if (this.firstHoverTarget) {
      log('  firstHoverTarget ', this.firstHoverTarget);
      const oldUndeterminedRange = this.undeterminedRange;
      this.undeterminedRange = new Map();
      log('  oldUndeterminedRange ', oldUndeterminedRange);

      let newUndeterminedRange = params.allTargets;
      if (newUndeterminedRange.every(tab => tab.id != this.firstHoverTarget.id))
        newUndeterminedRange.push(this.firstHoverTarget);

      const betweenTabs = this.getTabsBetween(this.firstHoverTarget, params.target, this.allTabsOnDragReady);
      newUndeterminedRange = newUndeterminedRange.concat(betweenTabs);
      log('  newUndeterminedRange ', newUndeterminedRange);

      const newUndeterminedRangeIds = newUndeterminedRange.map(tab => tab.id);
      const outOfRangeTabIds = Array.from(oldUndeterminedRange.keys()).filter(id => newUndeterminedRangeIds.indexOf(id) < 0);
      {
        for (const id of outOfRangeTabIds) {
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
      }

      {
        for (const tab of newUndeterminedRange) {
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
    }
    else {
      for (const tab of params.allTargets) {
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

  async onClick(message) {
    log('onClick ', message);
    if (message.button != 0)
      return false;

    /*
    this.selection.clear();
    const selectedTabs = await Selection.getSelection(this.windowId);
    for (const tab of selectedTabs) {
      this.add(tab);
    }
    */

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
      this.clear();
      this.inSelectionSession = false;
      this.lastClickedTab = null;
      return false;
    }

    const lastActiveTab = message.lastActiveTab || (await browser.tabs.query({
      active:   true,
      windowId: this.windowId
    }))[0];

    let tabs = this.retrieveTargetTabs(message.tab);
    if (message.shiftKey) {
      log('select the clicked tab and tabs between last activated tab');
      const window = await browser.windows.get(message.window, { populate: true });
      const betweenTabs = this.getTabsBetween(this.lastClickedTab || lastActiveTab, message.tab, window.tabs);
      tabs = tabs.concat(betweenTabs);
      tabs.push(this.lastClickedTab || lastActiveTab);
      const selectedTabIds = tabs.map(tab => tab.id);
      if (!ctrlKeyPressed) {
        for (const tab of window.tabs.filter(tab => !selectedTabIds.includes(tab.id))) {
          this.delete(tab);
        }
      }
      for (const tab of tabs) {
        this.add(tab);
      }
      this.inSelectionSession = true;
      this.syncToHighlighted();
      return true;
    }
    else if (ctrlKeyPressed) {
      log('toggle selection of the tab and all collapsed descendants');
      if (message.tab.id != lastActiveTab.id ||
          !this.inSelectionSession) {
        this.add(lastActiveTab);
        if (configs.enableIntegrationWithTST)
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
      return true;
    }
    return false;
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

    const ctrlKeyPressed = message.ctrlKey || (message.metaKey && /^Mac/i.test(navigator.platform));
    if (!ctrlKeyPressed &&
        !message.shiftKey &&
        !this.dragStartTarget) {
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
    log('onDragReady', message);

    this.clear();
    this.dragEnteredCount = 1;
    this.willCloseSelectedTabs = message.startOnClosebox;
    this.state = this.willCloseSelectedTabs ? Constants.kREADY_TO_CLOSE : Constants.kSELECTED ;
    this.pendingTabs = null;
    this.dragStartTarget = this.firstHoverTarget = this.lastHoverTarget = message.tab;
    this.allTabsOnDragReady = await Selection.getAllTabs(this.windowId);

    const startTabs = this.retrieveTargetTabs(message.tab);
    for (const tab of startTabs) {
      this.add(tab);
      this.undeterminedRange.set(tab.id, tab);
    }
    Selection.notifyTabStateToTST(startTabs.map(tab => tab.id), this.state, true);
  }

  async onDragCancel(message) {
    //console.log('onDragCancel', message);
    if (this.selection.size > 1) {
      this.onDragSelectionEnd.dispatch(message, {
        dragStartTab: this.dragStartTarget,
        selection:    this.selectedTabs
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
    //console.log('onDragEnter', message, message.tab == this.lastHoverTarget);
    this.dragEnteredCount++;
    // processAutoScroll(event);

    if (this.lastHoverTarget &&
        message.tab.id == this.lastHoverTarget.id)
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
    this.toggleStateOfDragOverTabs({
      target:     message.tab,
      allTargets: targetTabs
    });
    if (message.tab.id == this.dragStartTarget.id &&
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
    this.lastHoverTarget = message.tab;
    if (!this.firstHoverTarget)
      this.firstHoverTarget = this.lastHoverTarget;
  }

  async onDragExit(_message) {
    this.dragEnteredCount--;
    this.reserveDragExitAllWithDelay();
  }
  dragExitAllWithDelay() {
    //console.log('dragExitAllWithDelay '+this.dragEnteredCount);
    this.cancelDragExitAllWithDelay();
    if (this.dragEnteredCount <= 0) {
      this.firstHoverTarget = this.lastHoverTarget = null;
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
        selection:    this.selectedTabs
      });
      // don't clear selection state until menu command is processed.
      this.cancel();
    }
    else {
      this.clear();
    }
  }

};
