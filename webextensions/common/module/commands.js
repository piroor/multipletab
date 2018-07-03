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
import EventListenerManager from './EventListenerManager.js';
import TabIdFixer from '../../extlib/TabIdFixer.js';

export const onSelectionChange = new EventListenerManager();

export const gSelection = {
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
  apply(aForeignSession) {
    for (const key of Object.keys(aForeignSession)) {
      if (typeof this[key] != 'function')
        this[key] = aForeignSession[key];
    }
  }
};

export const gDragSelection = {
  willCloseSelectedTabs: false,
  allTabsOnDragReady:    [],
  pendingTabs:           null,
  dragStartTarget:       null,
  lastHoverTarget:       null,
  firstHoverTarget:      null,
  undeterminedRange:     {},
  dragEnteredCount:      0,
  clear() {
    this.dragStartTarget = this.firstHoverTarget = this.lastHoverTarget = null;
    this.undeterminedRange = {};
    this.willCloseSelectedTabs = false;
    this.dragEnteredCount = 0;
    this.allTabsOnDragReady = [];
  },
  export() {
    const exported = {};
    for (const key of Object.keys(this)) {
      if (typeof this[key] != 'function')
        exported[key] = this[key];
    }
    return exported;
  },
  apply(aForeignSession) {
    for (const key of Object.keys(aForeignSession)) {
      if (typeof this[key] != 'function')
        this[key] = aForeignSession[key];
    }
  }
};

export function clearSelection(aOptions = {}) {
  const tabs = [];
  for (const id of Object.keys(gSelection.tabs)) {
    tabs.push(gSelection.tabs[id]);
  }
  setSelection(tabs, false, aOptions);
  gSelection.clear();
}

