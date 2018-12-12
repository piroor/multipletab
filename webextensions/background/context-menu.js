/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  configs,
  handleMissingReceiverError
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as Selection from '/common/selection.js';
import * as Commands from '/common/commands.js';
import * as DragSelectionManager from '/common/drag-selection-manager.js';

const mItems = `
  reloadTabs
  bookmarkTabs
  removeBookmarkFromTabs
  -----------------
  duplicateTabs
  -----------------
  pinTabs
  unpinTabs
  muteTabs
  unmuteTabs
  moveToNewWindow
  moveToOtherWindow
  -----------------
  removeTabs
  removeOther
  -----------------
  clipboard
  saveTabs
  -----------------
  printTabs
  -----------------
  freezeTabs
  unfreezeTabs
  protectTabs
  unprotectTabs
  lockTabs
  unlockTabs
  -----------------
  groupTabs
  -----------------
  suspendTabs
  resumeTabs
  -----------------
  selectAll
  select
  unselect
  invertSelection
  -----------------
`.trim().split(/\s+/).map(id => `selection/${id}`);
mItems.unshift('selection');

let mActiveItems = [];
const mExtraItems = {};

let mLastSubmenuVisible = false;
let mDirty = true;

export function init() {
  browser.runtime.onMessage.addListener(onMessage);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
  configs.$addObserver(key => {
    if (/^(context_|copyToClipboardFormats)/.test(key)) {
      log('menu becomes dirty by changed config: ', key);
      mDirty = true;
    }
  });
}


const POPUP_URL_PATTERN = [`moz-extension://${location.host}/*`];

