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

export const onDragSelectionEnd = new EventListenerManager();

const mDragSelection = {
  selection:             new Map(),
  willCloseSelectedTabs: false,
  allTabsOnDragReady:    [],
  pendingTabs:           null,
  dragStartTarget:       null,
  lastHoverTarget:       null,
  firstHoverTarget:      null,
  lastClickedTab:        null,
  undeterminedRange:     new Map(),
  dragEnteredCount:      0,
  inSelectionSession:    false,
  cancel() {
    this.dragStartTarget = this.firstHoverTarget = this.lastHoverTarget = null;
    this.undeterminedRange.clear();
    this.lastClickedTab = null;
    this.willCloseSelectedTabs = false;
    this.dragEnteredCount = 0;
    this.allTabsOnDragReady = [];
    this.inSelectionSession = false;
    this.state = null;
  },
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
  },
  async startDrag(tab, options = {}) {
    this.clear();
    this.dragEnteredCount = 1;
    this.willCloseSelectedTabs = options.closeTabs;
    this.state = this.willCloseSelectedTabs ? Constants.kREADY_TO_CLOSE : Constants.kSELECTED ;
    this.pendingTabs = null;
    this.dragStartTarget = this.firstHoverTarget = this.lastHoverTarget = tab;
    this.allTabsOnDragReady = await Selection.getAllTabs(tab.windowId);
  },
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

      const betweenTabs = getTabsBetween(this.firstHoverTarget, params.target, this.allTabsOnDragReady);
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
  },
  syncToHighlighted() {
    if (!this.willCloseSelectedTabs)
      Selection.select(Array.from(this.selection.values()));
  }
};

export function getDragStartTargetId() {
  return mDragSelection.dragStartTarget && mDragSelection.dragStartTarget.id;
}

export function activateInVerticalTabbarOfTST() {
  mDragSelection.activatedInVerticalTabbarOfTST = true;
}

export function deactivateInVerticalTabbarOfTST() {
  mDragSelection.activatedInVerticalTabbarOfTST = false;
}

export function isActivatedInVerticalTabbarOfTST() {
  return !!mDragSelection.activatedInVerticalTabbarOfTST;
}

/* utilities */

function retrieveTargetTabs(serializedTab, force = false) {
  let tabs = [serializedTab];
  if (serializedTab.children &&
      (force || serializedTab.states.indexOf('subtree-collapsed') > -1)) {
    for (const tab of serializedTab.children) {
      tabs = tabs.concat(retrieveTargetTabs(tab, true))
    }
  }
  return tabs;
}

