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

export const mDragSelection = {
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
  cancel() {
    this.dragStartTarget = this.firstHoverTarget = this.lastHoverTarget = null;
    this.undeterminedRange.clear();
    this.lastClickedTab = null;
    this.willCloseSelectedTabs = false;
    this.dragEnteredCount = 0;
    this.allTabsOnDragReady = [];
  },
  clear() {
    this.cancel();
    this.selection.clear();
    Selection.clear();
  },
  export() {
    const exported = {};
    for (const key of Object.keys(this)) {
      if (key != 'selection' &&
          typeof this[key] != 'function')
        exported[key] = this[key];
    }
    return exported;
  },
  apply(foreignSession) {
    for (const key of Object.keys(foreignSession)) {
      if (typeof this[key] != 'function')
        this[key] = foreignSession[key];
    }
  }
};

export function serialize() {
  return mDragSelection.export();
}

export function apply(dragSelection) {
  return mDragSelection.apply(dragSelection);
}

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

function toggleStateOfDragOverTabs(params = {}) {
  log('toggleStateOfDragOverTabs ', params);
  const toBeSelected = new Set();
  const toBeUnselected = new Set();
  if (mDragSelection.firstHoverTarget) {
    log('  firstHoverTarget ', mDragSelection.firstHoverTarget);
    const oldUndeterminedRange = mDragSelection.undeterminedRange;
    mDragSelection.undeterminedRange = new Map();
    log('  oldUndeterminedRange ', oldUndeterminedRange);

    let newUndeterminedRange = params.allTargets;
    if (newUndeterminedRange.every(tab => tab.id != mDragSelection.firstHoverTarget.id))
      newUndeterminedRange.push(mDragSelection.firstHoverTarget);

    const betweenTabs = getTabsBetween(mDragSelection.firstHoverTarget, params.target, mDragSelection.allTabsOnDragReady);
    newUndeterminedRange = newUndeterminedRange.concat(betweenTabs);
    log('  newUndeterminedRange ', newUndeterminedRange);

    const newUndeterminedRangeIds = newUndeterminedRange.map(tab => tab.id);
    const outOfRangeTabIds = Array.from(oldUndeterminedRange.keys()).filter(id => newUndeterminedRangeIds.indexOf(id) < 0);
    {
      for (const id of outOfRangeTabIds) {
        if (mDragSelection.selection.has(id)) {
          mDragSelection.selection.delete(id);
          toBeUnselected.add(id);
        }
        else {
          mDragSelection.selection.set(id, oldUndeterminedRange.get(id));
          toBeSelected.add(id);
        }
      }
    }

    {
      for (const tab of newUndeterminedRange) {
        if (mDragSelection.undeterminedRange.has(tab.id))
          continue;
        mDragSelection.undeterminedRange.set(tab.id, tab);
        if (oldUndeterminedRange.has(tab.id))
          continue;
        if (mDragSelection.selection.has(tab.id)) {
          mDragSelection.selection.delete(tab.id);
          toBeUnselected.add(tab.id);
          toBeSelected.delete(tab.id);
        }
        else {
          mDragSelection.selection.set(tab.id, tab);
          toBeSelected.add(tab.id);
          toBeUnselected.delete(tab.id);
        }
      }
    }
  }
  else {
    for (const tab of params.allTargets) {
      mDragSelection.undeterminedRange.set(tab.id, tab);
      mDragSelection.selection.set(tab.id, tab);
      toBeSelected.add(tab.id);
    }
  }
  Selection.notifyTabStateToTST(Array.from(toBeSelected), params.state, true);
  Selection.notifyTabStateToTST(Array.from(toBeUnselected), params.state, false);
  if (!mDragSelection.willCloseSelectedTabs)
    Selection.select(Array.from(mDragSelection.selection.values()));
}


/* select tabs by clicking */

let gInSelectionSession = false;

