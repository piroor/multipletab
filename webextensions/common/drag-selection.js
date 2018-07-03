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
  if (Commands.gDragSelection.firstHoverTarget) {
    const oldUndeterminedRange = Commands.gDragSelection.undeterminedRange;
    Commands.gDragSelection.undeterminedRange = {};

    let newUndeterminedRange = aParams.allTargets;
    if (newUndeterminedRange.every(aTab => aTab.id != Commands.gDragSelection.firstHoverTarget.id))
      newUndeterminedRange.push(Commands.gDragSelection.firstHoverTarget);

    let betweenTabs = getTabsBetween(Commands.gDragSelection.firstHoverTarget, aParams.target, Commands.gDragSelection.allTabsOnDragReady);
    newUndeterminedRange = newUndeterminedRange.concat(betweenTabs);

    const oldUndeterminedRangeIds = Object.keys(oldUndeterminedRange).map(aId => parseInt(aId));
    const newUndeterminedRangeIds = newUndeterminedRange.map(aTab => aTab.id);
    const outOfRangeTabIds = oldUndeterminedRangeIds.filter(aId => newUndeterminedRangeIds.indexOf(aId) < 0);
    for (let id of outOfRangeTabIds) {
      Commands.setSelection(oldUndeterminedRange[id], !(id in Commands.gSelection.tabs), {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: aParams.state
      });
    }

    for (let tab of newUndeterminedRange) {
      if (tab.id in Commands.gDragSelection.undeterminedRange)
        continue;
      Commands.gDragSelection.undeterminedRange[tab.id] = tab;
      if (oldUndeterminedRangeIds.indexOf(tab.id) > -1)
        continue;
      Commands.setSelection(tab, !(tab.id in Commands.gSelection.tabs), {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: aParams.state
      });
    }
  }
  else {
    for (let tab of aParams.allTargets) {
      Commands.gDragSelection.undeterminedRange[tab.id] = tab;
    }
    Commands.setSelection(aParams.allTargets, !(aParams.target.id in Commands.gSelection.tabs), {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: aParams.state
    });
  }
}


/* select tabs by clicking */

var gInSelectionSession = false;
var gLastClickedTab = null;

async function onTabItemClick(aMessage) {
  if (aMessage.button != 0)
    return false;

  var selected = false;
  {
    if (aMessage.tab.states)
      selected = aMessage.tab.states.indexOf('selected') > -1;
    else
      selected = !!Commands.gSelection.tabs[aMessage.tab.id];
  }

  var ctrlKeyPressed = aMessage.ctrlKey || (aMessage.metaKey && /^Mac/i.test(navigator.platform));
  if (!ctrlKeyPressed && !aMessage.shiftKey) {
    if (!selected) {
      Commands.clearSelection({
        states: ['selected', 'ready-to-close']
      });
      Commands.gSelection.clear();
    }
    gInSelectionSession = false;
    Commands.gSelection.lastClickedTab = null;
    return;
  }

  let lastActiveTab = aMessage.lastActiveTab || (await browser.tabs.query({
    active:   true,
    windowId: aMessage.window
  }))[0];
  if (lastActiveTab)
    TabIdFixer.fixTab(lastActiveTab);

  let tabs = retrieveTargetTabs(aMessage.tab);
  if (aMessage.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    let window = await browser.windows.get(aMessage.window, { populate: true });
    let betweenTabs = getTabsBetween(Commands.gSelection.lastClickedTab || lastActiveTab, aMessage.tab, window.tabs);
    tabs = tabs.concat(betweenTabs);
    tabs.push(Commands.gSelection.lastClickedTab || lastActiveTab);
    const selectedTabIds = tabs.map(aTab => aTab.id);
    if (!ctrlKeyPressed)
      Commands.setSelection(window.tabs.filter(aTab => selectedTabIds.indexOf(aTab.id) < 0), false, {
        globalHighlight: false
      });
    Commands.setSelection(tabs, true, {
      globalHighlight: false
    });
    gInSelectionSession = true;
    // Selection must include the active tab. This is the standard behavior on Firefox 62 and later.
    const newSelectedTabIds = Commands.getSelectedTabIds();
    if (newSelectedTabIds.length > 0 && !newSelectedTabIds.includes(lastActiveTab.id))
      browser.tabs.update(Commands.gSelection.lastClickedTab ? Commands.gSelection.lastClickedTab.id : newSelectedTabIds[0], { active: true });
    return true;
  }
  else if (ctrlKeyPressed) {
    // toggle selection of the tab and all collapsed descendants
    if (aMessage.tab.id != lastActiveTab.id &&
        !gInSelectionSession) {
      Commands.setSelection(lastActiveTab, true, {
        globalHighlight: false
      });
    }
    Commands.setSelection(tabs, !selected, {
      globalHighlight: false
    });
    // Selection must include the active tab. This is the standard behavior on Firefox 62 and later.
    const selectedTabIds = Commands.getSelectedTabIds();
    if (selectedTabIds.length > 0 && !selectedTabIds.includes(lastActiveTab.id))
      browser.tabs.update(selectedTabIds[0], { active: true });
    gInSelectionSession = true;
    Commands.gSelection.lastClickedTab = aMessage.tab;
    return true;
  }
  return false;
}

async function onTabItemMouseUp(aMessage) {
  if (aMessage.button != 0)
    return false;

  var ctrlKeyPressed = aMessage.ctrlKey || (aMessage.metaKey && /^Mac/i.test(navigator.platform));
  if (!ctrlKeyPressed &&
      !aMessage.shiftKey &&
      !Commands.gDragSelection.dragStartTarget) {
    Commands.clearSelection({
      states: ['selected', 'ready-to-close']
    });
    Commands.gSelection.clear();;
  }
}

