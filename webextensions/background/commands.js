/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var gSelectedTabs = {};
var gTargetWindow = null;

function clearSelection(aOptions = {}) {
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
  var tabs = await getAllTabs(); // because given ids are possibly unsorted.
  for (let tab of tabs.reverse()) { // close down to top, to keep tree structure of Tree Style Tab
    if (aIds.indexOf(tab.id) > -1)
      await browser.tabs.remove(tab.id);
  }
}

async function removeOtherTabs(aIds) {
  var tabs = await getAllTabs(); // because given ids are possibly unsorted.
  for (let tab of tabs.reverse()) { // close down to top, to keep tree structure of Tree Style Tab
    if (aIds.indexOf(tab.id) < 0)
      await browser.tabs.remove(tab.id);
  }
}

async function copyToClipboard(aIds, aFormat) {
  var tabs = await getAllTabs();
  tabs = tabs.filter(aTab => aIds.indexOf(aTab.id) > -1);
  var converter;
  switch (aFormat) {
    default:
    case 'url':
      converter = (aTab) => aTab.url;
      break;
    case 'title-and-url':
      converter = (aTab) => `${aTab.title}\n${aTab.url}`;
      break;
    case 'html-link':
      converter = (aTab) => `<a title="${sanitizeHtmlText(aTab.title)}" href="${sanitizeHtmlText(aTab.url)}">${sanitizeHtmlText(aTab.title)}</a>`;
      break;
  }
  var dataToCopy = (await Promise.all(tabs.map(converter))).join('\n');
  if (tabs.length > 1)
    dataToCopy += '\n';
  browser.tabs.executeScript(tabs[0].id, {
    /* Due to Firefox's limitation, we cannot copy text from background script.
       https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Interact_with_the_clipboard#Browser-specific_considerations
       Moreover, when this command is called from context menu on a tab,
       there is no browser_action page.
       Thus we need to embed text field into webpage and execute a command to copy,
       but scripts in the webpage can steal the data - that's crazy and dangerous! */
    code: `
      var field = document.createElement('textarea');
      field.value = ${JSON.stringify(dataToCopy)};
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.parentNode.removeChild(field);
    `
  });
}

function sanitizeHtmlText(aText) {
  return aText.replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
}

async function saveTabs(aIds) {
  var tabs = await getAllTabs();
  var prefix = 'saved-tabs/'; // this should be customizable
  for (let tab of tabs) {
    if (aIds.indexOf(tab.id) > -1)
      browser.downloads.download({
        url:      tab.url,
        filename: `${prefix}${suggestFileNameForTab(tab)}`
      });
  }
}

function suggestFileNameForTab(aTab) {
  var fileNameMatch = aTab.url.replace(/^\w+:\/\/[^\/]+\//, '') // remove origin part
                              .replace(/#.*$/, '') // remove fragment
                              .replace(/\?.*$/, '') // remove query
                              .match(/([^\/]+\.([^\.\/]+))$/);
  // we should suggest filename from content type, but currently simply use the filename except "html" case.
  if (fileNameMatch &&
      !/html?/i.test(fileNameMatch[1]))
    return fileNameMatch[1];
  // webpages (text/html, application/xhtml+xml, etc.) should have the page title as the filename
  return `${aTab.title.replace(/\//g, '_')}.html`;
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
