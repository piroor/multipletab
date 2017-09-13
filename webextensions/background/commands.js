/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var gSelectedTabs = {};
var gTargetWindow = null;

function clearSelection(aWindowId, aState) {
  gSelectedTabs = {};
  gTargetWindow = null;
  browser.runtime.sendMessage(kTST_ID, {
    type:   kTSTAPI_REMOVE_TAB_STATE,
    tabs:   '*',
    window: aWindowId,
    state:  aState || 'selected'
  });
}

function setSelection(aTabs, aSelected, aState) {
  if (!Array.isArray(aTabs))
    aTabs = [aTabs];

  //console.log('setSelection ', ids, `${aState}=${aSelected}`);
  if (aSelected) {
    for (let tab of aTabs) {
      gSelectedTabs[tab.id] = tab;
    }
  }
  else {
    for (let tab of aTabs) {
      delete gSelectedTabs[tab.id];
    }
  }
  browser.runtime.sendMessage(kTST_ID, {
    type:  aSelected ? kTSTAPI_ADD_TAB_STATE : kTSTAPI_REMOVE_TAB_STATE,
    tabs:  aTabs.map(aTab => aTab.id),
    state: aState || 'selected'
  });
}

async function reloadSelectedTabs() {
  for (let id of getSelectedTabIds()) {
    browser.tabs.reload(id);
  }
}

function getSelectedTabIds() {
  return Object.keys(gSelectedTabs).map(aId => parseInt(aId));
}

async function duplicateSelectedTabs() {
  for (let id of getSelectedTabIds()) {
    await browser.tabs.duplicate(id);
  }
}

async function pinSelectedTabs() {
  for (let id of getSelectedTabIds()) {
    await browser.tabs.update(id, { pinned: true });
  }
}

async function unpinSelectedTabs() {
  for (let id of getSelectedTabIds()) {
    await browser.tabs.update(id, { pinned: false });
  }
}

async function muteSelectedTabs() {
  for (let id of getSelectedTabIds()) {
    browser.tabs.update(id, { muted: true });
  }
}

async function unmuteSelectedTabs() {
  for (let id of getSelectedTabIds()) {
    browser.tabs.update(id, { muted: false });
  }
}

async function removeSelectedTabs() {
  var tabs = gTargetWindow ?
               await browser.tabs.query({ windowId: gTargetWindow }) :
               (await browser.windows.getCurrent({ populate: true })).tabs ;
  var selectedIds = getSelectedTabIds();
  for (let tab of tabs.reverse()) {
    if (selectedIds.indexOf(tab.id) > -1)
      await browser.tabs.remove(tab.id);
  }
}

async function removeUnselectedTabs() {
  var tabs = gTargetWindow ?
               await browser.tabs.query({ windowId: gTargetWindow }) :
               (await browser.windows.getCurrent({ populate: true })).tabs ;
  var selectedIds = getSelectedTabIds();
  for (let tab of tabs.reverse()) {
    if (selectedIds.indexOf(tab.id) < 0)
      await browser.tabs.remove(tab.id);
  }
}

async function invertSelection() {
  var tabs = gTargetWindow ?
               await browser.tabs.query({ windowId: gTargetWindow }) :
               (await browser.windows.getCurrent({ populate: true })).tabs ;
  var selectedIds = getSelectedTabIds();
  gSelectedTabs = {};
  var newSelected = [];
  var oldSelected = [];
  for (let tab of tabs) {
    let toBeSelected = selectedIds.indexOf(tab.id) < 0;
    if (toBeSelected) {
      gSelectedTabs[tab.id] = tab;
      newSelected.push(tab);
    }
    else {
      oldSelected.push(tab);
    }
  }
  setSelection(oldSelected, false);
  setSelection(newSelected, true);
}
