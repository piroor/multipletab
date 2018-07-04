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

export const selection = {
  tabs:         {},
  targetWindow: null,
  lastClickedTab: null,
  clear() {
    this.tabs = {};
    this.targetWindow = this.lastClickedTab = null;
  },
  export() {
    const exported = {};
    for (const key of Object.keys(this)) {
      if (typeof this[key] != 'function')
        exported[key] = this[key];
    }
    return exported;
  },
  apply(foreignSession) {
    for (const key of Object.keys(foreignSession)) {
      if (typeof this[key] != 'function')
        this[key] = foreignSession[key];
    }
  }
};

export function serialize() {
  return selection.export();
}

export function apply(foreignSelection) {
  return selection.apply(foreignSelection);
}

export function set(tabs, selected, options = {}) {
  if (!Array.isArray(tabs))
    tabs = [tabs];

  const shouldHighlight = options.globalHighlight !== false;

  //console.log('setSelection ', ids, `${aState}=${selected}`);
  if (selected) {
    for (const tab of tabs) {
      if (tab.id in selection.tabs)
        continue;
      selection.tabs[tab.id] = tab;
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
      if (!(tab.id in selection.tabs))
        continue;
      delete selection.tabs[tab.id];
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
  return id in selection.tabs;
}

export function has() {
  return count() > 0;
}

export function count() {
  return Object.keys(selection.tabs).length;
}

export async function getAllTabs(windowId) {
  const tabs = windowId || selection.targetWindow ?
    await browser.tabs.query({ windowId: windowId || selection.targetWindow }) :
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
  return Object.values(selection.tabs);
}

export function getSelectedTabIds() {
  return Object.keys(selection.tabs).map(id => parseInt(id));
}

export async function setAll(selected = true) {
  const tabs = await getAllTabs();
  set(tabs, selected);
}

export function setTargetWindow(windowId) {
  return selection.targetWindow = windowId;
}

export function getTargetWindow() {
  return selection.targetWindow;
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
  for (const id of Object.keys(selection.tabs)) {
    tabs.push(selection.tabs[id]);
  }
  set(tabs, false, options);
  selection.clear();
}
