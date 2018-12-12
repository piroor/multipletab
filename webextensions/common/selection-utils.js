/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs,
  handleMissingReceiverError
} from './common.js';
import * as Constants from './constants.js';

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
  const [activeTabs, selectedTabs] = await Promise.all([
    browser.tabs.query({ windowId, active: true }),
    getSelection(windowId)
  ]);
  await Promise.all([
    notifyTabStateToTST(selectedTabs.map(tab => tab.id), Constants.kSELECTED, false),
    browser.tabs.highlight({
      windowId: windowId,
      tabs:     activeTabs.map(tab => tab.index)
    })
  ]);
}

export async function select(tabsOrTab) {
  if (!tabsOrTab)
    return;
  if (Array.isArray(tabsOrTab)) {
    if (tabsOrTab.length === 0)
      return;
    const tabIds = tabsOrTab.map(tab => tab.id);
    const selection = await getSelectionAndOthers(tabsOrTab[0].windowId);
    const toBeUnselected = selection.selected.filter(tab => !tabIds.includes(tab.id));
    const toBeSelected = selection.unselected.filter(tab => tabIds.includes(tab.id));
    await Promise.all([
      notifyTabStateToTST(toBeUnselected.map(tab => tab.id), Constants.kSELECTED, false),
      notifyTabStateToTST(toBeSelected.map(tab => tab.id), Constants.kSELECTED, true),
      browser.tabs.highlight({
        windowId: tabsOrTab[0].windowId,
        tabs:     tabsOrTab.map(tab => tab.index)
      })
    ]);
  }
  else {
    await Promise.all([
      notifyTabStateToTST(tabsOrTab.id, Constants.kSELECTED, true),
      await browser.tabs.update(tabsOrTab.id, {
        highlighted: true,
        active:      tabsOrTab.active
      })
    ]);
  }
}

export async function unselect(tabsOrTab) {
  if (!tabsOrTab)
    return;
  if (Array.isArray(tabsOrTab)) {
    if (tabsOrTab.length === 0)
      return;
    const selectedTabs = await getSelection(tabsOrTab[0].windowId);
    const tabIds       = tabsOrTab.map(tab => tab.id);
    await Promise.all([
      notifyTabStateToTST(tabIds, Constants.kSELECTED, false),
      browser.tabs.highlight({
        windowId: tabsOrTab[0].windowId,
        tabs:     selectedTabs.filter(tab => !tabIds.includes(tab.id)).map(tab => tab.index)
      })
    ]);
  }
  else {
    await Promise.all([
      notifyTabStateToTST(tabsOrTab.map(tab => tab.id), Constants.kSELECTED, false),
      browser.tabs.update(tabsOrTab.id, {
        highlighted: false,
        active:      tabsOrTab.active
      })
    ]);
  }
}

export async function selectAll(windowId) {
  if (!windowId)
    windowId = (await getActiveWindow()).id;
  const tabs = await getAllTabs(windowId);
  return select(tabs);
}

export async function toggle(tab) {
  if (!tab)
    return;
  if (tab.highlighted)
    return unselect(tab);
  else
    return select(tab);
}

export async function invert(windowId) {
  if (!windowId)
    windowId = (await getActiveWindow()).id;
  const selection = await getSelectionAndOthers(windowId);
  await Promise.all([
    notifyTabStateToTST(selection.selected.map(tab => tab.id), Constants.kSELECTED, false),
    notifyTabStateToTST(selection.unselected.map(tab => tab.id), Constants.kSELECTED, true),
    browser.tabs.highlight({
      windowId: windowId,
      tabs:     selection.unselected.map(tab => tab.index)
    })
  ]);
}

export async function notifyTabStateToTST(tabIds, state, value) {
  if (!Array.isArray(tabIds))
    tabIds = [tabIds];
  if (!configs.enableIntegrationWithTST ||
      tabIds.length == 0)
    return;

  browser.runtime.sendMessage(Constants.kTST_ID, {
    type:  value ? Constants.kTSTAPI_ADD_TAB_STATE : Constants.kTSTAPI_REMOVE_TAB_STATE,
    tabs:  tabIds,
    state: state
  }).catch(handleMissingReceiverError);
}
