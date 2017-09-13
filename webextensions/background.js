/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

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

function setSelection(aTabs, aSelected, aState) {
  if (!Array.isArray(aTabs))
    aTabs = [aTabs];

  var ids = typeof aTabs[0] == 'number' ?
              aTabs :
              aTabs.map(aTab => aTab.id);

  //console.log('setSelection ', ids, `${aState}=${aSelected}`);
  if (aSelected) {
    for (let id of ids) {
      gSelectionState.set(id, true);
    }
  }
  else {
    for (let id of ids) {
      gSelectionState.delete(id);
    }
  }
  browser.runtime.sendMessage(kTST_ID, {
    type:  aSelected ? kTSTAPI_ADD_TAB_STATE : kTSTAPI_REMOVE_TAB_STATE,
    tabs:  ids,
    state: aState || 'selected'
  });
}

function retrieveTargetTabs(aSerializedTab) {
  var tabs = [aSerializedTab];
  if (aSerializedTab.children &&
      aSerializedTab.states.indexOf('subtree-collapsed') > -1) {
    for (let tab of aSerializedTab.children) {
      tabs = ids.concat(retrieveTargetTabs(tab))
    }
  }
  return tabs;
}

function getTabsBetween(aBegin, aEnd, aAllTabs = []) {
  if (aBegin.id == aEnd.id)
    return [];
  var inRange = false;
  return aAllTabs.filter(aTab => {
    if (aTab.id == aBegin.id || aTab.id == aEnd.id) {
      inRange = !inRange;
      return false;
    }
    return inRange;
  });
}

function toggleStateOfDragOverTabs(aParams = {}) {
  if (gFirstHoverTarget) {
    // At first, toggle state to reset all existing items in the undetermined selection.
    for (let id of gUndeterminedRange.keys()) {
      setSelection(id, !gSelectionState.has(id), aParams.state);
    }
    gUndeterminedRange.clear();

    let undeterminedRangeTabs = aParams.allTargets.map(aTab => aTab.id);
    if (undeterminedRangeTabs.indexOf(gFirstHoverTarget.id) < 0)
      undeterminedRangeTabs.push(gFirstHoverTarget.id);

    let betweenTabs = getTabsBetween(gFirstHoverTarget, aParams.target, gAllTabsOnDragReady);
    undeterminedRangeTabs = undeterminedRangeTabs.concat(betweenTabs.map(aTab => aTab.id));
    let cleanedTabs = new Map();
    for (let id of undeterminedRangeTabs) {
      cleanedTabs.set(id, true);
    }
    for (let id of cleanedTabs.keys()) {
      setSelection(id, !gSelectionState.has(id), aParams.state);
      gUndeterminedRange.set(id, true);
    }
  }
  else {
    for (let tab of aParams.allTargets) {
      gUndeterminedRange.set(tab.id, true);
    }
    setSelection(aParams.allTargets, !gSelectionState.has(aParams.target.id), aParams.state);
  }
}


/* select tabs by clicking */

var gInSelectionSession = false;

async function onTSTTabClick(aMessage) {
  if (aMessage.button != 0)
    return false;

  if (!aMessage.ctrlKey && !aMessage.shiftKey) {
    clearSelection(aMessage.window, 'selected');
    clearSelection(aMessage.window, 'ready-to-close');
    gInSelectionSession = false;
    return;
  }

  let activeTab = (await browser.tabs.query({
    active:   true,
    windowId: aMessage.window
  }))[0];

  let tabs = retrieveTargetTabs(aMessage.tab);
  if (aMessage.ctrlKey) {
    // toggle selection of the tab and all collapsed descendants
    if (aMessage.tab.id != activeTab.id &&
        !gInSelectionSession) {
      setSelection(activeTab, true);
    }
    setSelection(tabs, aMessage.tab.states.indexOf('selected') < 0);
    gInSelectionSession = true;
    return true;
  }
  else if (aMessage.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    clearSelection(aMessage.window);
    let window = await browser.windows.get(aMessage.window, { populate: true });
    let betweenTabs = getTabsBetween(activeTab, aMessage.tab, window.tabs);
    tabs = tabs.concat(betweenTabs);
    tabs.push(activeTab);
    setSelection(tabs, true);
    gInSelectionSession = true;
    return true;
  }
  return false;
}

async function onTSTTabbarClick(aMessage) {
  if (aMessage.button != 0)
    return;
  gSelectionState.clear();
  clearSelection(aMessage.window, 'selected');
  clearSelection(aMessage.window, 'ready-to-close');
}


