/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var gSelectedTabs = {};
var gTargetWindow = null;

function clearSelection(aWindowId, aOptions = {}) {
  var tabs = [];
  for (let id of Object.keys(gSelectedTabs)) {
    tabs.push(gSelectedTabs[id]);
  }
  setSelection(tabs, false, aOptions);
  gTargetWindow = null;
}

function isPermittedTab(aTab) {
  return /^about:blank($|\?|#)/.test(aTab.url) ||
         !/^(about|resource|chrome|file):/.test(aTab.url);
}

function setSelection(aTabs, aSelected, aOptions = {}) {
  if (!Array.isArray(aTabs))
    aTabs = [aTabs];

  var shouldHighlight = aOptions.globalHighlight !== false;

  //console.log('setSelection ', ids, `${aState}=${aSelected}`);
  if (aSelected) {
    for (let tab of aTabs) {
      if (tab.id in gSelectedTabs)
        continue;
      gSelectedTabs[tab.id] = tab;
      try {
        if (shouldHighlight && isPermittedTab(tab))
          browser.tabs.executeScript(tab.id, {
            code: `document.title = '✔' + document.title;`
          });
      }
      catch(e){
        console.log(e);
      }
    }
  }
  else {
    for (let tab of aTabs) {
      if (!(tab.id in gSelectedTabs))
        continue;
      delete gSelectedTabs[tab.id];
      try {
        if (shouldHighlight && isPermittedTab(tab))
          browser.tabs.executeScript(tab.id, {
            code: `document.title = document.title.replace(/^✔/, '');`
          });
      }
      catch(e){
        console.log(e);
      }
    }
  }
  browser.runtime.sendMessage(kTST_ID, {
    type:  aSelected ? kTSTAPI_ADD_TAB_STATE : kTSTAPI_REMOVE_TAB_STATE,
    tabs:  aTabs.map(aTab => aTab.id),
    state: aOptions.states || aOptions.state || 'selected'
  });
}

async function getAllTabs() {
  return gTargetWindow ?
           await browser.tabs.query({ windowId: gTargetWindow }) :
           (await browser.windows.getCurrent({ populate: true })).tabs ;
}

function getSelectedTabIds() {
  return Object.keys(gSelectedTabs).map(aId => parseInt(aId));
}

async function reloadTabs(aIds) {
  for (let id of aIds) {
    browser.tabs.reload(id);
  }
}

async function duplicateTabs(aIds) {
  for (let id of aIds) {
    await browser.tabs.duplicate(id);
  }
}

async function pinTabs(aIds) {
  for (let id of aIds) {
    await browser.tabs.update(id, { pinned: true });
  }
}

async function unpinTabs(aIds) {
  for (let id of aIds) {
    await browser.tabs.update(id, { pinned: false });
  }
}

async function muteTabs(aIds) {
  for (let id of aIds) {
    browser.tabs.update(id, { muted: true });
  }
}

async function unmuteTabs(aIds) {
  for (let id of aIds) {
    browser.tabs.update(id, { muted: false });
  }
}

async function removeTabs(aIds) {
  var tabs = await getAllTabs();
  for (let tab of tabs.reverse()) {
    if (aIds.indexOf(tab.id) > -1)
      await browser.tabs.remove(tab.id);
  }
}

async function removeOtherTabs(aIds) {
  var tabs = await getAllTabs();
  for (let tab of tabs.reverse()) {
    if (aIds.indexOf(tab.id) < 0)
      await browser.tabs.remove(tab.id);
  }
}

async function selectAllTabs() {
  var tabs = await getAllTabs();
  setSelection(tabs, true);
}

async function invertSelection() {
  var tabs = await getAllTabs();
  var selectedIds = getSelectedTabIds();
  var newSelected = [];
  var oldSelected = [];
  for (let tab of tabs) {
    let toBeSelected = selectedIds.indexOf(tab.id) < 0;
    if (toBeSelected)
      newSelected.push(tab);
    else
      oldSelected.push(tab);
  }
  setSelection(oldSelected, false);
  setSelection(newSelected, true);
}