const mUseNativeContextMenu = typeof browser.menus.overrideContext == 'function';
async function refreshItems(contextTab, tabs = null) {
  log('refreshItems');
  if (!mDirty && !tabs) {
    log(' => no change, skip');
    return;
  }

  const promisedMenuUpdated = [];
  const currentWindow = await (contextTab ? browser.windows.get(contextTab.windowId) : browser.windows.getLastFocused());
  const selectedTabs = tabs || await Selection.getSelection(currentWindow.id);

  promisedMenuUpdated.push(browser.menus.removeAll());
  try {
    if (configs.enableIntegrationWithTST)
      promisedMenuUpdated.push(browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_CONTEXT_MENU_REMOVE_ALL
      }).catch(handleMissingReceiverError));
  }
  catch(_e) {
  }

  const nativeMenuParams = [];
  const fakeMenuParams   = [];

  mActiveItems = [];
  const otherWindows = (await browser.windows.getAll())
    .filter(window => window.id != currentWindow.id && window.incognito == currentWindow.incognito);
  const visibilities = await getContextMenuItemVisibilities({
    tab:          contextTab,
    tabs,
    windowId:     currentWindow.id,
    otherWindows: otherWindows
  });
  log('visibilities: ', visibilities);

  const hasSelection         = selectedTabs.length > 1;
  let separatorsCount        = 0;
  const normalItemAppearedIn = {};
  const createdItems         = {};
  const nextSeparatorIn      = {};
  const registerItem = async (id, options = {}) => {
    const parts = id.split('/');
    id = parts.pop();

    const parentId = parts.pop() || '';
    if (parentId && !(parentId in createdItems)) {
      log(`no parent ${parentId} for ${id}`);
      return;
    }

    const isSeparator = id.charAt(0) == '-';
    if (isSeparator) {
      if (!normalItemAppearedIn[parentId]) {
        log(`no normal item before separator ${id}`);
        return;
      }
      normalItemAppearedIn[parentId] = false;
      id = `separator${separatorsCount++}`;
    }
    else {
      if (id in visibilities && !visibilities[id]) {
        log(`${id} is hidden by condition`);
        return;
      }
      if (!options.always && !hasSelection) {
        log(`${id} is hidden for no selection`);
        return;
      }
      const key = `context_${id}`;
      if (configs[key] === false) {
        log(`${id} is hidden by config`);
        return;
      }
      normalItemAppearedIn[parentId] = true;
      if (nextSeparatorIn[parentId]) {
        mActiveItems.push(nextSeparatorIn[parentId]);
        if (!options.onlyFakeMenu) {
          const params = nextSeparatorIn[parentId];
          nativeMenuParams.push(params);
          if (mUseNativeContextMenu)
            nativeMenuParams.push(Object.assign({}, params, {
              id:        `panel_${params.id}`,
              parentId:  params.parentId == 'selection' ? null : `panel_${params.parentId}`,
              viewTypes: ['popup'],
              documentUrlPatterns: POPUP_URL_PATTERN
            }));
          if (configs.enableIntegrationWithTST)
            fakeMenuParams.push(nextSeparatorIn[parentId]);
        }
      }
      delete nextSeparatorIn[parentId];
    }
    //log('build ', id, parentId);
    createdItems[id] = true;
    const type = isSeparator ? 'separator' : 'normal';
    let title = null;
    if (!isSeparator) {
      if (options.title)
        title = options.title;
      else
        title = browser.i18n.getMessage(`context_${id.replace(/[^a-z0-9@_]/gi, '_')}_label`);
    }
    const params = {
      id, type, title,
      contexts: ['page', 'tab']
    };
    if (parentId)
      params.parentId = parentId;
    if (isSeparator) {
      nextSeparatorIn[parentId] = params;
      return;
    }
    mActiveItems.push(params);
    if (!options.onlyFakeMenu) {
      if (mUseNativeContextMenu) {
        if (params.id == 'selection') {
          params.visible = false;
          mLastSubmenuVisible = false;
        }
        else {
          nativeMenuParams.push(Object.assign({}, params, {
            id:        `panel_${params.id}`,
            parentId:  params.parentId == 'selection' ? null : `panel_${params.parentId}`,
            viewTypes: ['popup'],
            documentUrlPatterns: POPUP_URL_PATTERN
          }));
        }
        nativeMenuParams.push(params);
      }
      else {
        nativeMenuParams.push(Object.assign({}, params, {
          // Access key is not supported by WE API.
          // See also: https://bugzilla.mozilla.org/show_bug.cgi?id=1320462
          title: params.title && params.title.replace(/\(&[a-z]\)|&([a-z])/i, '$1')
        }));
      }
      if (configs.enableIntegrationWithTST)
        fakeMenuParams.push(params);
    }
  }

  for (const id of mItems) {
    await registerItem(id);
  }

  // create submenu items for "copy to clipboard"
  let formatIds;
  const formats = configs.copyToClipboardFormats;
  if (Array.isArray(formats)) {
    formatIds = formats
      .map((item, index) => `clipboard/clipboard:${index}:${item.label}`)
      .filter((item, index) => formats[index].label);
  }
  else {
    const labels = Object.keys(formats);
    formatIds = labels
      .map((label, index) => `clipboard/clipboard:${index}:${label}`)
      .filter((item, index) => labels[index]);
  }
  for (const id of formatIds) {
    await registerItem(id, {
      title: id.replace(/^clipboard\/clipboard:[0-9]+:/, '')
    });
  }

  // create submenu items for "move to other window"
  for (const window of otherWindows) {
    await registerItem(`moveToOtherWindow/moveToOtherWindow:${window.id}`, {
      title: window.title
    });
  }

  // create additional items registered by other addons
  for (const id of Object.keys(mExtraItems)) {
    await registerItem(`selection/extra:${id}`, Object.assign({}, mExtraItems[id], {
      onlyFakeMenu: true
    }));
  }

  log('nativeMenuParams: ', nativeMenuParams);
  log('fakeMenuParams: ', fakeMenuParams);
  if (nativeMenuParams.length > 1 ||
      (nativeMenuParams.length == 1 &&
       nativeMenuParams[0].id != 'selection')) {
    for (const params of nativeMenuParams) {
      promisedMenuUpdated.push(browser.menus.create(params));
    }
    for (const params of fakeMenuParams) {
      promisedMenuUpdated.push(browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_CONTEXT_MENU_CREATE,
        params
      }).catch(handleMissingReceiverError));
    }
  }

  log('menu becomes undirty');
  mDirty = false;
  return Promise.all(promisedMenuUpdated).then(() => browser.menus.refresh());
}

