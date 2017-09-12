/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const kTST_ID = 'treestyletab@piro.sakura.ne.jp';
const kTSTAPI_REGISTER_SELF        = 'register-self';
const kTSTAPI_UNREGISTER_SELF      = 'unregister-self';
const kTSTAPI_NOTIFY_READY         = 'ready';
const kTSTAPI_NOTIFY_TAB_CLICKED   = 'tab-clicked';
const kTSTAPI_NOTIFY_TAB_DRAGREADY = 'tab-dragready';
const kTSTAPI_NOTIFY_TAB_DRAGSTART = 'tab-dragstart';
const kTSTAPI_NOTIFY_TAB_DRAGENTER = 'tab-dragenter';
const kTSTAPI_NOTIFY_TAB_DRAGEXIT  = 'tab-dragexit';
const kTSTAPI_NOTIFY_TAB_DRAGEND   = 'tab-dragend';
const kTSTAPI_IS_SUBTREE_COLLAPSED = 'is-subtree-collapsed';
const kTSTAPI_HAS_CHILD_TABS       = 'has-child-tabs';
const kTSTAPI_GET_DESCENDANT_TABS  = 'get-descendant-tabs';
const kTSTAPI_GET_TAB_STATE        = 'get-tab-state';
const kTSTAPI_ADD_TAB_STATE        = 'add-tab-state';
const kTSTAPI_REMOVE_TAB_STATE     = 'remove-tab-state';

/* utilities */

function clearSelection(aWindowId, aState) {
  gSelectionState.clear();
  browser.runtime.sendMessage(kTST_ID, {
    type:   kTSTAPI_REMOVE_TAB_STATE,
    tabs:   '*',
    window: aWindowId,
    state:  aState || 'selected'
  });
}

function setSelection(aTabIds, aSelected, aState) {
  if (!Array.isArray(aTabIds))
    aTabIds = [aTabIds];

  //console.log('setSelection ', aTabIds, `${aState}=${aSelected}`);
  if (aSelected) {
    for (let id of aTabIds) {
      gSelectionState.set(id, true);
    }
  }
  else {
    for (let id of aTabIds) {
      gSelectionState.delete(id);
    }
  }
  browser.runtime.sendMessage(kTST_ID, {
    type:  aSelected ? kTSTAPI_ADD_TAB_STATE : kTSTAPI_REMOVE_TAB_STATE,
    tabs:  aTabIds,
    state: aState || 'selected'
  });
}

async function getTargetTabs(aMessage) {
  var ids = [aMessage.tab];
  if (aMessage.states.indexOf('subtree-collapsed') > -1) {
    let descendantIds = await browser.runtime.sendMessage(kTST_ID, {
      type: kTSTAPI_GET_DESCENDANT_TABS,
      tab:  aMessage.tab
    });
    ids = ids.concat(descendantIds);
  }
  return ids;
}

async function getTabsBetween(aBegin, aEnd) {
  if (aBegin == aEnd)
    return [];
  var tab = await browser.tabs.get(aBegin);
  var allTabs = await browser.tabs.query({ windowId: tab.windowId });
  var inRange = false;
  return allTabs.map(aTab => aTab.id).filter(aId => {
    if (aId == aBegin || aId == aEnd) {
      inRange = !inRange;
      return false;
    }
    return inRange;
  });
}

async function toggleStateBetween(aParams = {}) {
  if (gFirstHoverTarget) {
    // At first, toggle state to reset all existing items in the undetermined selection.
    for (let id of gUndeterminedRange.keys()) {
      setSelection(id, !gSelectionState.has(id), aParams.state);
    }
    gUndeterminedRange.clear();

    let undeterminedRangeTabs = aParams.currentAndDescendants;
    if (gFirstHoverTarget && undeterminedRangeTabs.indexOf(gFirstHoverTarget) < 0)
      undeterminedRangeTabs.push(gFirstHoverTarget);

    undeterminedRangeTabs = undeterminedRangeTabs.concat(await getTabsBetween(gFirstHoverTarget, aParams.current));
    let cleanedTabs = new Map();
    for (let tab of undeterminedRangeTabs) {
      cleanedTabs.set(tab, true);
    }
    for (let tab of cleanedTabs.keys()) {
      setSelection(tab, !gSelectionState.has(tab), aParams.state);
      gUndeterminedRange.set(tab, true);
    }
  }
  else {
    for (let tab of aParams.currentAndDescendants) {
      gUndeterminedRange.set(tab, true);
    }
    setSelection(aParams.currentAndDescendants, !gSelectionState.has(aParams.current), aParams.state);
  }
}


/* select tabs by clicking */

var gInSelectionSession = false;

async function onTSTTabClick(aMessage) {
  if (aMessage.button != 0)
    return false;

  if (!aMessage.ctrlKey && !aMessage.shiftKey) {
    clearSelection(aMessage.window);
    gInSelectionSession = false;
    return;
  }

  let activeTab = await browser.tabs.query({
    active:   true,
    windowId: aMessage.window
  });
  activeTab = activeTab[0];

  let tabIds = await getTargetTabs(aMessage);
  if (aMessage.ctrlKey) {
    // toggle selection of the tab and all collapsed descendants
    if (aMessage.tab != activeTab.id &&
        !gInSelectionSession) {
      setSelection(activeTab.id, true);
    }
    setSelection(tabIds, aMessage.states.indexOf('selected') < 0);
    gInSelectionSession = true;
    return true;
  }
  else if (aMessage.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    clearSelection(aMessage.window);
    let window = await browser.windows.get(aMessage.window, { populate: true });
    let allTabIds = window.tabs.map(aTab => aTab.id);
    let inSelection = false;
    let betweenTabIds = activeTab.id == aMessage.tab ?
                          [] :
                          allTabIds.filter(aTabId => {
                            let isBoundary = aTabId == activeTab.id ||
                                             aTabId == aMessage.tab;
                            if (isBoundary)
                              inSelection = !inSelection;
                            return isBoundary || inSelection;
                          });
    setSelection(betweenTabIds.concat(tabIds), true);
    gInSelectionSession = true;
    return true;
  }
  return false;
}


