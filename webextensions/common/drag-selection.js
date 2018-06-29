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
  if (gDragSelection.firstHoverTarget) {
    const oldUndeterminedRange = gDragSelection.undeterminedRange;
    gDragSelection.undeterminedRange = {};

    let newUndeterminedRange = aParams.allTargets;
    if (newUndeterminedRange.every(aTab => aTab.id != gDragSelection.firstHoverTarget.id))
      newUndeterminedRange.push(gDragSelection.firstHoverTarget);

    let betweenTabs = getTabsBetween(gDragSelection.firstHoverTarget, aParams.target, gDragSelection.allTabsOnDragReady);
    newUndeterminedRange = newUndeterminedRange.concat(betweenTabs);

    const oldUndeterminedRangeIds = Object.keys(oldUndeterminedRange).map(aId => parseInt(aId));
    const newUndeterminedRangeIds = newUndeterminedRange.map(aTab => aTab.id);
    const outOfRangeTabIds = oldUndeterminedRangeIds.filter(aId => newUndeterminedRangeIds.indexOf(aId) < 0);
    for (let id of outOfRangeTabIds) {
      setSelection(oldUndeterminedRange[id], !(id in gSelection.tabs), {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: aParams.state
      });
    }

    for (let tab of newUndeterminedRange) {
      if (tab.id in gDragSelection.undeterminedRange)
        continue;
      gDragSelection.undeterminedRange[tab.id] = tab;
      if (oldUndeterminedRangeIds.indexOf(tab.id) > -1)
        continue;
      setSelection(tab, !(tab.id in gSelection.tabs), {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: aParams.state
      });
    }
  }
  else {
    for (let tab of aParams.allTargets) {
      gDragSelection.undeterminedRange[tab.id] = tab;
    }
    setSelection(aParams.allTargets, !(aParams.target.id in gSelection.tabs), {
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

  var selected = false;
  {
    if (aMessage.tab.states)
      selected = aMessage.tab.states.indexOf('selected') > -1;
    else
      selected = !!gSelection.tabs[aMessage.tab.id];
  }

  var ctrlKeyPressed = aMessage.ctrlKey || (aMessage.metaKey && /^Mac/i.test(navigator.platform));
  if (!ctrlKeyPressed && !aMessage.shiftKey) {
    if (!selected) {
      clearSelection({
        states: ['selected', 'ready-to-close']
      });
      gSelection.targetWindow = null;
    }
    gInSelectionSession = false;
    return;
  }

  let lastActiveTab = aMessage.lastActiveTab || (await browser.tabs.query({
    active:   true,
    windowId: aMessage.window
  }))[0];
  if (lastActiveTab)
    TabIdFixer.fixTab(lastActiveTab);

  let tabs = retrieveTargetTabs(aMessage.tab);
  if (ctrlKeyPressed) {
    // toggle selection of the tab and all collapsed descendants
    if (aMessage.tab.id != lastActiveTab.id &&
        !gInSelectionSession) {
      setSelection(lastActiveTab, true, {
        globalHighlight: false
      });
    }
    setSelection(tabs, !selected, {
      globalHighlight: false
    });
    // Selection must include the active tab. This is the standard behavior on Firefox 62 and later.
    if (!aMessage.tab.active && !getSelectedTabIds().includes(lastActiveTab.id)) {
      browser.tabs.update(aMessage.tab.id, { active: true });
    }
    else if (aMessage.tab.active && selected) {
      const selectedTabIds = getSelectedTabIds();
      if (selectedTabIds.length > 0)
        browser.tabs.update(selectedTabIds[0], { active: true });
    }
    gInSelectionSession = true;
    return true;
  }
  else if (aMessage.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    let window = await browser.windows.get(aMessage.window, { populate: true });
    let betweenTabs = getTabsBetween(lastActiveTab, aMessage.tab, window.tabs);
    tabs = tabs.concat(betweenTabs);
    tabs.push(lastActiveTab);
    const selectedTabIds = tabs.map(aTab => aTab.id);
    setSelection(window.tabs.filter(aTab => selectedTabIds.indexOf(aTab.id) < 0), false, {
      globalHighlight: false
    });
    setSelection(tabs, true, {
      globalHighlight: false
    });
    gInSelectionSession = true;
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
      !gDragSelection.dragStartTarget) {
    clearSelection({
      states: ['selected', 'ready-to-close']
    });
    gSelection.targetWindow = null;
  }
}

async function onNonTabAreaClick(aMessage) {
  if (aMessage.button != 0)
    return;
  clearSelection({
    states: ['selected', 'ready-to-close']
  });
  gSelection.targetWindow = null;
}


/* select tabs by dragging */

var gDragSelection = {
  willCloseSelectedTabs: false,
  allTabsOnDragReady:    [],
  pendingTabs:           null,
  dragStartTarget:       null,
  lastHoverTarget:       null,
  firstHoverTarget:      null,
  undeterminedRange:     {},
  dragEnteredCount:      0,
  clear() {
    this.dragStartTarget = this.firstHoverTarget = this.lastHoverTarget = null;
    this.undeterminedRange = {};
    this.willCloseSelectedTabs = false;
    this.dragEnteredCount = 0;
    this.allTabsOnDragReady = [];
  },
  export() {
    const exported = {};
    for (let key of Object.keys(this)) {
      if (typeof this[key] != 'function')
        exported[key] = this[key];
    }
    return exported;
  },
  apply(aForeignSession) {
    for (let key of Object.keys(aForeignSession)) {
      if (typeof this[key] != 'function')
        this[key] = aForeignSession[key];
    }
  }
};

async function onTabItemDragReady(aMessage) {
  //console.log('onTabItemDragReady', aMessage);
  gDragSelection.undeterminedRange = {};
  gSelection.targetWindow = aMessage.window;
  gDragSelection.dragEnteredCount = 1;
  gDragSelection.willCloseSelectedTabs = aMessage.startOnClosebox;
  gDragSelection.pendingTabs = null;
  gDragSelection.dragStartTarget = gDragSelection.firstHoverTarget = gDragSelection.lastHoverTarget = aMessage.tab;
  gDragSelection.allTabsOnDragReady = (await browser.tabs.query({ windowId: aMessage.window })).map(TabIdFixer.fixTab);

  clearSelection({
    states: ['selected', 'ready-to-close'],
    dontUpdateMenu: true
  });

  var startTabs = retrieveTargetTabs(aMessage.tab);
  setSelection(startTabs, true, {
    globalHighlight: false,
    dontUpdateMenu: true,
    state: gDragSelection.willCloseSelectedTabs ? 'ready-to-close' : 'selected'
  });

  for (let tab of startTabs) {
    gDragSelection.undeterminedRange[tab.id] = tab;
  }
}

async function onTabItemDragCancel(aMessage) {
  //console.log('onTabItemDragCancel', aMessage);
  if (Object.keys(gSelection.tabs).length > 0 &&
      window.onDragSelectionEnd) {
    onDragSelectionEnd(aMessage);
    // don't clear selection state until menu command is processed.
  }
  gDragSelection.clear();
}

async function onTabItemDragStart(aMessage) {
  //console.log('onTabItemDragStart', aMessage);
}

async function onTabItemDragEnter(aMessage) {
  //console.log('onTabItemDragEnter', aMessage, aMessage.tab == gDragSelection.lastHoverTarget);
  gDragSelection.dragEnteredCount++;
  // processAutoScroll(aEvent);

  if (gDragSelection.lastHoverTarget &&
      aMessage.tab.id == gDragSelection.lastHoverTarget.id)
    return;

  var state = gDragSelection.willCloseSelectedTabs ? 'ready-to-close' : 'selected' ;
  if (gDragSelection.pendingTabs) {
    setSelection(gDragSelection.pendingTabs, true, {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: state
    });
    gDragSelection.pendingTabs = null;
  }
  /*
  if (gDragSelection.willCloseSelectedTabs || tabDragMode == TAB_DRAG_MODE_SELECT) {
  */
  let targetTabs = retrieveTargetTabs(aMessage.tab);
  toggleStateOfDragOverTabs({
    target:     aMessage.tab,
    allTargets: targetTabs,
    state:      state
  });
  if (aMessage.tab.id == gDragSelection.dragStartTarget.id &&
      Object.keys(gSelection.tabs).length == targetTabs.length) {
    setSelection(targetTabs, false, {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: state
    });
    for (let tab of targetTabs) {
      gDragSelection.undeterminedRange[tab.id] = tab;
    }
    gDragSelection.pendingTabs = targetTabs;
  }
  /*
  }
  else { // TAB_DRAG_MODE_SWITCH:
    browser.tabs.update(aMessage.tab.id, { active: true });
  }
  */
  gDragSelection.lastHoverTarget = aMessage.tab;
  if (!gDragSelection.firstHoverTarget)
    gDragSelection.firstHoverTarget = gDragSelection.lastHoverTarget;
}

async function onTabItemDragExit(aMessage) {
  gDragSelection.dragEnteredCount--;
  dragExitAllWithDelay.reserve();
}

function dragExitAllWithDelay() {
  //console.log('dragExitAllWithDelay '+gDragSelection.dragEnteredCount);
  dragExitAllWithDelay.cancel();
  if (gDragSelection.dragEnteredCount <= 0) {
    gDragSelection.firstHoverTarget = gDragSelection.lastHoverTarget = null;
    gDragSelection.undeterminedRange = {};
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
  if (gDragSelection.willCloseSelectedTabs) {
    let allTabs = gDragSelection.allTabsOnDragReady.slice(0);
    allTabs.reverse();
    let toBeClosedIds = getSelectedTabIds();
    for (let tab of allTabs) {
      if (tab && toBeClosedIds.indexOf(tab.id) > -1)
        await browser.tabs.remove(tab.id);
    }
    clearSelection();
    gSelection.targetWindow = null;
  }
  else if (Object.keys(gSelection.tabs).length > 0 &&
           window.onDragSelectionEnd) {
    onDragSelectionEnd(aMessage);
    // don't clear selection state until menu command is processed.
  }
  gDragSelection.clear();
}