async function getContextMenuItemVisibilities(params) {
  const tab = params.tab;
  const [selectedTabs, allTabs] = await Promise.all([
    params.tabs || Selection.getSelection(params.windowId),
    Selection.getAllTabs(params.windowId)
  ]);
  log('getContextMenuItemVisibilities ', { params, selectedTabs, allTabs });
  const hasSelection = selectedTabs.length > 1;
  const allSelected  = selectedTabs.length == allTabs.length;
  let pinnedCount = 0;
  let mutedCount = 0;
  let suspendedCount = 0;
  let lockedCount = 0;
  let protectedCount = 0;
  let frozenCount = 0;
  for (const tab of selectedTabs) {
    if (tab.pinned)
      pinnedCount++;
    if (tab.mutedInfo.muted)
      mutedCount++;
    if (tab.discarded)
      suspendedCount++;
    if (tab.states && tab.states.indexOf('locked') < 0)
      lockedCount++;
    if (tab.states && tab.states.indexOf('protected') < 0)
      protectedCount++;
    if (tab.states && tab.states.indexOf('frozen') < 0)
      frozenCount++;
  }
  return {
    reloadTabs:    hasSelection,
    bookmarkTabs:  hasSelection,
    removeBookmarkFromTabs: hasSelection,
    duplicateTabs: hasSelection,
    pinTabs:       hasSelection && pinnedCount < selectedTabs.length,
    unpinTabs:     hasSelection && pinnedCount > 0,
    muteTabs:      hasSelection && mutedCount < selectedTabs.length,
    unmuteTabs:    hasSelection && mutedCount > 0,
    moveToNewWindow: hasSelection,
    moveToOtherWindow: hasSelection && params.otherWindows.length > 0,
    removeTabs:    hasSelection,
    removeOther:   hasSelection && !allSelected,
    clipboard:     hasSelection,
    saveTabs:      hasSelection,
    printTabs:     hasSelection,
    freezeTabs:    hasSelection && frozenCount < selectedTabs.length,
    unfreezeTabs:  hasSelection && frozenCount > 0,
    protectTabs:   hasSelection && protectedCount < selectedTabs.length,
    unprotectTabs: hasSelection && protectedCount > 0,
    lockTabs:      hasSelection && lockedCount < selectedTabs.length,
    unlockTabs:    hasSelection && lockedCount > 0,
    groupTabs:     hasSelection,
    suspendTabs:   hasSelection && suspendedCount < selectedTabs.length,
    resumeTabs:    hasSelection && suspendedCount > 0,
    selectAll:     !allSelected,
    select:        !tab || !tab.highlighted,
    unselect:      !tab || tab.highlighted,
    invertSelection: hasSelection
  };
}

