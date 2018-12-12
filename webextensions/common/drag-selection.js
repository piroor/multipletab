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
  constructor() {
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
    if (this.selection.size > 0)
      Selection.notifyTabStateToTST(
        Array.from(this.selection.keys()),
        [Constants.kSELECTED, Constants.kREADY_TO_CLOSE],
        false
      );
    this.cancel();
    if (this.selection.size > 1)
      Selection.clear();
    this.selection.clear();
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
          if (this.selection.has(id)) {
            this.selection.delete(id);
            toBeUnselected.add(id);
          }
          else {
            this.selection.set(id, oldUndeterminedRange.get(id));
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
          if (this.selection.has(tab.id)) {
            this.selection.delete(tab.id);
            toBeUnselected.add(tab.id);
            toBeSelected.delete(tab.id);
          }
          else {
            this.selection.set(tab.id, tab);
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
        if (this.selection.has(tab.id)) {
          this.selection.delete(tab.id);
          toBeUnselected.add(tab.id);
        }
        else {
          this.selection.set(tab.id, tab);
          toBeSelected.add(tab.id);
        }
      }
    }
    Selection.notifyTabStateToTST(Array.from(toBeSelected), this.state, true);
    Selection.notifyTabStateToTST(Array.from(toBeUnselected), this.state, false);
  }

  syncToHighlighted() {
    if (!this.willCloseSelectedTabs)
      Selection.select(Array.from(this.selection.values()));
  }


  /* event handling */

  async onClick(message) {
    log('onClick ', message);
    if (message.button != 0)
      return false;

    const windowId = message.window || message.windowId || (message.tab && message.tab.windowId);
    /*
    this.selection.clear();
    const selectedTabs = await Selection.getSelection(windowId);
    for (const tab of selectedTabs) {
      this.selection.set(tab.id, tab);
    }
    */

    let selected = false;
    {
      if (message.tab.states)
        selected = message.tab.states.includes(Constants.kSELECTED);
      else
        selected = this.selection.has(message.tab.id);
    }

    const ctrlKeyPressed = /^Mac/i.test(navigator.platform) ? message.metaKey : message.ctrlKey;
    if (!ctrlKeyPressed && !message.shiftKey) {
      log('regular click');
      if (!selected) {
        log('clear selection');
        this.clear();
      }
      this.inSelectionSession = false;
      this.lastClickedTab = null;
      return false;
    }

    const lastActiveTab = message.lastActiveTab || (await browser.tabs.query({
      active:   true,
      windowId: windowId
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
          this.selection.delete(tab.id);
        }
      }
      for (const tab of tabs) {
        this.selection.set(tab.id, tab);
      }
      this.inSelectionSession = true;
      this.syncToHighlighted();
      return true;
    }
    else if (ctrlKeyPressed) {
      log('toggle selection of the tab and all collapsed descendants');
      if (message.tab.id != lastActiveTab.id ||
          !this.inSelectionSession) {
        this.selection.set(lastActiveTab.id, lastActiveTab);
        if (configs.enableIntegrationWithTST)
          await this.setSelectedStateToCollapsedDescendants(lastActiveTab, true);
      }
      for (const tab of tabs) {
        if (selected)
          this.selection.delete(tab.id);
        else
          this.selection.set(tab.id, tab);
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
        this.selection.set(tab.id, tab);
      else
        this.selection.delete(tab.id);
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
    this.allTabsOnDragReady = await Selection.getAllTabs(message.tab.windowId);

    const startTabs = this.retrieveTargetTabs(message.tab);
    for (const tab of startTabs) {
      this.selection.set(tab.id, tab);
      this.undeterminedRange.set(tab.id, tab);
    }
    Selection.notifyTabStateToTST(startTabs.map(tab => tab.id), this.state, true);
  }

  async onDragCancel(message) {
    //console.log('onDragCancel', message);
    if (this.selection.size > 1) {
      this.onDragSelectionEnd.dispatch(message, {
        dragStartTab: this.dragStartTarget,
        selection:    Array.from(this.selection.values())
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
        this.selection.set(tab.id, tab);
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
        this.selection.delete(tab.id);
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
      const toBeClosedIds = Array.from(this.selection.keys());
      for (const tab of allTabs) {
        if (tab && toBeClosedIds.indexOf(tab.id) > -1)
          await browser.tabs.remove(tab.id);
      }
      this.clear();
    }
    else if (this.selection.size > 1) {
      await this.onDragSelectionEnd.dispatch(message, {
        dragStartTab: this.dragStartTarget,
        selection:    Array.from(this.selection.values())
      });
      // don't clear selection state until menu command is processed.
      this.cancel();
    }
    else {
      this.clear();
    }
  }

};
