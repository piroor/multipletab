/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

export async function getActiveWindow() {
  return browser.windows.getLastFocused({ populate: true });
}

export async function getAllTabs(windowId) {
  if (!windowId)
    windowId = (await getActiveWindow()).id;
  return browser.tabs.query({ windowId });
}

export async function getSelection(windowId) {
  if (!windowId)
    windowId = (await getActiveWindow()).id;
  return browser.tabs.query({ windowId, highlighted: true });
}

export async function getSelectionAndOthers(windowId) {
  if (!windowId)
    windowId = (await getActiveWindow()).id;
  const [allTabs, selectedTabs] = await Promise.all([
    getAllTabs(windowId),
    getSelection(windowId)
  ]);
  const selectedTabIds = selectedTabs.map(tab => tab.id);
  return {
    selected:   selectedTabs,
    unselected: allTabs.filter(tab => !selectedTabIds.includes(tab.id))
  };
}

export async function clear(windowId) {
  if (!windowId)
    windowId = (await getActiveWindow()).id;
  const activeTabs = await browser.tabs.query({ windowId, active: true });
  return browser.tabs.highlight({
    windowId,
    tabs: activeTabs.map(tab => tab.index)
  });
}

export async function select(tabsOrTab) {
  if (!tabsOrTab)
    return Promise.resolve();
  if (Array.isArray(tabsOrTab)) {
    return browser.tabs.highlight({
      windowId: tabsOrTab[0].windowId,
      tabs:     tabsOrTab.map(tab => tab.index)
    });
  }
  else {
    return browser.tabs.update(tabsOrTab.id, {
      highlighted: true,
      active:      tabsOrTab.active
    });
  }
}

export async function unselect(tabsOrTab) {
  if (!tabsOrTab)
    return Promise.resolve();
  if (Array.isArray(tabsOrTab)) {
    const selectedTabs = await getSelection(tabsOrTab[0].windowId);
    const tabIds       = tabsOrTab.map(tab => tab.id);
    return browser.tabs.highlight({
      windowId: tabsOrTab[0].windowId,
      tabs:     selectedTabs.filter(tab => !tabIds.includes(tab.id)).map(tab => tab.index)
    });
  }
  else {
    return browser.tabs.update(tabsOrTab.id, {
      highlighted: false,
      active:      tabsOrTab.active
    });
  }
}

export async function selectAll(windowId) {
  if (!windowId)
    windowId = (await getActiveWindow()).id;
  const tabs = await getAllTabs(windowId);
  return browser.tabs.highlight({
    windowId,
    tabs: tabs.map(tab => tab.index)
  });
}

export async function toggle(tab) {
  if (!tab)
    return Promise.resolve();
  return browser.tabs.update(tab.id, {
    highlighted: !tab.highlighted,
    active:      tab.active
  });
}

export async function invert(windowId) {
  if (!windowId)
    windowId = (await getActiveWindow()).id;
  const selection = await getSelectionAndOthers(windowId);
  return browser.tabs.highlight({
    windowId,
    tabs: selection.unselected.map(tab => tab.index)
  });
}

export async function notifyTabStateToTST(tabIdOrTabIds, state, value) {
}