async function onClick(info, tab) {
  //log('context menu item clicked: ', info, tab);
  const windowId       = tab && tab.windowId;
  const selectedTabs   = await Selection.getSelection(windowId);
  const selectedTabIds = selectedTabs.map(tab => tab.id);
  log('info.menuItemId, selectedTabIds ', info.menuItemId, selectedTabIds);
  let shouldClearSelection = configs.clearSelectionAfterCommandInvoked;
  const itemId = info.menuItemId.replace(/^panel_/, '');
  switch (itemId) {
    case 'reloadTabs':
      await Commands.reloadTabs(selectedTabIds);
      break;
    case 'bookmarkTabs':
      await Commands.bookmarkTabs(selectedTabIds);
      break;
    case 'removeBookmarkFromTabs':
      // not implemented
      break;

    case 'duplicateTabs':
      await Commands.duplicateTabs(selectedTabIds);
      break;

    case 'pinTabs':
      await Commands.pinTabs(selectedTabIds);
      break;
    case 'unpinTabs':
      await Commands.unpinTabs(selectedTabIds);
      break;
    case 'muteTabs':
      await Commands.muteTabs(selectedTabIds);
      break;
    case 'unmuteTabs':
      await Commands.unmuteTabs(selectedTabIds);
      break;

    case 'moveToNewWindow':
      await Commands.moveToWindow(selectedTabIds);
      shouldClearSelection = false;
      break;

    case 'removeTabs':
      await Commands.removeTabs(selectedTabIds);
      break;
    case 'removeOther':
      await Commands.removeOtherTabs(selectedTabIds);
      break;

    case 'clipboard':
      break;
    case 'saveTabs':
      if (shouldClearSelection) {
        await Selection.clear(windowId);
      }
      await Commands.saveTabs(selectedTabIds);
      break;

    case 'printTabs':
      break;

    case 'freezeTabs':
    case 'unfreezeTabs':
    case 'protectTabs':
    case 'unprotectTabs':
    case 'lockTabs':
    case 'unlockTabs':
      break;

    case 'groupTabs':
      await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_GROUP_TABS,
        tabs: selectedTabIds
      }).catch(handleMissingReceiverError);
      break;

    case 'suspendTabs':
      await Commands.suspendTabs(selectedTabIds);
      break;
    case 'resumeTabs':
      await Commands.resumeTabs(selectedTabIds);
      break;

    case 'selectAll':
      Selection.selectAll(windowId);
      shouldClearSelection = false;
      break;
    case 'select':
      Selection.select(tab);
      shouldClearSelection = false;
      break;
    case 'unselect':
      Selection.unselect(tab);
      shouldClearSelection = false;
      break;
    case 'invertSelection':
      Selection.invert(windowId);
      shouldClearSelection = false;
      break;

    default:
      if (itemId.indexOf('clipboard:') == 0) {
        const id = itemId.replace(/^clipboard:/, '');
        let format;
        if (Array.isArray(configs.copyToClipboardFormats)) {
          let index = id.match(/^([0-9]+):/);
          index = parseInt(index[1]);
          const item = configs.copyToClipboardFormats[index];
          format = item.format;
        }
        else {
          format = configs.copyToClipboardFormats[id.replace(/^[0-9]+:/, '')];
        }
        if (shouldClearSelection)
          await Selection.clear(windowId);
        await Commands.copyToClipboard(selectedTabIds, format);
      }
      else if (itemId.indexOf('moveToOtherWindow:') == 0) {
        const id = parseInt(itemId.replace(/^moveToOtherWindow:/, ''));
        await Commands.moveToWindow(selectedTabIds, id);
      }
      else if (itemId.indexOf('extra:') == 0) {
        const idMatch   = itemId.match(/^extra:([^:]+):(.+)$/);
        const owner     = idMatch[1];
        const id        = idMatch[2];
        const selection = await Selection.getSelectionAndOthers(windowId);
        browser.runtime.sendMessage(owner, {
          type: Constants.kMTHAPI_INVOKE_SELECTED_TAB_COMMAND,
          id,
          selection
        }).catch(_e => {});
      }
      break;
  }

  if (shouldClearSelection)
    Selection.clear(windowId);
};
browser.menus.onClicked.addListener(onClick);

function onMessage(message) {
  if (!message || !message.type)
    return;

  switch (message.type) {
    case Constants.kCOMMAND_PULL_ACTIVE_CONTEXT_MENU_INFO: return (async () => {
      const tabs = await Promise.all(message.tabIds.map(id => browser.tabs.get(id)));
      await refreshItems(tabs[0], tabs);
      return mActiveItems;
    })();

    case Constants.kCOMMAND_SELECTION_MENU_ITEM_CLICK:
      return onClick({ menuItemId: message.id });
  }
}

