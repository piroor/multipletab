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
import * as Selections from './selections.js';
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
  if (Selections.dragSelection.firstHoverTarget) {
    const oldUndeterminedRange = Selections.dragSelection.undeterminedRange;
    Selections.dragSelection.undeterminedRange = {};

    let newUndeterminedRange = params.allTargets;
    if (newUndeterminedRange.every(tab => tab.id != Selections.dragSelection.firstHoverTarget.id))
      newUndeterminedRange.push(Selections.dragSelection.firstHoverTarget);

    const betweenTabs = getTabsBetween(Selections.dragSelection.firstHoverTarget, params.target, Selections.dragSelection.allTabsOnDragReady);
    newUndeterminedRange = newUndeterminedRange.concat(betweenTabs);

    const oldUndeterminedRangeIds = Object.keys(oldUndeterminedRange).map(id => parseInt(id));
    const newUndeterminedRangeIds = newUndeterminedRange.map(tab => tab.id);
    const outOfRangeTabIds = oldUndeterminedRangeIds.filter(id => newUndeterminedRangeIds.indexOf(id) < 0);
    for (const id of outOfRangeTabIds) {
      Commands.setSelection(oldUndeterminedRange[id], !(id in Selections.selection.tabs), {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: params.state
      });
    }

    for (const tab of newUndeterminedRange) {
      if (tab.id in Selections.dragSelection.undeterminedRange)
        continue;
      Selections.dragSelection.undeterminedRange[tab.id] = tab;
      if (oldUndeterminedRangeIds.indexOf(tab.id) > -1)
        continue;
      Commands.setSelection(tab, !(tab.id in Selections.selection.tabs), {
        globalHighlight: false,
        dontUpdateMenu: true,
        state: params.state
      });
    }
  }
  else {
    for (const tab of params.allTargets) {
      Selections.dragSelection.undeterminedRange[tab.id] = tab;
    }
    Commands.setSelection(params.allTargets, !(params.target.id in Selections.selection.tabs), {
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
      selected = !!Selections.selection.tabs[message.tab.id];
  }

  const ctrlKeyPressed = message.ctrlKey || (message.metaKey && /^Mac/i.test(navigator.platform));
  if (!ctrlKeyPressed && !message.shiftKey) {
    if (!selected) {
      Commands.clearSelection({
        states: ['selected', 'ready-to-close']
      });
      Selections.selection.clear();
    }
    gInSelectionSession = false;
    Selections.selection.lastClickedTab = null;
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
    const betweenTabs = getTabsBetween(Selections.selection.lastClickedTab || lastActiveTab, message.tab, window.tabs);
    tabs = tabs.concat(betweenTabs);
    tabs.push(Selections.selection.lastClickedTab || lastActiveTab);
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
      browser.tabs.update(Selections.selection.lastClickedTab ? Selections.selection.lastClickedTab.id : newSelectedTabIds[0], { active: true });
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
    Selections.selection.lastClickedTab = message.tab;
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
      !Selections.dragSelection.dragStartTarget) {
    Commands.clearSelection({
      states: ['selected', 'ready-to-close']
    });
    Selections.selection.clear();;
  }
}

export async function onNonTabAreaClick(message) {
  if (message.button != 0)
    return;
  Commands.clearSelection({
    states: ['selected', 'ready-to-close']
  });
  Selections.selection.clear();;
}


/* select tabs by dragging */

export async function onTabItemDragReady(message) {
  //console.log('onTabItemDragReady', message);
  Selections.dragSelection.undeterminedRange = {};
  Selections.selection.targetWindow = message.window;
  Selections.dragSelection.dragEnteredCount = 1;
  Selections.dragSelection.willCloseSelectedTabs = message.startOnClosebox;
  Selections.dragSelection.pendingTabs = null;
  Selections.dragSelection.dragStartTarget = Selections.dragSelection.firstHoverTarget = Selections.dragSelection.lastHoverTarget = message.tab;
  Selections.dragSelection.allTabsOnDragReady = (await browser.tabs.query({ windowId: message.window })).map(TabIdFixer.fixTab);

  Commands.clearSelection({
    states: ['selected', 'ready-to-close'],
    dontUpdateMenu: true
  });

  const startTabs = retrieveTargetTabs(message.tab);
  Commands.setSelection(startTabs, true, {
    globalHighlight: false,
    dontUpdateMenu: true,
    state: Selections.dragSelection.willCloseSelectedTabs ? 'ready-to-close' : 'selected'
  });

  for (const tab of startTabs) {
    Selections.dragSelection.undeterminedRange[tab.id] = tab;
  }
}

export async function onTabItemDragCancel(message) {
  //console.log('onTabItemDragCancel', message);
  if (Object.keys(Selections.selection.tabs).length > 0) {
    onDragSelectionEnd.dispatch(message);
    // don't clear selection state until menu command is processed.
  }
  Selections.dragSelection.clear();
}

export async function onTabItemDragStart(_message) {
  //console.log('onTabItemDragStart', message);
}

export async function onTabItemDragEnter(message) {
  //console.log('onTabItemDragEnter', message, message.tab == Selections.dragSelection.lastHoverTarget);
  Selections.dragSelection.dragEnteredCount++;
  // processAutoScroll(event);

  if (Selections.dragSelection.lastHoverTarget &&
      message.tab.id == Selections.dragSelection.lastHoverTarget.id)
    return;

  const state = Selections.dragSelection.willCloseSelectedTabs ? 'ready-to-close' : 'selected' ;
  if (Selections.dragSelection.pendingTabs) {
    Commands.setSelection(Selections.dragSelection.pendingTabs, true, {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: state
    });
    Selections.dragSelection.pendingTabs = null;
  }
  /*
  if (Selections.dragSelection.willCloseSelectedTabs || tabDragMode == TAB_DRAG_MODE_SELECT) {
  */
  const targetTabs = retrieveTargetTabs(message.tab);
  toggleStateOfDragOverTabs({
    target:     message.tab,
    allTargets: targetTabs,
    state:      state
  });
  if (message.tab.id == Selections.dragSelection.dragStartTarget.id &&
      Object.keys(Selections.selection.tabs).length == targetTabs.length) {
    Commands.setSelection(targetTabs, false, {
      globalHighlight: false,
      dontUpdateMenu: true,
      state: state
    });
    for (const tab of targetTabs) {
      Selections.dragSelection.undeterminedRange[tab.id] = tab;
    }
    Selections.dragSelection.pendingTabs = targetTabs;
  }
  /*
  }
  else { // TAB_DRAG_MODE_SWITCH:
    browser.tabs.update(message.tab.id, { active: true });
  }
  */
  Selections.dragSelection.lastHoverTarget = message.tab;
  if (!Selections.dragSelection.firstHoverTarget)
    Selections.dragSelection.firstHoverTarget = Selections.dragSelection.lastHoverTarget;
}

export async function onTabItemDragExit(_message) {
  Selections.dragSelection.dragEnteredCount--;
  dragExitAllWithDelay.reserve();
}

function dragExitAllWithDelay() {
  //console.log('dragExitAllWithDelay '+Selections.dragSelection.dragEnteredCount);
  dragExitAllWithDelay.cancel();
  if (Selections.dragSelection.dragEnteredCount <= 0) {
    Selections.dragSelection.firstHoverTarget = Selections.dragSelection.lastHoverTarget = null;
    Selections.dragSelection.undeterminedRange = {};
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
  if (Selections.dragSelection.willCloseSelectedTabs) {
    const allTabs = Selections.dragSelection.allTabsOnDragReady.slice(0);
    allTabs.reverse();
    const toBeClosedIds = Commands.getSelectedTabIds();
    for (const tab of allTabs) {
      if (tab && toBeClosedIds.indexOf(tab.id) > -1)
        await browser.tabs.remove(tab.id);
    }
    Commands.clearSelection();
    Selections.selection.clear();
  }
  else if (Object.keys(Selections.selection.tabs).length > 0 &&
           window.onDragSelectionEnd) {
    onDragSelectionEnd(message);
    // don't clear selection state until menu command is processed.
  }
  Selections.dragSelection.clear();
}
