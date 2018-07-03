/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs
} from './common.js';
import * as Commands from './commands.js';
import {
  selection as mSelection,
  dragSelection as mDragSelection
} from './selections.js';
import EventListenerManager from './EventListenerManager.js';
import TabIdFixer from '../extlib/TabIdFixer.js';

export const onDragSelectionEnd = new EventListenerManager();

/* utilities */

export function retrieveTargetTabs(aSerializedTab) {
  let tabs = [aSerializedTab];
  if (aSerializedTab.children &&
      aSerializedTab.states.indexOf('subtree-collapsed') > -1) {
    for (const tab of aSerializedTab.children) {
      tabs = tabs.concat(retrieveTargetTabs(tab))
    }
  }
  return tabs;
}

export function getTabsBetween(aBegin, aEnd, aAllTabs = []) {
  if (aBegin.id == aEnd.id)
    return [];
  let inRange = false;
  return aAllTabs.filter(aTab => {
    if (aTab.id == aBegin.id || aTab.id == aEnd.id) {
      inRange = !inRange;
      return false;
    }
    return inRange;
  });
}

export function toggleStateOfDragOverTabs(aParams = {}) {
  if (mDragSelection.firstHoverTarget) {
    const oldUndeterminedRange = mDragSelection.undeterminedRange;
    mDragSelection.undeterminedRange = {};

    let newUndeterminedRange = aParams.allTargets;
    if (newUndeterminedRange.every(aTab => aTab.id != mDragSelection.firstHoverTarget.id))
      newUndeterminedRange.push(mDragSelection.firstHoverTarget);

    const betweenTabs = getTabsBetween(mDragSelection.firstHoverTarget, aParams.target, mDragSelection.allTabsOnDragReady);
    newUndeterminedRange = newUndeterminedRange.concat(betweenTabs);

    const oldUndeterminedRangeIds = Object.keys(oldUndeterminedRange).map(aId => parseInt(aId));
    const newUndeterminedRangeIds = newUndeterminedRange.map(aTab => aTab.id);
    const outOfRangeTabIds = oldUndeterminedRangeIds.filter(aId => newUndeterminedRangeIds.indexOf(aId) < 0);
    for (const id of outOfRangeTabIds) {
      Commands.setSelection(oldUndeterminedRange[id], !(id in mSelection.tabs), {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: aParams.state
      });
    }

    for (const tab of newUndeterminedRange) {
      if (tab.id in mDragSelection.undeterminedRange)
        continue;
      mDragSelection.undeterminedRange[tab.id] = tab;
      if (oldUndeterminedRangeIds.indexOf(tab.id) > -1)
        continue;
      Commands.setSelection(tab, !(tab.id in mSelection.tabs), {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: aParams.state
      });
    }
  }
  else {
    for (const tab of aParams.allTargets) {
      mDragSelection.undeterminedRange[tab.id] = tab;
    }
    Commands.setSelection(aParams.allTargets, !(aParams.target.id in mSelection.tabs), {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: aParams.state
    });
  }
}


/* select tabs by clicking */

let gInSelectionSession = false;

export async function onTabItemClick(aMessage) {
  if (aMessage.button != 0)
    return false;

  let selected = false;
  {
    if (aMessage.tab.states)
      selected = aMessage.tab.states.indexOf('selected') > -1;
    else
      selected = !!mSelection.tabs[aMessage.tab.id];
  }

  const ctrlKeyPressed = aMessage.ctrlKey || (aMessage.metaKey && /^Mac/i.test(navigator.platform));
  if (!ctrlKeyPressed && !aMessage.shiftKey) {
    if (!selected) {
      Commands.clearSelection({
        states: ['selected', 'ready-to-close']
      });
      mSelection.clear();
    }
    gInSelectionSession = false;
    mSelection.lastClickedTab = null;
    return;
  }

  const lastActiveTab = aMessage.lastActiveTab || (await browser.tabs.query({
    active:   true,
    windowId: aMessage.window
  }))[0];
  if (lastActiveTab)
    TabIdFixer.fixTab(lastActiveTab);

  let tabs = retrieveTargetTabs(aMessage.tab);
  if (aMessage.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    const window = await browser.windows.get(aMessage.window, { populate: true });
    const betweenTabs = getTabsBetween(mSelection.lastClickedTab || lastActiveTab, aMessage.tab, window.tabs);
    tabs = tabs.concat(betweenTabs);
    tabs.push(mSelection.lastClickedTab || lastActiveTab);
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
      browser.tabs.update(mSelection.lastClickedTab ? mSelection.lastClickedTab.id : newSelectedTabIds[0], { active: true });
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
    mSelection.lastClickedTab = aMessage.tab;
    return true;
  }
  return false;
}

export async function onTabItemMouseUp(aMessage) {
  if (aMessage.button != 0)
    return false;

  const ctrlKeyPressed = aMessage.ctrlKey || (aMessage.metaKey && /^Mac/i.test(navigator.platform));
  if (!ctrlKeyPressed &&
      !aMessage.shiftKey &&
      !mDragSelection.dragStartTarget) {
    Commands.clearSelection({
      states: ['selected', 'ready-to-close']
    });
    mSelection.clear();;
  }
}