/* select tabs by dragging */

var gCloseSelectedTabs = false;
var gPendingTabs = null;
var gSelectionState = new Map();
var gDragStartTarget = null;
var gLastHoverTarget = null;
var gFirstHoverTarget = null;
var gUndeterminedRange = new Map();
var gDragEnteredCount = 0;

async function onTSTTabDragReady(aMessage) {
  //console.log('onTSTTabDragReady', aMessage);
  gUndeterminedRange.clear();
  gSelectionState.clear();
  gDragEnteredCount = 1;
  gCloseSelectedTabs = aMessage.startOnClosebox;
  gPendingTabs = null;
  gDragStartTarget = gFirstHoverTarget = gLastHoverTarget = aMessage.tab;

  clearSelection(aMessage.window, 'selected');
  clearSelection(aMessage.window, 'ready-to-close');

  var startTabs = await getTargetTabs(aMessage);
  if (gCloseSelectedTabs)
    gPendingTabs = startTabs;
  else
    setSelection(startTabs, true, 'selected');

  for (let tab of startTabs) {
    gUndeterminedRange.set(tab, true);
  }
}

async function onTSTTabDragStart(aMessage) {
  //console.log('onTSTTabDragStart', aMessage);
}

async function onTSTTabDragEnter(aMessage) {
  //console.log('onTSTTabDragEnter', aMessage, aMessage.tab == gLastHoverTarget);
  gDragEnteredCount++;
  // processAutoScroll(aEvent);

  if (aMessage.tab == gLastHoverTarget)
    return;

  var state = gCloseSelectedTabs ? 'ready-to-close' : 'selected' ;
  if (gPendingTabs) {
    setSelection(gPendingTabs, true, state);
    gPendingTabs = null;
  }
/*
  if (gCloseSelectedTabs || tabDragMode == TAB_DRAG_MODE_SELECT) {
*/
    let targetTabs = await getTargetTabs(aMessage);
    await toggleStateBetween({
      current: aMessage.tab,
      currentAndDescendants: targetTabs,
      state: state
    });
    if (gCloseSelectedTabs &&
        aMessage.tab == gDragStartTarget &&
        gSelectionState.size == targetTabs.length) {
      setSelection(targetTabs, false, state);
      for (let tab of targetTabs) {
        gUndeterminedRange.set(tab, true);
      }
      gPendingTabs = targetTabs;
    }
/*
  }
  else { // TAB_DRAG_MODE_SWITCH:
    browser.tabs.update(aMessage.tab, { active: true });
  }
*/
  gLastHoverTarget = aMessage.tab;
}

async function onTSTTabDragExit(aMessage) {
  gDragEnteredCount--;
  dragExitAllWithDelay.reserve();
}

function dragExitAllWithDelay() {
  //console.log('dragExitAllWithDelay '+gDragEnteredCount);
  dragExitAllWithDelay.cancel();
  if (gDragEnteredCount <= 0) {
    gFirstHoverTarget = gLastHoverTarget = null;
    gUndeterminedRange.clear();
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

async function onTSTTabDragEnd(aMessage) {
  //console.log('onTSTTabDragEnd', aMessage);
  gDragStartTarget = gFirstHoverTarget = gLastHoverTarget = null;

  if (gCloseSelectedTabs) {
    let allTabs = await browser.tabs.query({ windowId: aMessage.window });
    allTabs.reverse();
    for (let tab of allTabs) {
      if (gSelectionState.has(tab.id))
        await browser.tabs.remove(tab.id);
    }
  }
  else {
    // show selection popup
  }
  clearSelection(aMessage.window);
  gUndeterminedRange.clear();
  gSelectionState.clear();
  gCloseSelectedTabs = false;
  gDragEnteredCount = 0;
}


/*  listen events */

function onTSTAPIMessage(aMessage) {
  switch (aMessage.type) {
    case kTSTAPI_NOTIFY_READY:
      registerToTST();
      return Promise.resolve(true);

    case kTSTAPI_NOTIFY_TAB_CLICKED:
      return onTSTTabClick(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGREADY:
      return onTSTTabDragReady(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGSTART:
      return onTSTTabDragStart(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGENTER:
      return onTSTTabDragEnter(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGEXIT:
      return onTSTTabDragExit(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGEND:
      return onTSTTabDragEnd(aMessage);
  }
}

function onMessageExternal(aMessage, aSender) {
  //console.log('onMessageExternal: ', aMessage, aSender);
  switch (aSender.id) {
    case kTST_ID:
      return onTSTAPIMessage(aMessage);
  }
}
browser.runtime.onMessageExternal.addListener(onMessageExternal);


function registerToTST() {
  browser.runtime.sendMessage(kTST_ID, {
    type:  kTSTAPI_REGISTER_SELF /*,
    style: `
    `*/
  });
}
browser.management.get(kTST_ID).then(registerToTST);

function wait(aTimeout) {
  return new Promise((aResolve, aReject) => {
    setTimeout(aResolve, aTimeout || 0);
  });
}

