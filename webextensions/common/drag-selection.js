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
import EventListenerManager from '../extlib/EventListenerManager.js';
import TabIdFixer from '../extlib/TabIdFixer.js';

export const onDragSelectionEnd = new EventListenerManager();

/* utilities */

function retrieveTargetTabs(serializedTab) {
  let tabs = [serializedTab];
  if (serializedTab.children &&
      serializedTab.states.indexOf('subtree-collapsed') > -1) {
    for (const tab of serializedTab.children) {
      tabs = tabs.concat(retrieveTargetTabs(tab))
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
  if (mDragSelection.firstHoverTarget) {
    const oldUndeterminedRange = mDragSelection.undeterminedRange;
    mDragSelection.undeterminedRange = {};

    let newUndeterminedRange = params.allTargets;
    if (newUndeterminedRange.every(tab => tab.id != mDragSelection.firstHoverTarget.id))
      newUndeterminedRange.push(mDragSelection.firstHoverTarget);

    const betweenTabs = getTabsBetween(mDragSelection.firstHoverTarget, params.target, mDragSelection.allTabsOnDragReady);
    newUndeterminedRange = newUndeterminedRange.concat(betweenTabs);

    const oldUndeterminedRangeIds = Object.keys(oldUndeterminedRange).map(id => parseInt(id));
    const newUndeterminedRangeIds = newUndeterminedRange.map(tab => tab.id);
    const outOfRangeTabIds = oldUndeterminedRangeIds.filter(id => newUndeterminedRangeIds.indexOf(id) < 0);
    for (const id of outOfRangeTabIds) {
      Commands.setSelection(oldUndeterminedRange[id], !(id in mSelection.tabs), {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: params.state
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
        state: params.state
      });
    }
  }
  else {
    for (const tab of params.allTargets) {
      mDragSelection.undeterminedRange[tab.id] = tab;
    }
    Commands.setSelection(params.allTargets, !(params.target.id in mSelection.tabs), {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: params.state
    });
  }
}


/* select tabs by clicking */

let gInSelectionSession = false;

export async function onTabItemClick(message) {
  if (message.button != 0)
    return false;

  let selected = false;
  {
    if (message.tab.states)
      selected = message.tab.states.indexOf('selected') > -1;
    else
      selected = !!mSelection.tabs[message.tab.id];
  }

  const ctrlKeyPressed = message.ctrlKey || (message.metaKey && /^Mac/i.test(navigator.platform));
  if (!ctrlKeyPressed && !message.shiftKey) {
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

  const lastActiveTab = message.lastActiveTab || (await browser.tabs.query({
    active:   true,
    windowId: message.window
  }))[0];
  if (lastActiveTab)
    TabIdFixer.fixTab(lastActiveTab);

  let tabs = retrieveTargetTabs(message.tab);
  if (message.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    const window = await browser.windows.get(message.window, { populate: true });
    const betweenTabs = getTabsBetween(mSelection.lastClickedTab || lastActiveTab, message.tab, window.tabs);
    tabs = tabs.concat(betweenTabs);
    tabs.push(mSelection.lastClickedTab || lastActiveTab);
    const selectedTabIds = tabs.map(tab => tab.id);
    if (!ctrlKeyPressed)
      Commands.setSelection(window.tabs.filter(tab => selectedTabIds.indexOf(tab.id) < 0), false, {
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
    if (message.tab.id != lastActiveTab.id &&
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
    mSelection.lastClickedTab = message.tab;
    return true;
  }
  return false;
}

export async function onTabItemMouseUp(message) {
  if (message.button != 0)
    return false;

  const ctrlKeyPressed = message.ctrlKey || (message.metaKey && /^Mac/i.test(navigator.platform));
  if (!ctrlKeyPressed &&
      !message.shiftKey &&
      !mDragSelection.dragStartTarget) {
    Commands.clearSelection({
      states: ['selected', 'ready-to-close']
    });
    mSelection.clear();;
  }
}

export async function onNonTabAreaClick(message) {
  if (message.button != 0)
    return;
  Commands.clearSelection({
    states: ['selected', 'ready-to-close']
  });
  mSelection.clear();;
}


/* select tabs by dragging */

export async function onTabItemDragReady(message) {
  //console.log('onTabItemDragReady', message);
  mDragSelection.undeterminedRange = {};
  mSelection.targetWindow = message.window;
  mDragSelection.dragEnteredCount = 1;
  mDragSelection.willCloseSelectedTabs = message.startOnClosebox;
  mDragSelection.pendingTabs = null;
  mDragSelection.dragStartTarget = mDragSelection.firstHoverTarget = mDragSelection.lastHoverTarget = message.tab;
  mDragSelection.allTabsOnDragReady = (await browser.tabs.query({ windowId: message.window })).map(TabIdFixer.fixTab);

  Commands.clearSelection({
    states: ['selected', 'ready-to-close'],
    dontUpdateMenu: true
  });

  const startTabs = retrieveTargetTabs(message.tab);
  Commands.setSelection(startTabs, true, {
    globalHighlight: false,
    dontUpdateMenu: true,
    state: mDragSelection.willCloseSelectedTabs ? 'ready-to-close' : 'selected'
  });

  for (const tab of startTabs) {
    mDragSelection.undeterminedRange[tab.id] = tab;
  }
}

export async function onTabItemDragCancel(message) {
  //console.log('onTabItemDragCancel', message);
  if (Object.keys(mSelection.tabs).length > 0) {
    onDragSelectionEnd.dispatch(message);
    // don't clear selection state until menu command is processed.
  }
  mDragSelection.clear();
}

export async function onTabItemDragStart(_message) {
  //console.log('onTabItemDragStart', message);
}

export async function onTabItemDragEnter(message) {
  //console.log('onTabItemDragEnter', message, message.tab == mDragSelection.lastHoverTarget);
  mDragSelection.dragEnteredCount++;
  // processAutoScroll(event);

  if (mDragSelection.lastHoverTarget &&
      message.tab.id == mDragSelection.lastHoverTarget.id)
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
  const targetTabs = retrieveTargetTabs(message.tab);
  toggleStateOfDragOverTabs({
    target:     message.tab,
    allTargets: targetTabs,
    state:      state
  });
  if (message.tab.id == mDragSelection.dragStartTarget.id &&
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
    browser.tabs.update(message.tab.id, { active: true });
  }
  */
  mDragSelection.lastHoverTarget = message.tab;
  if (!mDragSelection.firstHoverTarget)
    mDragSelection.firstHoverTarget = mDragSelection.lastHoverTarget;
}

export async function onTabItemDragExit(_message) {
  mDragSelection.dragEnteredCount--;
  dragExitAllWithDelay.reserve();
}

function dragExitAllWithDelay() {
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

export async function onTabItemDragEnd(message) {
  //console.log('onTabItemDragEnd', message);
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
    onDragSelectionEnd(message);
    // don't clear selection state until menu command is processed.
  }
  mDragSelection.clear();
}