function onMessageExternal(message, sender) {
  //log('onMessageExternal: ', message, sender);

  if (!message ||
      typeof message.type != 'string')
    return;

  switch (sender.id) {
    case Constants.kTST_ID: { // Tree Style Tab API
      const result = onTSTAPIMessage(message);
      if (result !== undefined)
        return result;
    }; break;

    default:
      break;
  }

  switch (message.type) {
    case Constants.kMTHAPI_ADD_SELECTED_TAB_COMMAND: {
      const addons = Object.assign({}, configs.cachedExternalAddons);
      addons[sender.id] = true;
      configs.cachedExternalAddons = addons;
      mExtraItems[`${sender.id}:${message.id}`] = message;
      log('menu becomes dirty by added command from other addon');
      mDirty = true;
      return Promise.resolve(true);
    };

    case Constants.kMTHAPI_REMOVE_SELECTED_TAB_COMMAND:
      delete mExtraItems[`${sender.id}:${message.id}`];
      log('menu becomes dirty by removed command from other addon');
      mDirty = true;
      return Promise.resolve(true);

    case Constants.kMTHAPI_REMOVE_ALL_SELECTED_TAB_COMMANDS:
      for (const key of Object.keys(mExtraItems)) {
        if (key.indexOf(`${sender.id}:`) == 0) {
          delete mExtraItems[key];
          mDirty = true;
        }
      }
      if (mDirty)
        log('menu becomes dirty by removed commands from other addon');
      return Promise.resolve(true);
  }
}

function onTSTAPIMessage(message) {
  switch (message.type) {
    case Constants.kTSTAPI_CONTEXT_MENU_CLICK:
      return onClick(message.info, message.tab);
    case Constants.kTSTAPI_CONTEXT_MENU_SHOWN:
      return onShown(message.info, message.tab);
  }
}


// hide submenu for self panel

let mIsPanelOpen = false;
const mPanelConnectionMatcher = new RegExp(`^${Constants.kCOMMAND_REQUEST_CONNECT_PREFIX}`);
browser.runtime.onConnect.addListener(port => {
  if (!mPanelConnectionMatcher.test(port.name))
    return;
  mIsPanelOpen = true;
  port.onDisconnect.addListener(_message => {
    mIsPanelOpen = false;
  });
});

async function onShown(info, tab) {
  await refreshItems(tab);

  const visible = !mIsPanelOpen || info.viewType != 'popup';
  if (mLastSubmenuVisible == visible)
    return;

  if (mUseNativeContextMenu)
    browser.menus.update('selection', { visible })
      .then(() => {
        browser.menus.refresh();
      })
      .catch(_e => {});

  browser.runtime.sendMessage(Constants.kTST_ID, {
    type:   Constants.kTSTAPI_CONTEXT_MENU_UPDATE,
    params: ['selection', { visible }]
  }).catch(handleMissingReceiverError)

  mLastSubmenuVisible = visible;
}

browser.menus.onShown.addListener(onShown);


DragSelectionManager.onDragSelectionEnd.addListener(async (message, selectionInfo) => {
  await refreshItems(selectionInfo.dragStartTab);
  try {
    if (configs.autoOpenMenuOnDragEnd)
      await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_CONTEXT_MENU_OPEN,
        window: (await browser.windows.getLastFocused()).id,
        tab:  selectionInfo.dragStartTab.id,
        left: message.clientX,
        top:  message.clientY
      }).catch(handleMissingReceiverError);
  }
  catch(e) {
    log('failed to open context menu: ', e);
  }
});

browser.tabs.onHighlighted.addListener(_highlightInfo => {
  mDirty = true;
});
