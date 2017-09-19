/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

/* utilities */

function retrieveTargetTabs(aSerializedTab) {
  var tabs = [aSerializedTab];
  if (aSerializedTab.children &&
      aSerializedTab.states.indexOf('subtree-collapsed') > -1) {
    for (let tab of aSerializedTab.children) {
      tabs = tabs.concat(retrieveTargetTabs(tab))
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
    for (let id of Object.keys(gUndeterminedRange)) {
      setSelection(gUndeterminedRange[id], !(id in gSelectedTabs), {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: aParams.state
      });
    }
    gUndeterminedRange = {};

    let newUndeterminedRange = aParams.allTargets;
    if (newUndeterminedRange.every(aTab => aTab.id != gFirstHoverTarget.id))
      newUndeterminedRange.push(gFirstHoverTarget);

    let betweenTabs = getTabsBetween(gFirstHoverTarget, aParams.target, gAllTabsOnDragReady);
    newUndeterminedRange = newUndeterminedRange.concat(betweenTabs);
    for (let tab of newUndeterminedRange) {
      if (tab.id in gUndeterminedRange)
        continue;
      setSelection(tab, !(tab.id in gSelectedTabs), {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: aParams.state
      });
      gUndeterminedRange[tab.id] = tab;
    }
  }
  else {
    for (let tab of aParams.allTargets) {
      gUndeterminedRange[tab.id] = tab;
    }
    setSelection(aParams.allTargets, !(aParams.target.id in gSelectedTabs), {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: aParams.state
    });
  }
}


/* select tabs by clicking */

var gInSelectionSession = false;

async function onTabItemClick(aMessage) {
  if (aMessage.button != 0)
    return false;

  if (!aMessage.ctrlKey && !aMessage.shiftKey) {
    clearSelection({
      states: ['selected', 'ready-to-close']
    });
    gTargetWindow = null;
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
      setSelection(activeTab, true, {
        globalHighlight: false
      });
    }
    setSelection(tabs, aMessage.tab.states.indexOf('selected') < 0, {
      globalHighlight: false
    });
    gInSelectionSession = true;
    return true;
  }
  else if (aMessage.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    clearSelection();
    let window = await browser.windows.get(aMessage.window, { populate: true });
    let betweenTabs = getTabsBetween(activeTab, aMessage.tab, window.tabs);
    tabs = tabs.concat(betweenTabs);
    tabs.push(activeTab);
    setSelection(tabs, true, {
      globalHighlight: false
    });
    gInSelectionSession = true;
    return true;
  }
  return false;
}

async function onNonTabAreaClick(aMessage) {
  if (aMessage.button != 0)
    return;
  clearSelection({
    states: ['selected', 'ready-to-close']
  });
  gTargetWindow = null;
}


/* select tabs by dragging */

var gWillCloseSelectedTabs = false;
var gAllTabsOnDragReady = [];
var gPendingTabs = null;
var gDragStartTarget = null;
var gLastHoverTarget = null;
var gFirstHoverTarget = null;
var gUndeterminedRange = {};
var gDragEnteredCount = 0;

async function onTabItemDragReady(aMessage) {
  //console.log('onTabItemDragReady', aMessage);
  gUndeterminedRange = {};
  gTargetWindow = aMessage.window;
  gDragEnteredCount = 1;
  gWillCloseSelectedTabs = aMessage.startOnClosebox;
  gPendingTabs = null;
  gDragStartTarget = gFirstHoverTarget = gLastHoverTarget = aMessage.tab;
  gAllTabsOnDragReady = await browser.tabs.query({ windowId: aMessage.window });

  clearSelection({
    states: ['selected', 'ready-to-close'],
    dontUpdateMenu: true
  });

  var startTabs = retrieveTargetTabs(aMessage.tab);
  setSelection(startTabs, true, {
    globalHighlight: false,
    dontUpdateMenu: true,
    state: gWillCloseSelectedTabs ? 'ready-to-close' : 'selected'
  });

  for (let tab of startTabs) {
    gUndeterminedRange[tab.id] = tab;
  }
}

async function onTabItemDragStart(aMessage) {
  //console.log('onTabItemDragStart', aMessage);
}

async function onTabItemDragEnter(aMessage) {
  //console.log('onTabItemDragEnter', aMessage, aMessage.tab == gLastHoverTarget);
  gDragEnteredCount++;
  // processAutoScroll(aEvent);

  if (gLastHoverTarget &&
      aMessage.tab.id == gLastHoverTarget.id)
    return;

  var state = gWillCloseSelectedTabs ? 'ready-to-close' : 'selected' ;
  if (gPendingTabs) {
    setSelection(gPendingTabs, true, {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: state
    });
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
    if (aMessage.tab.id == gDragStartTarget.id &&
        Object.keys(gSelectedTabs).length == targetTabs.length) {
      setSelection(targetTabs, false, {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: state
      });
      for (let tab of targetTabs) {
        gUndeterminedRange[tab.id] = tab;
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

async function onTabItemDragExit(aMessage) {
  gDragEnteredCount--;
  dragExitAllWithDelay.reserve();
}

function dragExitAllWithDelay() {
  //console.log('dragExitAllWithDelay '+gDragEnteredCount);
  dragExitAllWithDelay.cancel();
  if (gDragEnteredCount <= 0) {
    gFirstHoverTarget = gLastHoverTarget = null;
    gUndeterminedRange = {};
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

async function onTabItemDragEnd(aMessage) {
  //console.log('onTabItemDragEnd', aMessage);
  if (gWillCloseSelectedTabs) {
    let allTabs = gAllTabsOnDragReady.slice(0);
    allTabs.reverse();
    for (let tab of allTabs) {
      if (tab.id in gSelectedTabs)
        await browser.tabs.remove(tab.id);
    }
    clearSelection();
    gTargetWindow = null;
  }
  else if (Object.keys(gSelectedTabs).length > 0 &&
           window.onDragSelectionEnd) {
    onDragSelectionEnd(aMessage);
    // don't clear selection state until menu command is processed.
  }
  gDragStartTarget = gFirstHoverTarget = gLastHoverTarget = null;
  gUndeterminedRange = {};
  gWillCloseSelectedTabs = false;
  gDragEnteredCount = 0;
  gAllTabsOnDragReady = [];
}