/* select tabs by dragging */

var gWillCloseSelectedTabs = false;
var gAllTabsOnDragReady = [];
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
  gWillCloseSelectedTabs = aMessage.startOnClosebox;
  gPendingTabs = null;
  gDragStartTarget = gFirstHoverTarget = gLastHoverTarget = aMessage.tab;
  gAllTabsOnDragReady = await browser.tabs.query({ windowId: aMessage.window });

  clearSelection(aMessage.window, 'selected');
  clearSelection(aMessage.window, 'ready-to-close');

  var startTabs = retrieveTargetTabs(aMessage.tab);
  var state = gWillCloseSelectedTabs ? 'ready-to-close' : 'selected' ;
  setSelection(startTabs, true, state);

  for (let tab of startTabs) {
    gUndeterminedRange.set(tab.id, true);
  }
}

async function onTSTTabDragStart(aMessage) {
  //console.log('onTSTTabDragStart', aMessage);
}

async function onTSTTabDragEnter(aMessage) {
  //console.log('onTSTTabDragEnter', aMessage, aMessage.tab == gLastHoverTarget);
  gDragEnteredCount++;
  // processAutoScroll(aEvent);

  if (gLastHoverTarget &&
      aMessage.tab.id == gLastHoverTarget.id)
    return;

  var state = gWillCloseSelectedTabs ? 'ready-to-close' : 'selected' ;
  if (gPendingTabs) {
    setSelection(gPendingTabs, true, state);
    gPendingTabs = null;
  }
/*
  if (gWillCloseSelectedTabs || tabDragMode == TAB_DRAG_MODE_SELECT) {
*/
    let targetTabs = retrieveTargetTabs(aMessage.tab);
    toggleStateOfDragOverTabs({
      target:     aMessage.tab,
      allTargets: targetTabs,
      state:      state
    });
    if (gWillCloseSelectedTabs &&
        aMessage.tab.id == gDragStartTarget.id &&
        gSelectionState.size == targetTabs.length) {
      setSelection(targetTabs, false, state);
      for (let tab of targetTabs) {
        gUndeterminedRange.set(tab.id, true);
      }
      gPendingTabs = targetTabs;
    }
/*
  }
  else { // TAB_DRAG_MODE_SWITCH:
    browser.tabs.update(aMessage.tab.id, { active: true });
  }
*/
  gLastHoverTarget = aMessage.tab;
  if (!gFirstHoverTarget)
    gFirstHoverTarget = gLastHoverTarget;
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

  if (gWillCloseSelectedTabs) {
    let allTabs = gAllTabsOnDragReady.slice(0);
    allTabs.reverse();
    for (let tab of allTabs) {
      if (gSelectionState.has(tab.id))
        await browser.tabs.remove(tab.id);
    }
    clearSelection(aMessage.window);
    gSelectionState.clear();
  }
  else {
    browser.runtime.sendMessage(kTST_ID, {
      type: kTSTAPI_OPEN_CONTEXT_MENU,
      tab:  aMessage.tab && aMessage.tab.id,
      left: aMessage.clientX,
      top:  aMessage.clientY
    });
    // don't clear selection state until menu command is processed.
  }
  gUndeterminedRange.clear();
  gWillCloseSelectedTabs = false;
  gDragEnteredCount = 0;
  gAllTabsOnDragReady = [];
}


/*  listen events */

function onTSTAPIMessage(aMessage) {
  switch (aMessage.type) {
    case kTSTAPI_NOTIFY_READY:
      registerToTST();
      return Promise.resolve(true);

    case kTSTAPI_NOTIFY_TAB_CLICKED:
      return onTSTTabClick(aMessage);

    case kTSTAPI_NOTIFY_TABBAR_CLICKED:
      return onTSTTabbarClick(aMessage);

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
    type:  kTSTAPI_REGISTER_SELF,
    style: `
      .tab.selected::after {
        background: Highlight;
        bottom: 0;
        content: " ";
        display: block;
        left: 0;
        opacity: 0.5;
        pointer-events: none;
        position: absolute;
        right: 0;
        top: 0;
        z-index: 10;
      }

      /* ::after pseudo element prevents firing of dragstart event */
      .tab.ready-to-close .closebox {
        background: Highlight;
      }
    `
  });
}
browser.management.get(kTST_ID).then(registerToTST);

function wait(aTimeout) {
  return new Promise((aResolve, aReject) => {
    setTimeout(aResolve, aTimeout || 0);
  });
}

