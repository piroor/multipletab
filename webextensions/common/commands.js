/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  wait,
  notify,
  configs
} from './common.js';
import * as Constants from './constants.js';
import {
  selection as mSelection,
  dragSelection as mDragSelection
} from './selections.js';
import EventListenerManager from '../extlib/EventListenerManager.js';
import TabIdFixer from '../extlib/TabIdFixer.js';

export const onSelectionChange = new EventListenerManager();

export function clearSelection(options = {}) {
  const tabs = [];
  for (const id of Object.keys(mSelection.tabs)) {
    tabs.push(mSelection.tabs[id]);
  }
  setSelection(tabs, false, options);
  mSelection.clear();
}

function isPermittedTab(tab) {
  if (tab.discarded)
    return false;
  return /^about:blank($|\?|#)/.test(tab.url) ||
         !/^(about|resource|chrome|file|view-source):/.test(tab.url);
}

export function setSelection(tabs, selected, options = {}) {
  if (!Array.isArray(tabs))
    tabs = [tabs];

  const shouldHighlight = options.globalHighlight !== false;

  //console.log('setSelection ', ids, `${aState}=${selected}`);
  if (selected) {
    for (const tab of tabs) {
      if (tab.id in mSelection.tabs)
        continue;
      mSelection.tabs[tab.id] = tab;
      if (shouldHighlight &&
          isPermittedTab(tab) &&
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
      if (!(tab.id in mSelection.tabs))
        continue;
      delete mSelection.tabs[tab.id];
      if (shouldHighlight &&
          isPermittedTab(tab) &&
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
  onSelectionChange.dispatch(tabs, selected, options);
}


export function reservePushSelectionState() {
  if (reservePushSelectionState.reserved)
    clearTimeout(reservePushSelectionState.reserved);
  reservePushSelectionState.reserved = setTimeout(() => {
    pushSelectionState();
  }, 150);
}

export async function pushSelectionState(options = {}) {
  if (reservePushSelectionState.reserved) {
    clearTimeout(reservePushSelectionState.reserved);
    delete reservePushSelectionState.reserved;
  }
  await browser.runtime.sendMessage({
    type:          Constants.kCOMMAND_PUSH_SELECTION_INFO,
    selection:     mSelection.export(),
    dramSelection: mDragSelection.export(),
    updateMenu:    !!options.updateMenu,
    contextTab:    options.contextTab
  });
}


export async function getAllTabs(windowId) {
  const tabs = windowId || mSelection.targetWindow ?
    await browser.tabs.query({ windowId: windowId || mSelection.targetWindow }) :
    (await browser.windows.getCurrent({ populate: true })).tabs ;
  return tabs.map(TabIdFixer.fixTab);
}

export function getSelectedTabIds() {
  return Object.keys(mSelection.tabs).map(id => parseInt(id));
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


export async function reloadTabs(ids) {
  for (const id of ids) {
    browser.tabs.reload(id);
  }
}

export async function bookmarkTabs(ids, options = {}) {
  if (!(await Permissions.isGranted(Permissions.BOOKMARKS))) {
    notify({
      title:   browser.i18n.getMessage('notPermitted_bookmarks_title'),
      message: browser.i18n.getMessage('notPermitted_bookmarks_message')
    });
    return null;
  }

  const tabs = await Promise.all(ids.map(id => browser.tabs.get(id)));
  tabs.forEach(TabIdFixer.fixTab);
  const folderParams = {
    title: browser.i18n.getMessage('bookmarkFolder_label', tabs[0].title)
  };
  if (options.parentId) {
    folderParams.parentId = options.parentId;
    if ('index' in options)
      folderParams.index = options.index;
  }
  const folder = await browser.bookmarks.create(folderParams);
  for (let i = 0, maxi = tabs.length; i < maxi; i++) {
    const tab = tabs[i];
    await browser.bookmarks.create({
      parentId: folder.id,
      index:    i,
      title:    tab.title,
      url:      tab.url
    });
  }

  browser.bookmarks.get(folder.parentId).then(folders => {
    notify({
      title:   browser.i18n.getMessage('bookmarkTabs_notification_title'),
      message: browser.i18n.getMessage('bookmarkTabs_notification_message', [
        tabs[0].title,
        tabs.length,
        folders[0].title
      ]),
      icon:    Constants.kNOTIFICATION_DEFAULT_ICON
    });
  });
  return folder;
}

export async function duplicateTabs(ids) {
  for (const id of ids) {
    await browser.tabs.duplicate(id);
  }
}

export async function pinTabs(ids) {
  for (const id of ids) {
    await browser.tabs.update(id, { pinned: true });
  }
}

export async function unpinTabs(ids) {
  for (const id of ids) {
    await browser.tabs.update(id, { pinned: false });
  }
}

export async function muteTabs(ids) {
  for (const id of ids) {
    browser.tabs.update(id, { muted: true });
  }
}

export async function unmuteTabs(ids) {
  for (const id of ids) {
    browser.tabs.update(id, { muted: false });
  }
}

export async function moveToWindow(ids, windowId) {
  const structure = await browser.runtime.sendMessage(Constants.kTST_ID, {
    type: Constants.kTSTAPI_GET_TREE_STRUCTURE,
    tabs: ids
  }).catch(_e => {}); // TST is not available
  log('structure ', structure);
  const firstTab = ids[0];
  let window;
  if (windowId) {
    window = await browser.windows.get(windowId);
  }
  else {
    window = await browser.windows.create({
      tabId: firstTab
    });
    ids = ids.slice(1);
  }
  await browser.runtime.sendMessage(Constants.kTST_ID, {
    type:   Constants.kTSTAPI_BLOCK_GROUPING,
    window: window.id
  }).catch(_e => {}); // TST is not available
  const waitUntilCompletelyMoved = new Promise((resolve, _reject) => {
    let restTabs = ids.length - 1;
    const listener = (_tabId, _attachInfo) => {
      restTabs--;
      if (restTabs <= 0) {
        browser.tabs.onAttached.removeListener(listener);
        resolve();
      }
    };
    browser.tabs.onAttached.addListener(listener);
  });
  await Promise.all([
    safeMoveApiTabsAcrossWindows(ids, {
      index:    1,
      windowId: window.id
    }),
    waitUntilCompletelyMoved
  ]);
  await browser.tabs.update(firstTab, { active: true });
  if (structure) {
    await wait(500); // wait until TST's initialization is finished
    await browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_SET_TREE_STRUCTURE,
      tabs: ids,
      structure
    }).catch(_e => {}); // TST is not available
  }
  await browser.runtime.sendMessage(Constants.kTST_ID, {
    type:   Constants.kTSTAPI_UNBLOCK_GROUPING,
    window: window.id
  }).catch(_e => {}); // TST is not available
}

// workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1394477
export async function safeMoveApiTabsAcrossWindows(aTabIds, moveOptions) {
  return (await Promise.all(aTabIds.map(async (aTabId, index) => {
    try {
      let movedTab = await browser.tabs.move(aTabId, Object.assign({}, moveOptions, {
        index: moveOptions.index + index
      }));
      if (Array.isArray(movedTab))
        movedTab = movedTab[0];
      return movedTab;
    }
    catch(_e) {
      return null;
    }
  }))).filter(tab => !!tab);
}

export async function removeTabs(removeIds) {
  const tabs = await getAllTabs(); // because given ids are possibly unsorted.
  // close down to top, to keep tree structure of Tree Style Tab
  const ids = tabs.reverse().filter(tab => removeIds.indexOf(tab.id) > -1).map(tab => tab.id);
  await browser.tabs.remove(ids);
}

export async function removeOtherTabs(keepIds) {
  const tabs = await getAllTabs(); // because given ids are possibly unsorted.
  // close down to top, to keep tree structure of Tree Style Tab
  const ids = tabs.reverse().filter(tab => keepIds.indexOf(tab.id) < 0 && !tab.pinned).map(tab => tab.id);
  await browser.tabs.remove(ids);
}

const kFORMAT_PARAMETER_MATCHER  = /\([^\)]+\)|\[[^\]]+\]|\{[^\}]+\}|<[^>]+>/g;
const kFORMAT_MATCHER_TST_INDENT = new RegExp(`%TST_INDENT(?:${kFORMAT_PARAMETER_MATCHER.source})*%`, 'gi');

export async function copyToClipboard(ids, format) {
  if (!(await Permissions.isGranted(Permissions.CLIPBOARD_WRITE))) {
    notify({
      title:   browser.i18n.getMessage('notPermitted_clipboardWrite_title'),
      message: browser.i18n.getMessage('notPermitted_clipboardWrite_message')
    });
    return;
  }

  const allTabs = await getAllTabs();
  const tabs = allTabs.filter(tab => ids.indexOf(tab.id) > -1);

  let indentLevels = [];
  if (kFORMAT_MATCHER_TST_INDENT.test(format)) {
    try {
      const tabsWithChildren = await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: 'get-tree',
        tabs: tabs.map(tab => tab.id)
      });
      const ancestorsOf = {};
      const collectAncestors = (tab) => {
        ancestorsOf[tab.id] = ancestorsOf[tab.id] || [];
        for (const child of tab.children) {
          collectAncestors(child);
          ancestorsOf[child.id] = [tab.id].concat(ancestorsOf[tab.id]);
        }
      };
      for (const tab of tabsWithChildren) {
        collectAncestors(tab);
      }
      // ignore indent information for partial selection
      indentLevels = tabsWithChildren.map(tab => {
        return ancestorsOf[tab.id].filter(ancestorId => ids.indexOf(ancestorId) > -1).length
      });
    }
    catch(_e) {
    }
  }

  const lineFeed = configs.useCRLF ? '\r\n' : '\n' ;
  const itemsToCopy = await Promise.all(tabs.map((tab, index) => fillPlaceHolders(format, tab, indentLevels[index])));

  const richText = /%RT%/i.test(format) ? itemsToCopy.map(item => item.richText).join('<br />') : null ;
  let plainText = itemsToCopy.map(item => item.plainText).join(lineFeed);
  if (tabs.length > 1)
    plainText += lineFeed;

  log('richText: ', richText);
  log('plainText: ', plainText);

  const doCopy = function() {
    if (richText) {
      // This block won't work if dom.event.clipboardevents.enabled=false.
      // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1396275
      document.addEventListener('copy', event => {
        event.stopImmediatePropagation();
        event.preventDefault();
        event.clipboardData.setData('text/plain', plainText);
        event.clipboardData.setData('text/html',  richText);
      }, {
        once:    true,
        capture: true
      });
      document.execCommand('copy');
    }
    else {
      // this is still required to block overriding clipboard data from scripts of the webpage.
      document.addEventListener('copy', event => {
        event.stopImmediatePropagation();
        event.preventDefault();
        event.clipboardData.setData('text/plain', plainText);
      }, {
        capture: true,
        once: true
      });
      const field = document.createElement('textarea');
      field.setAttribute('style', 'position:fixed; top:0; left:0; opacity:0');
      field.value = plainText;
      document.body.appendChild(field);
      field.focus();
      field.select();
      document.execCommand('copy');
      field.parentNode.removeChild(field);
    }
  };

  if (!configs.useWorkaroundForBug1272869) {
    doCopy();
    return;
  }

  let permittedTabs = tabs.filter(isPermittedTab);
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
      {
        let richText = ${JSON.stringify(richText)};
        let plainText = ${JSON.stringify(plainText)};
        (${doCopy.toString()})();
      }
    `
  });
}

export async function fillPlaceHolders(format, tab, indentLevel) {
  log('fillPlaceHolders ', tab.id, format, indentLevel);
  const lineFeed = configs.useCRLF ? '\r\n' : '\n' ;
  let contentsData = {};
  if (!tab.discarded &&
      isPermittedTab(tab) &&
      /%(AUTHOR|DESC(?:RIPTION)?|KEYWORDS)(?:_HTML(?:IFIED)?)?%/i.test(format)) {
    log('trying to get data from content ', tab.id);
    contentsData = await browser.tabs.executeScript(tab.id, {
      file: '/common/get-content-text.js'
    });
    if (Array.isArray(contentsData))
      contentsData = contentsData[0];
    log('contentsData ', contentsData);
  }
  const now = new Date();
  const timeUTC = now.toUTCString();
  const timeLocal = now.toLocaleString();
  const formatted = format
    .replace(/%(?:RLINK|RLINK_HTML(?:IFIED)?|SEL|SEL_HTML(?:IFIED)?)%/gi, '')
    .replace(/%URL%/gi, tab.url)
    .replace(/%(?:TITLE|TEXT)%/gi, tab.title)
    .replace(/%URL_HTML(?:IFIED)?%/gi, sanitizeHtmlText(tab.url))
    .replace(/%TITLE_HTML(?:IFIED)?%/gi, sanitizeHtmlText(tab.title))
    .replace(/%AUTHOR%/gi, contentsData.author || '')
    .replace(/%AUTHOR_HTML(?:IFIED)?%/gi, sanitizeHtmlText(contentsData.author || ''))
    .replace(/%DESC(?:RIPTION)?%/gi, contentsData.description || '')
    .replace(/%DESC(?:RIPTION)?_HTML(?:IFIED)?%/gi, sanitizeHtmlText(contentsData.description || ''))
    .replace(/%KEYWORDS%/gi, contentsData.keywords || '')
    .replace(/%KEYWORDS_HTML(?:IFIED)?%/gi, sanitizeHtmlText(contentsData.keywords || ''))
    .replace(/%UTC_TIME%/gi, timeUTC)
    .replace(/%LOCAL_TIME%/gi, timeLocal)
    .replace(/%TAB%/gi, '\t')
    .replace(/%EOL%/gi, lineFeed)
    .replace(/%RT%/gi, '')
    .replace(kFORMAT_MATCHER_TST_INDENT, matched => {
      let indenters = matched.replace(/^%TST_INDENT|%$/g, '');
      if (indenters == '') {
        indenters = ['  '];
      }
      else {
        indenters = indenters
          .match(kFORMAT_PARAMETER_MATCHER)
          .map(indenter => indenter.substring(1, indenter.length - 1))
          .reverse();
      }
      let indent = '';
      for (let i = 0; i < indentLevel; i++) {
        const indenter = indenters[Math.min(i, indenters.length - 1)];
        indent = `${indenter}${indent}`;
      }
      return indent;
    });

  if (/%RT%/i.test(format)) {
    return {
      richText:  formatted.trim() && formatted ||
                   `<a href="${sanitizeHtmlText(tab.url)}">${sanitizeHtmlText(tab.title)}</a>`,
      plainText: formatted.trim() && formatted ||
                   `${tab.title}<${tab.url}>`
    };
  }
  return {
    richText:  '',
    plainText: formatted
  };
}

export function sanitizeHtmlText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function saveTabs(ids) {
  const tabs = await getAllTabs();
  let prefix = configs.saveTabsPrefix;
  prefix = `${prefix.replace(/\/$/, '')}/`;
  for (const tab of tabs) {
    if (ids.indexOf(tab.id) > -1)
      browser.downloads.download({
        url:      tab.url,
        filename: `${prefix}${await suggestFileNameForTab(tab)}`
      });
  }
}

const kMAYBE_IMAGE_PATTERN    = /\.(jpe?g|png|gif|bmp|svg)/i;
const kMAYBE_RAW_FILE_PATTERN = /\.(te?xt|md)/i;

export async function suggestFileNameForTab(tab) {
  const fileNameMatch = tab.url
    .replace(/^\w+:\/\/[^\/]+\//, '') // remove origin part
    .replace(/#.*$/, '') // remove fragment
    .replace(/\?.*$/, '') // remove query
    .match(/([^\/]+\.([^\.\/]+))$/);
  log('suggestFileNameForTab ', tab.id, fileNameMatch);
  if (fileNameMatch &&
      (kMAYBE_IMAGE_PATTERN.test(fileNameMatch[1]) ||
       kMAYBE_RAW_FILE_PATTERN.test(fileNameMatch[1])))
    return fileNameMatch[1];

  let suggestedExtension = '';
  if (!tab.discarded &&
      isPermittedTab(tab)) {
    log(`getting content type of ${tab.id}`);
    if (!(await Permissions.isGranted(Permissions.ALL_URLS))) {
      notify({
        title:   browser.i18n.getMessage('notPermitted_allUrls_title'),
        message: browser.i18n.getMessage('notPermitted_allUrls_message')
      });
    }
    else {
      let contentType = await browser.tabs.executeScript(tab.id, {
        code: `document.contentType`
      });
      if (Array.isArray(contentType))
        contentType = contentType[0];
      log(`contentType of ${tab.id}: `, contentType);
      if (/^(text\/html|application\/xhtml\+xml)/.test(contentType)) {
        suggestedExtension = '.html';
      }
      else if (/^text\//.test(contentType)) {
        suggestedExtension = '.txt';
      }
      else if (/^image\//.test(contentType)) {
        suggestedExtension = `.${contentType.replace(/^image\/|\+.+$/g, '')}`;
      }
    }
  }
  log('suggestedExtension: ', tab.id, suggestedExtension);
  const fileName = `${tab.title.replace(/[\/\\:*?"<>|]/g, '_')}${suggestedExtension}`;
  log('finally suggested fileName: ', tab.id, fileName);
  return fileName;
}

export async function suspendTabs(ids, _options = {}) {
  if (typeof browser.tabs.discard != 'function')
    throw new Error('Error: required API "tabs.discard()" is not available on this version of Firefox.');
  const allTabs = await browser.tabs.query({ windowId: mSelection.targetWindow });
  let inSelection = false;
  let selectionFound = false;
  let unselectedTabs = [];
  let nextFocusedTab = null;
  for (const tab of allTabs) {
    if (tab.active && ids.indexOf(tab.id) < 0) {
      nextFocusedTab = null;
      unselectedTabs = [];
      break;
    }
    if (!inSelection && ids.indexOf(tab.id) > -1) {
      inSelection = true;
      selectionFound = true;
    }
    else if (inSelection && ids.indexOf(tab.id) < 0) {
      inSelection = false;
    }
    if (selectionFound && !inSelection && !tab.discarded) {
      nextFocusedTab = tab;
      break;
    }
    if (!inSelection && !selectionFound)
      unselectedTabs.push(tab);
  }
  if (!nextFocusedTab && unselectedTabs.length > 0) {
    for (const tab of unselectedTabs.reverse()) {
      if (tab.discarded)
        continue;
      nextFocusedTab = tab;
      break;
    }
  }
  if (nextFocusedTab)
    await browser.tabs.update(nextFocusedTab.id, { active: true });
  return browser.tabs.discard(ids);
}

export async function resumeTabs(ids) {
  const allTabs = (await browser.tabs.query({ windowId: mSelection.targetWindow }));
  const activeTab = allTabs.filter(tab => tab.active)[0];
  const selectedTabs = allTabs.filter(tab => ids.indexOf(tab.id) > -1);
  for (const tab of selectedTabs) {
    //if (tab.discarded)
    await browser.tabs.update(tab.id, { active: true });
  }
  return browser.tabs.update(activeTab.id, { active: true });
}

export async function selectAllTabs() {
  const tabs = await getAllTabs();
  setSelection(tabs, true);
}

export async function invertSelection() {
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
  setSelection(oldSelected, false);
  setSelection(newSelected, true);
}