export async function onClick(message) {
  if (message.button != 0)
    return false;

  let selected = false;
  {
    if (message.tab.states)
      selected = message.tab.states.indexOf('selected') > -1;
    else
      selected = !!mDragSelection.selection.has(message.tab.id);
  }

  const ctrlKeyPressed = message.ctrlKey || (message.metaKey && /^Mac/i.test(navigator.platform));
  if (!ctrlKeyPressed && !message.shiftKey) {
    if (!selected) {
      Selection.notifyTabStateToTST(
        Array.from(mDragSelection.selection.keys()),
        [Constants.kSELECTED, Constants.kREADY_TO_CLOSE],
        false
      );
      mDragSelection.selection.clear();
    }
    gInSelectionSession = false;
    mDragSelection.lastClickedTab = null;
    return;
  }

  const lastActiveTab = message.lastActiveTab || (await browser.tabs.query({
    active:   true,
    windowId: message.window
  }))[0];

  let tabs = retrieveTargetTabs(message.tab);
  if (message.shiftKey) {
    // select the clicked tab and tabs between last activated tab
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
    gInSelectionSession = true;
    // Selection must include the active tab. This is the standard behavior on Firefox 62 and later.
    const newSelectedTabIds = Array.from(mDragSelection.selection.keys());
    if (newSelectedTabIds.length > 0 && !newSelectedTabIds.includes(lastActiveTab.id))
      browser.tabs.update(mDragSelection.lastClickedTab ? mDragSelection.lastClickedTab.id : newSelectedTabIds[0], { active: true });
    Selection.select(Array.from(mDragSelection.selection.values()));
    return true;
  }
  else if (ctrlKeyPressed) {
    // toggle selection of the tab and all collapsed descendants
    if (message.tab.id != lastActiveTab.id ||
        !gInSelectionSession) {
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
    // Selection must include the active tab. This is the standard behavior on Firefox 62 and later.
    const selectedTabIds = Array.from(mDragSelection.selection.keys());
    if (selectedTabIds.length > 0 && !selectedTabIds.includes(lastActiveTab.id))
      browser.tabs.update(selectedTabIds[0], { active: true });
    gInSelectionSession = true;
    mDragSelection.lastClickedTab = message.tab;
    Selection.select(Array.from(mDragSelection.selection.values()));
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
  if (message.button != 0)
    return false;

  const ctrlKeyPressed = message.ctrlKey || (message.metaKey && /^Mac/i.test(navigator.platform));
  if (!ctrlKeyPressed &&
      !message.shiftKey &&
      !mDragSelection.dragStartTarget) {
    Selection.notifyTabStateToTST(
      Array.from(mDragSelection.selection.keys()),
      [Constants.kSELECTED, Constants.kREADY_TO_CLOSE],
      false
    );
    mDragSelection.selection.clear();
  }
}

export async function onNonTabAreaClick(message) {
  if (message.button != 0)
    return;
  Selection.notifyTabStateToTST(
    Array.from(mDragSelection.selection.keys()),
    [Constants.kSELECTED, Constants.kREADY_TO_CLOSE],
    false
  );
  mDragSelection.selection.clear();
  mDragSelection.clear();
}


/* select tabs by dragging */

export async function onDragReady(message) {
  //console.log('onDragReady', message);
  const allTabs = await Selection.getAllTabs(message.window);
  Selection.notifyTabStateToTST(
    allTabs,
    [Constants.kSELECTED, Constants.kREADY_TO_CLOSE],
    false
  );

  mDragSelection.clear();
  mDragSelection.dragEnteredCount = 1;
  mDragSelection.willCloseSelectedTabs = message.startOnClosebox;
  mDragSelection.pendingTabs = null;
  mDragSelection.dragStartTarget = mDragSelection.firstHoverTarget = mDragSelection.lastHoverTarget = message.tab;
  mDragSelection.allTabsOnDragReady = allTabs;

  const startTabs = retrieveTargetTabs(message.tab);
  for (const tab of startTabs) {
    mDragSelection.selection.set(tab.id, tab);
    if (mDragSelection.willCloseSelectedTabs)
      Selection.notifyTabStateToTST(tab.id, Constants.kREADY_TO_CLOSE, true);
  }

  if (!mDragSelection.willCloseSelectedTabs)
    Selection.select(Array.from(mDragSelection.selection.values()));

  for (const tab of startTabs) {
    mDragSelection.undeterminedRange.set(tab.id, tab);
  }
}

export async function onDragCancel(message) {
  //console.log('onDragCancel', message);
  if (mDragSelection.selection.size > 0) {
    onDragSelectionEnd.dispatch(message, {
      dragStartTab: mDragSelection.dragStartTarget,
      selection:    Array.from(mDragSelection.selection.values())
    });
    // don't clear selection state until menu command is processed.
  }
  mDragSelection.cancel();
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

  const state = mDragSelection.willCloseSelectedTabs ? Constants.kREADY_TO_CLOSE : Constants.kSELECTED ;
  if (mDragSelection.pendingTabs) {
    for (const tab of mDragSelection.pendingTabs) {
      mDragSelection.selection.set(tab.id, tab);
      Selection.notifyTabStateToTST(tab.id, state, true);
    }
    mDragSelection.pendingTabs = null;
  }
  /*
  if (mDragSelection.willCloseSelectedTabs || tabDragMode == TAB_DRAG_MODE_SELECT) {
  */
  const targetTabs = retrieveTargetTabs(message.tab);
  toggleStateOfDragOverTabs({
    target:     message.tab,
    allTargets: targetTabs,
    state:      state
  });
  if (message.tab.id == mDragSelection.dragStartTarget.id &&
      mDragSelection.selection.size == targetTabs.length) {
    for (const tab of targetTabs) {
      mDragSelection.selection.delete(tab.id);
      Selection.notifyTabStateToTST(tab.id, state, false);
    }
    if (!mDragSelection.willCloseSelectedTabs)
      Selection.select(Array.from(mDragSelection.selection.values()));
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
  //console.log('onDragEnd', message);
  if (mDragSelection.willCloseSelectedTabs) {
    const allTabs = mDragSelection.allTabsOnDragReady.slice(0);
    allTabs.reverse();
    const toBeClosedIds = Array.from(mDragSelection.selection.keys());
    for (const tab of allTabs) {
      if (tab && toBeClosedIds.indexOf(tab.id) > -1)
        await browser.tabs.remove(tab.id);
    }
    mDragSelection.selection.clear();
  }
  else if (mDragSelection.selection.size > 0) {
    await onDragSelectionEnd.dispatch(message, {
      dragStartTab: mDragSelection.dragStartTarget,
      selection:    Array.from(mDragSelection.selection.values())
    });
    // don't clear selection state until menu command is processed.
  }
  mDragSelection.cancel();
}