export async function onNonTabAreaClick(aMessage) {
  if (aMessage.button != 0)
    return;
  Commands.clearSelection({
    states: ['selected', 'ready-to-close']
  });
  mSelection.clear();;
}


/* select tabs by dragging */

export async function onTabItemDragReady(aMessage) {
  //console.log('onTabItemDragReady', aMessage);
  mDragSelection.undeterminedRange = {};
  mSelection.targetWindow = aMessage.window;
  mDragSelection.dragEnteredCount = 1;
  mDragSelection.willCloseSelectedTabs = aMessage.startOnClosebox;
  mDragSelection.pendingTabs = null;
  mDragSelection.dragStartTarget = mDragSelection.firstHoverTarget = mDragSelection.lastHoverTarget = aMessage.tab;
  mDragSelection.allTabsOnDragReady = (await browser.tabs.query({ windowId: aMessage.window })).map(TabIdFixer.fixTab);

  Commands.clearSelection({
    states: ['selected', 'ready-to-close'],
    dontUpdateMenu: true
  });

  const startTabs = retrieveTargetTabs(aMessage.tab);
  Commands.setSelection(startTabs, true, {
    globalHighlight: false,
    dontUpdateMenu: true,
    state: mDragSelection.willCloseSelectedTabs ? 'ready-to-close' : 'selected'
  });

  for (const tab of startTabs) {
    mDragSelection.undeterminedRange[tab.id] = tab;
  }
}

export async function onTabItemDragCancel(aMessage) {
  //console.log('onTabItemDragCancel', aMessage);
  if (Object.keys(mSelection.tabs).length > 0) {
    onDragSelectionEnd.dispatch(aMessage);
    // don't clear selection state until menu command is processed.
  }
  mDragSelection.clear();
}

export async function onTabItemDragStart(_message) {
  //console.log('onTabItemDragStart', aMessage);
}

export async function onTabItemDragEnter(aMessage) {
  //console.log('onTabItemDragEnter', aMessage, aMessage.tab == mDragSelection.lastHoverTarget);
  mDragSelection.dragEnteredCount++;
  // processAutoScroll(aEvent);

  if (mDragSelection.lastHoverTarget &&
      aMessage.tab.id == mDragSelection.lastHoverTarget.id)
    return;

  const state = mDragSelection.willCloseSelectedTabs ? 'ready-to-close' : 'selected' ;
  if (mDragSelection.pendingTabs) {
    Commands.setSelection(mDragSelection.pendingTabs, true, {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: state
    });
    mDragSelection.pendingTabs = null;
  }
  /*
  if (mDragSelection.willCloseSelectedTabs || tabDragMode == TAB_DRAG_MODE_SELECT) {
  */
  const targetTabs = retrieveTargetTabs(aMessage.tab);
  toggleStateOfDragOverTabs({
    target:     aMessage.tab,
    allTargets: targetTabs,
    state:      state
  });
  if (aMessage.tab.id == mDragSelection.dragStartTarget.id &&
      Object.keys(mSelection.tabs).length == targetTabs.length) {
    Commands.setSelection(targetTabs, false, {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: state
    });
    for (const tab of targetTabs) {
      mDragSelection.undeterminedRange[tab.id] = tab;
    }
    mDragSelection.pendingTabs = targetTabs;
  }
  /*
  }
  else { // TAB_DRAG_MODE_SWITCH:
    browser.tabs.update(aMessage.tab.id, { active: true });
  }
  */
  mDragSelection.lastHoverTarget = aMessage.tab;
  if (!mDragSelection.firstHoverTarget)
    mDragSelection.firstHoverTarget = mDragSelection.lastHoverTarget;
}

export async function onTabItemDragExit(_message) {
  mDragSelection.dragEnteredCount--;
  dragExitAllWithDelay.reserve();
}

export function dragExitAllWithDelay() {
  //console.log('dragExitAllWithDelay '+mDragSelection.dragEnteredCount);
  dragExitAllWithDelay.cancel();
  if (mDragSelection.dragEnteredCount <= 0) {
    mDragSelection.firstHoverTarget = mDragSelection.lastHoverTarget = null;
    mDragSelection.undeterminedRange = {};
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

export async function onTabItemDragEnd(aMessage) {
  //console.log('onTabItemDragEnd', aMessage);
  if (!configs.autoOpenMenuOnDragEnd)
    return;
  if (mDragSelection.willCloseSelectedTabs) {
    const allTabs = mDragSelection.allTabsOnDragReady.slice(0);
    allTabs.reverse();
    const toBeClosedIds = Commands.getSelectedTabIds();
    for (const tab of allTabs) {
      if (tab && toBeClosedIds.indexOf(tab.id) > -1)
        await browser.tabs.remove(tab.id);
    }
    Commands.clearSelection();
    mSelection.clear();
  }
  else if (Object.keys(mSelection.tabs).length > 0 &&
           window.onDragSelectionEnd) {
    onDragSelectionEnd(aMessage);
    // don't clear selection state until menu command is processed.
  }
  mDragSelection.clear();
}