function getTabsBetween(aBegin, end, allTabs = []) {
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


/* select tabs by clicking */

export async function onClick(message) {
  log('onClick ', message);
  if (message.button != 0)
    return false;

  const windowId = message.window || message.windowId || (message.tab && message.tab.windowId);
  /*
  mDragSelection.selection.clear();
  const selectedTabs = await Selection.getSelection(windowId);
  for (const tab of selectedTabs) {
    mDragSelection.selection.set(tab.id, tab);
  }
  */

  let selected = false;
  {
    if (message.tab.states)
      selected = message.tab.states.includes(Constants.kSELECTED);
    else
      selected = mDragSelection.selection.has(message.tab.id);
  }

  const ctrlKeyPressed = /^Mac/i.test(navigator.platform) ? message.metaKey : message.ctrlKey;
  if (!ctrlKeyPressed && !message.shiftKey) {
    log('regular click');
    if (!selected) {
      log('clear selection');
      mDragSelection.clear();
    }
    mDragSelection.inSelectionSession = false;
    mDragSelection.lastClickedTab = null;
    return false;
  }

  const lastActiveTab = message.lastActiveTab || (await browser.tabs.query({
    active:   true,
    windowId: windowId
  }))[0];

  let tabs = retrieveTargetTabs(message.tab);
  if (message.shiftKey) {
    log('select the clicked tab and tabs between last activated tab');
    const window = await browser.windows.get(message.window, { populate: true });
    const betweenTabs = getTabsBetween(mDragSelection.lastClickedTab || lastActiveTab, message.tab, window.tabs);
    tabs = tabs.concat(betweenTabs);
    tabs.push(mDragSelection.lastClickedTab || lastActiveTab);
    const selectedTabIds = tabs.map(tab => tab.id);
    if (!ctrlKeyPressed) {
      for (const tab of window.tabs.filter(tab => !selectedTabIds.includes(tab.id))) {
        mDragSelection.selection.delete(tab.id);
      }
    }
    for (const tab of tabs) {
      mDragSelection.selection.set(tab.id, tab);
    }
    mDragSelection.inSelectionSession = true;
    mDragSelection.syncToHighlighted();
    return true;
  }
  else if (ctrlKeyPressed) {
    log('toggle selection of the tab and all collapsed descendants');
    if (message.tab.id != lastActiveTab.id ||
        !mDragSelection.inSelectionSession) {
      mDragSelection.selection.set(lastActiveTab.id, lastActiveTab);
      if (configs.enableIntegrationWithTST)
        await setSelectedStateToCollapsedDescendants(lastActiveTab, true);
    }
    for (const tab of tabs) {
      if (selected)
        mDragSelection.selection.delete(tab.id);
      else
        mDragSelection.selection.set(tab.id, tab);
    }
    mDragSelection.inSelectionSession = true;
    mDragSelection.lastClickedTab = message.tab;
    mDragSelection.syncToHighlighted();
    return true;
  }
  return false;
}

async function setSelectedStateToCollapsedDescendants(tab, selected) {
  const tree = await browser.runtime.sendMessage(Constants.kTST_ID, {
    type: Constants.kTSTAPI_GET_TREE,
    tab:  tab.id
  }).catch(handleMissingReceiverError);
  if (!tree || !tree.states.includes('subtree-collapsed'))
    return;
  const treeTabs = collectTabsRecursively(tree);
  for (const tab of treeTabs) {
    if (selected)
      mDragSelection.selection.set(tab.id, tab);
    else
      mDragSelection.selection.delete(tab.id);
  }
}
function collectTabsRecursively(tab) {
  let tabs = [tab];
  if (tab.children) {
    for (const child of tab.children) {
      tabs = tabs.concat(collectTabsRecursively(child));
    }
  }
  return tabs;
}

export async function onMouseUp(message) {
  log('onMouseUp ', message);
  if (message.button != 0)
    return false;

  const ctrlKeyPressed = message.ctrlKey || (message.metaKey && /^Mac/i.test(navigator.platform));
  if (!ctrlKeyPressed &&
      !message.shiftKey &&
      !mDragSelection.dragStartTarget) {
    mDragSelection.clear();
  }
}

export async function onNonTabAreaClick(message) {
  if (message.button != 0)
    return;
  mDragSelection.clear();
}


/* select tabs by dragging */

export async function onDragReady(message) {
  log('onDragReady', message);

  mDragSelection.startDrag(message.tab, { closeTabs: message.startOnClosebox });

  const startTabs = retrieveTargetTabs(message.tab);
  for (const tab of startTabs) {
    mDragSelection.selection.set(tab.id, tab);
    mDragSelection.undeterminedRange.set(tab.id, tab);
  }
  Selection.notifyTabStateToTST(startTabs.map(tab => tab.id), mDragSelection.state, true);
}

export async function onDragCancel(message) {
  //console.log('onDragCancel', message);
  if (mDragSelection.selection.size > 1) {
    onDragSelectionEnd.dispatch(message, {
      dragStartTab: mDragSelection.dragStartTarget,
      selection:    Array.from(mDragSelection.selection.values())
    });
    // don't clear selection state until menu command is processed.
    mDragSelection.cancel();
  }
  else {
    mDragSelection.clear();
  }
}

export async function onDragStart(_message) {
  //console.log('onDragStart', message);
}

export async function onDragEnter(message) {
  //console.log('onDragEnter', message, message.tab == mDragSelection.lastHoverTarget);
  mDragSelection.dragEnteredCount++;
  // processAutoScroll(event);

  if (mDragSelection.lastHoverTarget &&
      message.tab.id == mDragSelection.lastHoverTarget.id)
    return;

  if (mDragSelection.pendingTabs) {
    for (const tab of mDragSelection.pendingTabs) {
      mDragSelection.selection.set(tab.id, tab);
      Selection.notifyTabStateToTST(tab.id, mDragSelection.state, true);
    }
    mDragSelection.pendingTabs = null;
  }
  /*
  if (mDragSelection.willCloseSelectedTabs || tabDragMode == TAB_DRAG_MODE_SELECT) {
  */
  const targetTabs = retrieveTargetTabs(message.tab);
  mDragSelection.toggleStateOfDragOverTabs({
    target:     message.tab,
    allTargets: targetTabs
  });
  if (message.tab.id == mDragSelection.dragStartTarget.id &&
      mDragSelection.selection.size == targetTabs.length) {
    for (const tab of targetTabs) {
      mDragSelection.selection.delete(tab.id);
      Selection.notifyTabStateToTST(tab.id, mDragSelection.state, false);
    }
    mDragSelection.syncToHighlighted();
    for (const tab of targetTabs) {
      mDragSelection.undeterminedRange.set(tab.id, tab);
    }
    mDragSelection.pendingTabs = targetTabs;
  }
  /*
  }
  else { // TAB_DRAG_MODE_SWITCH:
    browser.tabs.update(message.tab.id, { active: true });
  }
  */
  mDragSelection.lastHoverTarget = message.tab;
  if (!mDragSelection.firstHoverTarget)
    mDragSelection.firstHoverTarget = mDragSelection.lastHoverTarget;
}

export async function onDragExit(_message) {
  mDragSelection.dragEnteredCount--;
  dragExitAllWithDelay.reserve();
}

function dragExitAllWithDelay() {
  //console.log('dragExitAllWithDelay '+mDragSelection.dragEnteredCount);
  dragExitAllWithDelay.cancel();
  if (mDragSelection.dragEnteredCount <= 0) {
    mDragSelection.firstHoverTarget = mDragSelection.lastHoverTarget = null;
    mDragSelection.undeterminedRange.clear();
  }
}
dragExitAllWithDelay.reserve = () => {
  dragExitAllWithDelay.cancel();
  dragExitAllWithDelay.timeout = setTimeout(() => {
    dragExitAllWithDelay();
  }, 10);
};
dragExitAllWithDelay.cancel = () => {
  if (dragExitAllWithDelay.timeout) {
    clearTimeout(dragExitAllWithDelay.timeout);
    delete dragExitAllWithDelay.timeout;
  }
};

export async function onDragEnd(message) {
  log('onDragEnd', message, mDragSelection.selection);
  if (mDragSelection.selection.size > 1)
    mDragSelection.syncToHighlighted();
  if (mDragSelection.willCloseSelectedTabs) {
    const allTabs = mDragSelection.allTabsOnDragReady.slice(0);
    allTabs.reverse();
    const toBeClosedIds = Array.from(mDragSelection.selection.keys());
    for (const tab of allTabs) {
      if (tab && toBeClosedIds.indexOf(tab.id) > -1)
        await browser.tabs.remove(tab.id);
    }
    mDragSelection.clear();
  }
  else if (mDragSelection.selection.size > 1) {
    await onDragSelectionEnd.dispatch(message, {
      dragStartTab: mDragSelection.dragStartTarget,
      selection:    Array.from(mDragSelection.selection.values())
    });
    // don't clear selection state until menu command is processed.
    mDragSelection.cancel();
  }
  else {
    mDragSelection.clear();
  }
}
