/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as Constants from './constants.js';
import * as Permissions from './permissions.js';

import EventListenerManager from '../extlib/EventListenerManager.js';
import TabIdFixer from '../extlib/TabIdFixer.js';

export const onChange = new EventListenerManager();

let mTabs = {};
let mTargetWindow = null;
let mLastClickedTab = null;

export function serialize() {
  return {
    tabs: mTabs,
    targetWindow: mTargetWindow,
    lastClickedTab: mLastClickedTab
  };
}

export function apply(foreignSelection) {
  if ('tabs' in foreignSelection)
    mTabs = foreignSelection.tabs;
  if ('targetWindow' in foreignSelection)
    mTargetWindow = foreignSelection.targetWindow;
  if ('lastClickedTab' in foreignSelection)
    mLastClickedTab = foreignSelection.lastClickedTab;
}

export function set(tabs, selected, options = {}) {
  if (!Array.isArray(tabs))
    tabs = [tabs];

  const shouldHighlight = options.globalHighlight !== false;

  //console.log('setSelection ', ids, `${aState}=${selected}`);
  if (selected) {
    for (const tab of tabs) {
      if (tab.id in mTabs)
        continue;
      mTabs[tab.id] = tab;
      if (shouldHighlight &&
          Permissions.isPermittedTab(tab) &&
          !tab.pinned)
        Permissions.isGranted(Permissions.ALL_URLS).then(() => {
          browser.tabs.executeScript(tab.id, {
            code: `document.title = '✔' + document.title;`
          });
        });
    }
  }
  else {
    for (const tab of tabs) {
      if (!(tab.id in mTabs))
        continue;
      delete mTabs[tab.id];
      if (shouldHighlight &&
          Permissions.isPermittedTab(tab) &&
          !tab.pinned)
        Permissions.isGranted(Permissions.ALL_URLS).then(() => {
          browser.tabs.executeScript(tab.id, {
            code: `document.title = document.title.replace(/^✔/, '');`
          });
        });
    }
  }
  browser.runtime.sendMessage(Constants.kTST_ID, {
    type:  selected ? Constants.kTSTAPI_ADD_TAB_STATE : Constants.kTSTAPI_REMOVE_TAB_STATE,
    tabs:  tabs.map(tab => tab.id),
    state: options.states || options.state || 'selected'
  }).catch(_e => {}); // TST is not available
  onChange.dispatch(tabs, selected, options);
}

export function contains(tabOrTabId) {
  const id = TabIdFixer.fixTabId(typeof tabOrTabId == 'number' ? tabOrTabId : tabOrTabId.id);
  return id in mTabs;
}

export function has() {
  return count() > 0;
}

export function count() {
  return Object.keys(mTabs).length;
}

export async function getAllTabs(windowId) {
  const tabs = windowId || mTargetWindow ?
    await browser.tabs.query({ windowId: windowId || mTargetWindow }) :
    (await browser.windows.getCurrent({ populate: true })).tabs ;
  return tabs.map(TabIdFixer.fixTab);
}

export async function getAPITabSelection(params = {}) {
  const ids        = params.selectedIds || getSelectedTabIds();
  const selected   = [];
  const unselected = [];
  const tabs       = params.allTabs || await getAllTabs();
  for (const tab of tabs) {
    if (ids.indexOf(tab.id) < 0)
      unselected.push(tab);
    else
      selected.push(tab);
  }
  return { selected, unselected };
}

export function getSelectedTabs() {
  return Object.values(mTabs);
}

export function getSelectedTabIds() {
  return Object.keys(mTabs).map(id => parseInt(id));
}

export async function setAll(selected = true) {
  const tabs = await getAllTabs();
  set(tabs, selected);
}

export function setTargetWindow(windowId) {
  return mTargetWindow = windowId;
}

export function getTargetWindow() {
  return mTargetWindow;
}

export function setLastClickedTab(tab) {
  return mLastClickedTab = tab;
}

export function getLastClickedTab() {
  return mLastClickedTab;
}

export async function invert() {
  const tabs = await getAllTabs();
  const selectedIds = getSelectedTabIds();
  const newSelected = [];
  const oldSelected = [];
  for (const tab of tabs) {
    const toBeSelected = selectedIds.indexOf(tab.id) < 0;
    if (toBeSelected)
      newSelected.push(tab);
    else
      oldSelected.push(tab);
  }
  set(oldSelected, false);
  set(newSelected, true);
}

export function clear(options = {}) {
  const tabs = [];
  for (const id of Object.keys(mTabs)) {
    tabs.push(mTabs[id]);
  }
  set(tabs, false, options);
  mTabs = {};
  mTargetWindow = mLastClickedTab = null;
}
