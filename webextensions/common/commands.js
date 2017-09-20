/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var gSelection = {
  tabs:         {},
  targetWindow: null
};

function clearSelection(aOptions = {}) {
  var tabs = [];
  for (let id of Object.keys(gSelection.tabs)) {
    tabs.push(gSelection.tabs[id]);
  }
  setSelection(tabs, false, aOptions);
  gSelection.targetWindow = null;
}

function isPermittedTab(aTab) {
  if (aTab.discarded)
    return false;
  return /^about:blank($|\?|#)/.test(aTab.url) ||
         !/^(about|resource|chrome|file|view-source):/.test(aTab.url);
}

function setSelection(aTabs, aSelected, aOptions = {}) {
  if (!Array.isArray(aTabs))
    aTabs = [aTabs];

  var shouldHighlight = aOptions.globalHighlight !== false;

  //console.log('setSelection ', ids, `${aState}=${aSelected}`);
  if (aSelected) {
    for (let tab of aTabs) {
      if (tab.id in gSelection.tabs)
        continue;
      gSelection.tabs[tab.id] = tab;
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
      if (!(tab.id in gSelection.tabs))
        continue;
      delete gSelection.tabs[tab.id];
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
  if (!aOptions.dontUpdateMenu)
    reserveRefreshContextMenuItems();
}

async function getAllTabs() {
  return gSelection.targetWindow ?
           await browser.tabs.query({ windowId: gSelection.targetWindow }) :
           (await browser.windows.getCurrent({ populate: true })).tabs ;
}

function getSelectedTabIds() {
  return Object.keys(gSelection.tabs).map(aId => parseInt(aId));
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
  var allTabs = await getAllTabs();
  var tabs = allTabs.filter(aTab => aIds.indexOf(aTab.id) > -1);
  var delimiter = configs.useCRLF ? '\r\n' : '\n' ;
  var dataToCopy = (await Promise.all(tabs.map(aTab => fillPlaceHolders(aFormat, aTab)))).join(delimiter);
  if (tabs.length > 1)
    dataToCopy += delimiter;

  var permittedTabs = tabs.filter(isPermittedTab);
  if (permittedTabs.length == 0) {
    permittedTabs = allTabs.filter(isPermittedTab);
    if (permittedTabs.length == 0)
      throw new Error('no permitted tab to copy data to the clipboard');
  }
  browser.tabs.executeScript(permittedTabs[0].id, {
    /* Due to Firefox's limitation, we cannot copy text from background script.
       Moreover, when this command is called from context menu on a tab,
       there is no browser_action page.
       Thus we need to embed text field into webpage and execute a command to copy,
       but scripts in the webpage can steal the data - that's crazy and dangerous!
       See also:
        https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Interact_with_the_clipboard#Browser-specific_considerations
        https://bugzilla.mozilla.org/show_bug.cgi?id=1272869
        https://bugzilla.mozilla.org/show_bug.cgi?id=1344410
    */
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

function fillPlaceHolders(aFormat, aTab) {
  var delimiter = configs.useCRLF ? '\r\n' : '\n' ;
  return aFormat
           .replace(/%URL%/gi, aTab.url)
           .replace(/%TITLE%/gi, aTab.title)
           .replace(/%URL_HTML(?:IFIED)?%/gi, sanitizeHtmlText(aTab.url))
           .replace(/%TITLE_HTML(?:IFIED)?%/gi, sanitizeHtmlText(aTab.title))
           .replace(/%EOL%/gi, delimiter);
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