export function isPermittedTab(aTab) {
  if (aTab.discarded)
    return false;
  return /^about:blank($|\?|#)/.test(aTab.url) ||
         !/^(about|resource|chrome|file|view-source):/.test(aTab.url);
}

export function setSelection(aTabs, aSelected, aOptions = {}) {
  if (!Array.isArray(aTabs))
    aTabs = [aTabs];

  const shouldHighlight = aOptions.globalHighlight !== false;

  //console.log('setSelection ', ids, `${aState}=${aSelected}`);
  if (aSelected) {
    for (const tab of aTabs) {
      if (tab.id in gSelection.tabs)
        continue;
      gSelection.tabs[tab.id] = tab;
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
    for (const tab of aTabs) {
      if (!(tab.id in gSelection.tabs))
        continue;
      delete gSelection.tabs[tab.id];
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
    type:  aSelected ? Constants.kTSTAPI_ADD_TAB_STATE : Constants.kTSTAPI_REMOVE_TAB_STATE,
    tabs:  aTabs.map(aTab => aTab.id),
    state: aOptions.states || aOptions.state || 'selected'
  }).catch(_e => {}); // TST is not available
  onSelectionChange.dispatch(aTabs, aSelected, aOptions);
}


export function reservePushSelectionState() {
  if (reservePushSelectionState.reserved)
    clearTimeout(reservePushSelectionState.reserved);
  reservePushSelectionState.reserved = setTimeout(() => {
    pushSelectionState();
  }, 150);
}

export async function pushSelectionState(aOptions = {}) {
  if (reservePushSelectionState.reserved) {
    clearTimeout(reservePushSelectionState.reserved);
    delete reservePushSelectionState.reserved;
  }
  await browser.runtime.sendMessage({
    type:          Constants.kCOMMAND_PUSH_SELECTION_INFO,
    selection:     gSelection.export(),
    dragSelection: gDragSelection.export(),
    updateMenu:    !!aOptions.updateMenu,
    contextTab:    aOptions.contextTab
  });
}


export async function getAllTabs(aWindowId) {
  const tabs = aWindowId || gSelection.targetWindow ?
    await browser.tabs.query({ windowId: aWindowId || gSelection.targetWindow }) :
    (await browser.windows.getCurrent({ populate: true })).tabs ;
  return tabs.map(TabIdFixer.fixTab);
}

export function getSelectedTabIds() {
  return Object.keys(gSelection.tabs).map(aId => parseInt(aId));
}

export async function getAPITabSelection(aParams = {}) {
  const ids        = aParams.selectedIds || getSelectedTabIds();
  const selected   = [];
  const unselected = [];
  const tabs       = aParams.allTabs || await getAllTabs();
  for (const tab of tabs) {
    if (ids.indexOf(tab.id) < 0)
      unselected.push(tab);
    else
      selected.push(tab);
  }
  return { selected, unselected };
}


export async function reloadTabs(aIds) {
  for (const id of aIds) {
    browser.tabs.reload(id);
  }
}

export async function bookmarkTabs(aIds, aOptions = {}) {
  if (!(await Permissions.isGranted(Permissions.BOOKMARKS))) {
    notify({
      title:   browser.i18n.getMessage('notPermitted_bookmarks_title'),
      message: browser.i18n.getMessage('notPermitted_bookmarks_message')
    });
    return null;
  }

  const tabs = await Promise.all(aIds.map(aId => browser.tabs.get(aId)));
  tabs.forEach(TabIdFixer.fixTab);
  const folderParams = {
    title: browser.i18n.getMessage('bookmarkFolder_label', tabs[0].title)
  };
  if (aOptions.parentId) {
    folderParams.parentId = aOptions.parentId;
    if ('index' in aOptions)
      folderParams.index = aOptions.index;
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

  browser.bookmarks.get(folder.parentId).then(aFolders => {
    notify({
      title:   browser.i18n.getMessage('bookmarkTabs_notification_title'),
      message: browser.i18n.getMessage('bookmarkTabs_notification_message', [
        tabs[0].title,
        tabs.length,
        aFolders[0].title
      ]),
      icon:    Constants.kNOTIFICATION_DEFAULT_ICON
    });
  });
  return folder;
}

export async function duplicateTabs(aIds) {
  for (const id of aIds) {
    await browser.tabs.duplicate(id);
  }
}

export async function pinTabs(aIds) {
  for (const id of aIds) {
    await browser.tabs.update(id, { pinned: true });
  }
}

export async function unpinTabs(aIds) {
  for (const id of aIds) {
    await browser.tabs.update(id, { pinned: false });
  }
}

export async function muteTabs(aIds) {
  for (const id of aIds) {
    browser.tabs.update(id, { muted: true });
  }
}

export async function unmuteTabs(aIds) {
  for (const id of aIds) {
    browser.tabs.update(id, { muted: false });
  }
}

export async function moveToWindow(aIds, aWindowId) {
  const structure = await browser.runtime.sendMessage(Constants.kTST_ID, {
    type: Constants.kTSTAPI_GET_TREE_STRUCTURE,
    tabs: aIds
  }).catch(_e => {}); // TST is not available
  log('structure ', structure);
  const firstTab = aIds[0];
  let window;
  if (aWindowId) {
    window = await browser.windows.get(aWindowId);
  }
  else {
    window = await browser.windows.create({
      tabId: firstTab
    });
    aIds = aIds.slice(1);
  }
  await browser.runtime.sendMessage(Constants.kTST_ID, {
    type:   Constants.kTSTAPI_BLOCK_GROUPING,
    window: window.id
  }).catch(_e => {}); // TST is not available
  const waitUntilCompletelyMoved = new Promise((aResolve, _reject) => {
    let restTabs = aIds.length - 1;
    const listener = (_tabId, _attachInfo) => {
      restTabs--;
      if (restTabs <= 0) {
        browser.tabs.onAttached.removeListener(listener);
        aResolve();
      }
    };
    browser.tabs.onAttached.addListener(listener);
  });
  await Promise.all([
    safeMoveApiTabsAcrossWindows(aIds, {
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
      tabs: aIds,
      structure
    }).catch(_e => {}); // TST is not available
  }
  await browser.runtime.sendMessage(Constants.kTST_ID, {
    type:   Constants.kTSTAPI_UNBLOCK_GROUPING,
    window: window.id
  }).catch(_e => {}); // TST is not available
}

// workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1394477
export async function safeMoveApiTabsAcrossWindows(aTabIds, aMoveOptions) {
  return (await Promise.all(aTabIds.map(async (aTabId, aIndex) => {
    try {
      let movedTab = await browser.tabs.move(aTabId, Object.assign({}, aMoveOptions, {
        index: aMoveOptions.index + aIndex
      }));
      if (Array.isArray(movedTab))
        movedTab = movedTab[0];
      return movedTab;
    }
    catch(_e) {
      return null;
    }
  }))).filter(aTab => !!aTab);
}

export async function removeTabs(aIds) {
  const tabs = await getAllTabs(); // because given ids are possibly unsorted.
  // close down to top, to keep tree structure of Tree Style Tab
  const ids = tabs.reverse().filter(aTab => aIds.indexOf(aTab.id) > -1).map(aTab => aTab.id);
  await browser.tabs.remove(ids);
}

export async function removeOtherTabs(aIds) {
  const tabs = await getAllTabs(); // because given ids are possibly unsorted.
  // close down to top, to keep tree structure of Tree Style Tab
  const ids = tabs.reverse().filter(aTab => aIds.indexOf(aTab.id) < 0 && !aTab.pinned).map(aTab => aTab.id);
  await browser.tabs.remove(ids);
}

const kFORMAT_PARAMETER_MATCHER  = /\([^\)]+\)|\[[^\]]+\]|\{[^\}]+\}|<[^>]+>/g;
const kFORMAT_MATCHER_TST_INDENT = new RegExp(`%TST_INDENT(?:${kFORMAT_PARAMETER_MATCHER.source})*%`, 'gi');

export async function copyToClipboard(aIds, aFormat) {
  if (!(await Permissions.isGranted(Permissions.CLIPBOARD_WRITE))) {
    notify({
      title:   browser.i18n.getMessage('notPermitted_clipboardWrite_title'),
      message: browser.i18n.getMessage('notPermitted_clipboardWrite_message')
    });
    return;
  }

  const allTabs = await getAllTabs();
  const tabs = allTabs.filter(aTab => aIds.indexOf(aTab.id) > -1);

  let indentLevels = [];
  if (kFORMAT_MATCHER_TST_INDENT.test(aFormat)) {
    try {
      const tabsWithChildren = await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: 'get-tree',
        tabs: tabs.map(aTab => aTab.id)
      });
      const ancestorsOf = {};
      const collectAncestors = (aTab) => {
        ancestorsOf[aTab.id] = ancestorsOf[aTab.id] || [];
        for (const child of aTab.children) {
          collectAncestors(child);
          ancestorsOf[child.id] = [aTab.id].concat(ancestorsOf[aTab.id]);
        }
      };
      for (const tab of tabsWithChildren) {
        collectAncestors(tab);
      }
      // ignore indent information for partial selection
      indentLevels = tabsWithChildren.map(aTab => {
        return ancestorsOf[aTab.id].filter(aAncestorId => aIds.indexOf(aAncestorId) > -1).length
      });
    }
    catch(_e) {
    }
  }

  const lineFeed = configs.useCRLF ? '\r\n' : '\n' ;
  const itemsToCopy = await Promise.all(tabs.map((aTab, aIndex) => fillPlaceHolders(aFormat, aTab, indentLevels[aIndex])));

  const richText = /%RT%/i.test(aFormat) ? itemsToCopy.map(aItem => aItem.richText).join('<br />') : null ;
  let plainText = itemsToCopy.map(aItem => aItem.plainText).join(lineFeed);
  if (tabs.length > 1)
    plainText += lineFeed;

  log('richText: ', richText);
  log('plainText: ', plainText);

  const doCopy = function() {
    if (richText) {
      // This block won't work if dom.event.clipboardevents.enabled=false.
      // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1396275
      document.addEventListener('copy', aEvent => {
        aEvent.stopImmediatePropagation();
        aEvent.preventDefault();
        aEvent.clipboardData.setData('text/plain', plainText);
        aEvent.clipboardData.setData('text/html',  richText);
      }, {
        once:    true,
        capture: true
      });
      document.execCommand('copy');
    }
    else {
      // this is still required to block overriding clipboard data from scripts of the webpage.
      document.addEventListener('copy', aEvent => {
        aEvent.stopImmediatePropagation();
        aEvent.preventDefault();
        aEvent.clipboardData.setData('text/plain', plainText);
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

export async function fillPlaceHolders(aFormat, aTab, aIndentLevel) {
  log('fillPlaceHolders ', aTab.id, aFormat, aIndentLevel);
  const lineFeed = configs.useCRLF ? '\r\n' : '\n' ;
  let contentsData = {};
  if (!aTab.discarded &&
      isPermittedTab(aTab) &&
      /%(AUTHOR|DESC(?:RIPTION)?|KEYWORDS)(?:_HTML(?:IFIED)?)?%/i.test(aFormat)) {
    log('trying to get data from content ', aTab.id);
    contentsData = await browser.tabs.executeScript(aTab.id, {
      file: '/common/get-content-text.js'
    });
    if (Array.isArray(contentsData))
      contentsData = contentsData[0];
    log('contentsData ', contentsData);
  }
  const now = new Date();
  const timeUTC = now.toUTCString();
  const timeLocal = now.toLocaleString();
  const formatted = aFormat
    .replace(/%(?:RLINK|RLINK_HTML(?:IFIED)?|SEL|SEL_HTML(?:IFIED)?)%/gi, '')
    .replace(/%URL%/gi, aTab.url)
    .replace(/%(?:TITLE|TEXT)%/gi, aTab.title)
    .replace(/%URL_HTML(?:IFIED)?%/gi, sanitizeHtmlText(aTab.url))
    .replace(/%TITLE_HTML(?:IFIED)?%/gi, sanitizeHtmlText(aTab.title))
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
    .replace(kFORMAT_MATCHER_TST_INDENT, aMatched => {
      let indenters = aMatched.replace(/^%TST_INDENT|%$/g, '');
      if (indenters == '') {
        indenters = ['  '];
      }
      else {
        indenters = indenters
          .match(kFORMAT_PARAMETER_MATCHER)
          .map(aIndenter => aIndenter.substring(1, aIndenter.length - 1))
          .reverse();
      }
      let indent = '';
      for (let i = 0; i < aIndentLevel; i++) {
        const indenter = indenters[Math.min(i, indenters.length - 1)];
        indent = `${indenter}${indent}`;
      }
      return indent;
    });

  if (/%RT%/i.test(aFormat)) {
    return {
      richText:  formatted.trim() && formatted ||
                   `<a href="${sanitizeHtmlText(aTab.url)}">${sanitizeHtmlText(aTab.title)}</a>`,
      plainText: formatted.trim() && formatted ||
                   `${aTab.title}<${aTab.url}>`
    };
  }
  return {
    richText:  '',
    plainText: formatted
  };
}

export function sanitizeHtmlText(aText) {
  return aText
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function saveTabs(aIds) {
  const tabs = await getAllTabs();
  let prefix = configs.saveTabsPrefix;
  prefix = `${prefix.replace(/\/$/, '')}/`;
  for (const tab of tabs) {
    if (aIds.indexOf(tab.id) > -1)
      browser.downloads.download({
        url:      tab.url,
        filename: `${prefix}${await suggestFileNameForTab(tab)}`
      });
  }
}

const kMAYBE_IMAGE_PATTERN    = /\.(jpe?g|png|gif|bmp|svg)/i;
const kMAYBE_RAW_FILE_PATTERN = /\.(te?xt|md)/i;

export async function suggestFileNameForTab(aTab) {
  const fileNameMatch = aTab.url
    .replace(/^\w+:\/\/[^\/]+\//, '') // remove origin part
    .replace(/#.*$/, '') // remove fragment
    .replace(/\?.*$/, '') // remove query
    .match(/([^\/]+\.([^\.\/]+))$/);
  log('suggestFileNameForTab ', aTab.id, fileNameMatch);
  if (fileNameMatch &&
      (kMAYBE_IMAGE_PATTERN.test(fileNameMatch[1]) ||
       kMAYBE_RAW_FILE_PATTERN.test(fileNameMatch[1])))
    return fileNameMatch[1];

  let suggestedExtension = '';
  if (!aTab.discarded &&
      isPermittedTab(aTab)) {
    log(`getting content type of ${aTab.id}`);
    if (!(await Permissions.isGranted(Permissions.ALL_URLS))) {
      notify({
        title:   browser.i18n.getMessage('notPermitted_allUrls_title'),
        message: browser.i18n.getMessage('notPermitted_allUrls_message')
      });
    }
    else {
      let contentType = await browser.tabs.executeScript(aTab.id, {
        code: `document.contentType`
      });
      if (Array.isArray(contentType))
        contentType = contentType[0];
      log(`contentType of ${aTab.id}: `, contentType);
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
  log('suggestedExtension: ', aTab.id, suggestedExtension);
  const fileName = `${aTab.title.replace(/[\/\\:*?"<>|]/g, '_')}${suggestedExtension}`;
  log('finally suggested fileName: ', aTab.id, fileName);
  return fileName;
}

export async function suspendTabs(aIds, _options = {}) {
  if (typeof browser.tabs.discard != 'function')
    throw new Error('Error: required API "tabs.discard()" is not available on this version of Firefox.');
  const allTabs = await browser.tabs.query({ windowId: gSelection.targetWindow });
  let inSelection = false;
  let selectionFound = false;
  let unselectedTabs = [];
  let nextFocusedTab = null;
  for (const tab of allTabs) {
    if (tab.active && aIds.indexOf(tab.id) < 0) {
      nextFocusedTab = null;
      unselectedTabs = [];
      break;
    }
    if (!inSelection && aIds.indexOf(tab.id) > -1) {
      inSelection = true;
      selectionFound = true;
    }
    else if (inSelection && aIds.indexOf(tab.id) < 0) {
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
  return browser.tabs.discard(aIds);
}

export async function resumeTabs(aIds) {
  const allTabs = (await browser.tabs.query({ windowId: gSelection.targetWindow }));
  const activeTab = allTabs.filter(aTab => aTab.active)[0];
  const selectedTabs = allTabs.filter(aTab => aIds.indexOf(aTab.id) > -1);
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