async function onNonTabAreaClick(aMessage) {
  if (aMessage.button != 0)
    return;
  Commands.clearSelection({
    states: ['selected', 'ready-to-close']
  });
  Commands.gSelection.clear();;
}


/* select tabs by dragging */

async function onTabItemDragReady(aMessage) {
  //console.log('onTabItemDragReady', aMessage);
  Commands.gDragSelection.undeterminedRange = {};
  Commands.gSelection.targetWindow = aMessage.window;
  Commands.gDragSelection.dragEnteredCount = 1;
  Commands.gDragSelection.willCloseSelectedTabs = aMessage.startOnClosebox;
  Commands.gDragSelection.pendingTabs = null;
  Commands.gDragSelection.dragStartTarget = Commands.gDragSelection.firstHoverTarget = Commands.gDragSelection.lastHoverTarget = aMessage.tab;
  Commands.gDragSelection.allTabsOnDragReady = (await browser.tabs.query({ windowId: aMessage.window })).map(TabIdFixer.fixTab);

  Commands.clearSelection({
    states: ['selected', 'ready-to-close'],
    dontUpdateMenu: true
  });

  var startTabs = retrieveTargetTabs(aMessage.tab);
  Commands.setSelection(startTabs, true, {
    globalHighlight: false,
    dontUpdateMenu: true,
    state: Commands.gDragSelection.willCloseSelectedTabs ? 'ready-to-close' : 'selected'
  });

  for (let tab of startTabs) {
    Commands.gDragSelection.undeterminedRange[tab.id] = tab;
  }
}

async function onTabItemDragCancel(aMessage) {
  //console.log('onTabItemDragCancel', aMessage);
  if (Object.keys(Commands.gSelection.tabs).length > 0 &&
      window.onDragSelectionEnd) {
    onDragSelectionEnd(aMessage);
    // don't clear selection state until menu command is processed.
  }
  Commands.gDragSelection.clear();
}

async function onTabItemDragStart(aMessage) {
  //console.log('onTabItemDragStart', aMessage);
}

async function onTabItemDragEnter(aMessage) {
  //console.log('onTabItemDragEnter', aMessage, aMessage.tab == Commands.gDragSelection.lastHoverTarget);
  Commands.gDragSelection.dragEnteredCount++;
  // processAutoScroll(aEvent);

  if (Commands.gDragSelection.lastHoverTarget &&
      aMessage.tab.id == Commands.gDragSelection.lastHoverTarget.id)
    return;

  var state = Commands.gDragSelection.willCloseSelectedTabs ? 'ready-to-close' : 'selected' ;
  if (Commands.gDragSelection.pendingTabs) {
    Commands.setSelection(Commands.gDragSelection.pendingTabs, true, {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: state
    });
    Commands.gDragSelection.pendingTabs = null;
  }
  /*
  if (Commands.gDragSelection.willCloseSelectedTabs || tabDragMode == TAB_DRAG_MODE_SELECT) {
  */
  let targetTabs = retrieveTargetTabs(aMessage.tab);
  toggleStateOfDragOverTabs({
    target:     aMessage.tab,
    allTargets: targetTabs,
    state:      state
  });
  if (aMessage.tab.id == Commands.gDragSelection.dragStartTarget.id &&
      Object.keys(Commands.gSelection.tabs).length == targetTabs.length) {
    Commands.setSelection(targetTabs, false, {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: state
    });
    for (let tab of targetTabs) {
      Commands.gDragSelection.undeterminedRange[tab.id] = tab;
    }
    Commands.gDragSelection.pendingTabs = targetTabs;
  }
  /*
  }
  else { // TAB_DRAG_MODE_SWITCH:
    browser.tabs.update(aMessage.tab.id, { active: true });
  }
  */
  Commands.gDragSelection.lastHoverTarget = aMessage.tab;
  if (!Commands.gDragSelection.firstHoverTarget)
    Commands.gDragSelection.firstHoverTarget = Commands.gDragSelection.lastHoverTarget;
}

async function onTabItemDragExit(aMessage) {
  Commands.gDragSelection.dragEnteredCount--;
  dragExitAllWithDelay.reserve();
}

function dragExitAllWithDelay() {
  //console.log('dragExitAllWithDelay '+Commands.gDragSelection.dragEnteredCount);
  dragExitAllWithDelay.cancel();
  if (Commands.gDragSelection.dragEnteredCount <= 0) {
    Commands.gDragSelection.firstHoverTarget = Commands.gDragSelection.lastHoverTarget = null;
    Commands.gDragSelection.undeterminedRange = {};
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
  if (!configs.autoOpenMenuOnDragEnd)
    return;
  if (Commands.gDragSelection.willCloseSelectedTabs) {
    let allTabs = Commands.gDragSelection.allTabsOnDragReady.slice(0);
    allTabs.reverse();
    let toBeClosedIds = Commands.getSelectedTabIds();
    for (let tab of allTabs) {
      if (tab && toBeClosedIds.indexOf(tab.id) > -1)
        await browser.tabs.remove(tab.id);
    }
    Commands.clearSelection();
    Commands.gSelection.clear();
  }
  else if (Object.keys(Commands.gSelection.tabs).length > 0 &&
           window.onDragSelectionEnd) {
    onDragSelectionEnd(aMessage);
    // don't clear selection state until menu command is processed.
  }
  Commands.gDragSelection.clear();
}
