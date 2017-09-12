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

  console.log('setSelection ', aTabIds, `${aState}=${aSelected}`);
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
var gSelectionStateMap = null;

async function onTSTTabDragStart(aMessage) {
  gCloseSelectedTabs = aMessage.startOnClosebox;
  gPendingTabs = await getTargetTabs(aMessage);
  gSelectionStateMap = new Map();
}

async function onTSTTabDragEnter(aMessage) {
  var state = gCloseSelectedTabs ? 'ready-to-close' : 'selected' ;
  if (gPendingTabs) {
    console.log('gPendingTabs ', gPendingTabs);
    setSelection(gPendingTabs, true, state);
    for (let id of gPendingTabs) {
      gSelectionStateMap.set(id, true);
    }
    gPendingTabs = null;
  }
  console.log('aMessage ', aMessage);
  var tabs = await getTargetTabs(aMessage);
  console.log('tabs ', tabs);
  var toBeSelected = !gSelectionStateMap.has(tabs[0]);
  if (toBeSelected) {
    for (let id of tabs) {
      gSelectionStateMap.set(id, true);
    }
  }
  else {
    for (let id of tabs) {
      gSelectionStateMap.delete(id);
    }
  }
  setSelection(tabs, toBeSelected, state);
}

async function onTSTTabDragExit(aMessage) {
}

async function onTSTTabDragEnd(aMessage) {
  if (gCloseSelectedTabs) {
    let selectedTabs = gSelectionStateMap.keys;
    let allTabs = await browser.tabs.query({ windowId: aMessage.window });
    allTabs.reverse();
    for (let tab of allTabs) {
      if (selectedTabs.indexOf(tab.id) > -1)
        await browser.tabs.remove(tab.id);
    }
  }
  clearSelection(aMessage.window);
  gSelectionStateMap = null;
  gCloseSelectedTabs = false;
}


/*  listen events */

function onTSTAPIMessage(aMessage) {
  switch (aMessage.type) {
    case kTSTAPI_NOTIFY_READY:
      registerToTST();
      return Promise.resolve(true);

    case kTSTAPI_NOTIFY_TAB_CLICKED:
      return onTSTTabClick(aMessage);

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

