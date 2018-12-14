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

const mItemsById = {
  'context_reloadTab': {
    title:              browser.i18n.getMessage('tabContextMenu_reload_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_reload_label_multiselected')
  },
  'context_toggleMuteTab-mute': {
    title:              browser.i18n.getMessage('tabContextMenu_mute_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_mute_label_multiselected')
  },
  'context_toggleMuteTab-unmute': {
    title:              browser.i18n.getMessage('tabContextMenu_unmute_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_unmute_label_multiselected')
  },
  'context_pinTab': {
    title:              browser.i18n.getMessage('tabContextMenu_pin_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_pin_label_multiselected')
  },
  'context_unpinTab': {
    title:              browser.i18n.getMessage('tabContextMenu_unpin_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_unpin_label_multiselected')
  },
  'context_duplicateTab': {
    title:              browser.i18n.getMessage('tabContextMenu_duplicate_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_duplicate_label_multiselected')
  },
  'context_separator:afterDuplicate': {
    type: 'separator'
  },
  'context_bookmarkSelected': {
    title: browser.i18n.getMessage('tabContextMenu_bookmarkSelected_label')
  },
  'context_selectAllTabs': {
    title: browser.i18n.getMessage('tabContextMenu_selectAllTabs_label')
  },
  'context_bookmarkTab': {
    title:              browser.i18n.getMessage('tabContextMenu_bookmark_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_bookmark_label_multiselected')
  },
  'context_reopenInContainer': {
    title: browser.i18n.getMessage('tabContextMenu_reopenInContainer_label')
  },
  'context_moveTab': {
    title:              browser.i18n.getMessage('tabContextMenu_moveTab_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_moveTab_label_multiselected')
  },
  'context_moveTabToStart': {
    parentId: 'context_moveTab',
    title:    browser.i18n.getMessage('tabContextMenu_moveTabToStart_label')
  },
  'context_moveTabToEnd': {
    parentId: 'context_moveTab',
    title:    browser.i18n.getMessage('tabContextMenu_moveTabToEnd_label')
  },
  'context_openTabInWindow': {
    parentId: 'context_moveTab',
    title:    browser.i18n.getMessage('tabContextMenu_tearOff_label')
  },
  'context_separator:afterSendTab': {
    type: 'separator'
  },
  'context_bookmarkAllTabs': {
    title: browser.i18n.getMessage('tabContextMenu_bookmarkAll_label')
  },
  'context_reloadAllTabs': {
    title: browser.i18n.getMessage('tabContextMenu_reloadAll_label')
  },
  'context_separator:afterReloadAll': {
    type: 'separator'
  },
  'context_closeTabsToTheEnd': {
    title:    browser.i18n.getMessage('tabContextMenu_closeTabsToBottom_label')
  },
  'context_closeOtherTabs': {
    title:    browser.i18n.getMessage('tabContextMenu_closeOther_label')
  },
  'context_undoCloseTab': {
    title: browser.i18n.getMessage('tabContextMenu_undoClose_label')
  },
  'context_closeTab': {
    title:              browser.i18n.getMessage('tabContextMenu_close_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_close_label_multiselected')
  },
  'lastSeparatorBeforeExtraItems': {
    type: 'separator'
  },
  'invertSelection': {
    title: browser.i18n.getMessage('context_invertSelection_label')
  },


  'global_invertSelection': {
    title: browser.i18n.getMessage('context_invertSelection_label'),
    viewTypes: ['tab', 'sidebar'],
    documentUrlPatterns: null,
    TST: true
  },

  'selection': {
    title: browser.i18n.getMessage('context_selection_label'),
    viewTypes: ['tab', 'sidebar'],
    documentUrlPatterns: null,
    TST: true
  },
  'selection_invertSelection': {
    title: browser.i18n.getMessage('context_invertSelection_label'),
    viewTypes: ['tab', 'sidebar'],
    documentUrlPatterns: null,
    parentId: 'selection',
    TST: true
  }
};

const mExtraItems = new Map();

const POPUP_URL_PATTERN = [`moz-extension://${location.host}/*`];

export function init() {
  browser.runtime.onMessage.addListener(onMessage);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);

  for (const id of Object.keys(mItemsById)) {
    const item = mItemsById[id];
    item.id          = id;
    item.lastTitle   = item.title;
    item.lastVisible = true;
    item.lastEnabled = true;
    const info = {
      id,
      title:     item.title,
      type:      item.type || 'normal',
      contexts:  ['tab'],
      viewTypes: 'viewTypes' in item ? item.viewTypes : ['popup'],
      documentUrlPatterns: 'documentUrlPatterns' in item ? item.documentUrlPatterns : POPUP_URL_PATTERN
    };
    if (item.parentId)
      info.parentId = item.parentId;
    browser.menus.create(info);

    if (item.TST)
      browser.runtime.sendMessage(Constants.kTST_ID, {
        type:   Constants.kTSTAPI_CONTEXT_MENU_CREATE,
        params: info
      }).catch(handleMissingReceiverError);
  }

  browser.menus.onShown.addListener(onShown);
  browser.menus.onClicked.addListener(onClick);

  updateContextualIdentities();
  browser.contextualIdentities.onCreated.addListener(updateContextualIdentities);
  browser.contextualIdentities.onRemoved.addListener(updateContextualIdentities);
  browser.contextualIdentities.onUpdated.addListener(updateContextualIdentities);
}

const mContextualIdentityItems = new Set();
async function updateContextualIdentities() {
  for (const item of mContextualIdentityItems.values()) {
    const id = item.id;
    if (id in mItemsById)
      delete mItemsById[id];
    browser.menus.remove(id);
  }
  mContextualIdentityItems.clear();

  const defaultItem = {
    parentId:  'context_reopenInContainer',
    id:        'context_reopenInContainer:firefox-default',
    title:     browser.i18n.getMessage('tabContextMenu_reopenInContainer_noContainer_label'),
    contexts:  ['tab'],
    viewTypes: ['popup'],
    documentUrlPatterns: POPUP_URL_PATTERN
  };
  browser.menus.create(defaultItem);
  mContextualIdentityItems.add(defaultItem);

  const defaultSeparator = {
    parentId:  'context_reopenInContainer',
    id:        'context_reopenInContainer_separator',
    type:      'separator',
    contexts:  ['tab'],
    viewTypes: ['popup'],
    documentUrlPatterns: POPUP_URL_PATTERN
  };
  browser.menus.create(defaultSeparator);
  mContextualIdentityItems.add(defaultSeparator);

  const identities = await browser.contextualIdentities.query({});
  for (const identity of identities) {
    const id = `context_reopenInContainer:${identity.cookieStoreId}`;
    const icon = identity.icon && identity.color ?
      `/resources/icons/contextual-identities/${identity.icon}.svg#${identity.color}` :
      identity.iconUrl;
    const item = {
      parentId: 'context_reopenInContainer',
      id:       id,
      title:    identity.name.replace(/^([a-z0-9])/i, '&$1'),
      contexts: ['tab'],
      viewTypes: ['popup'],
      documentUrlPatterns: POPUP_URL_PATTERN
    };
    if (icon)
      item.icons = { 16: icon };
    browser.menus.create(item);
    mContextualIdentityItems.add(item);
  }
  for (const item of mContextualIdentityItems.values()) {
    mItemsById[item.id] = item;
    item.lastVisible = true;
    item.lastEnabled = true;
  }
}

function updateItem(id, state = {}) {
  let modified = false;
  const item = mItemsById[id];
  const updateInfo = {
    visible: 'visible' in state ? !!state.visible : true,
    enabled: 'enabled' in state ? !!state.enabled : true
  };
  const title = state.multiselected ? item.titleMultiselected || item.title : item.title;
  if (title) {
    updateInfo.title = title;
    modified = title != item.lastTitle;
    item.lastTitle = updateInfo.title;
  }
  if (!modified)
    modified = updateInfo.visible != item.lastVisible ||
                 updateInfo.enabled != item.lastEnabled;
  item.lastVisible = updateInfo.visible;
  item.lastEnabled = updateInfo.enabled;
  if (modified) {
    browser.menus.update(id, updateInfo);
    if (item.TST)
      browser.runtime.sendMessage(Constants.kTST_ID, {
        type:   Constants.kTSTAPI_CONTEXT_MENU_UPDATE,
        params: [id, updateInfo]
      }).catch(handleMissingReceiverError);
  }

  return modified;
}

async function onShown(info, contextTab, givenSelectedTabs = null) {
  log('onShown ', { info, contextTab, givenSelectedTabs });

  const window   = await (contextTab ? browser.windows.get(contextTab.windowId, { populate: true }) : browser.windows.getLastFocused({ populate: true }));
  const windowId = window.id;
  const selectedTabs = givenSelectedTabs || await Selection.getSelection(windowId);

  const hasMultipleTabs       = window.tabs.length > 1;
  const normalTabsCount       = window.tabs.filter(tab => !tab.pinned).length;
  const hasMultipleNormalTabs = normalTabsCount > 1;
  const multiselected         = selectedTabs.length > 1;
  const visibleTabs           = window.tabs.filter(tab => !tab.hidden);
  const previousTab           = contextTab.index > 0 ? window.tabs[contextTab.index - 1] : null;
  const nextTab               = contextTab.index < window.tabs.length ? window.tabs[contextTab.index + 1] : null;

  let modifiedItemsCount = 0;
  let visibleItemsCount = 0;

  // ESLint reports "short circuit" error for following codes.
  //   https://eslint.org/docs/rules/no-unused-expressions#allowshortcircuit
  // To allow those usages, I disable the rule temporarily.
  /* eslint-disable no-unused-expressions */

  updateItem('context_reloadTab', {
    visible: (contextTab || multiselected) && ++visibleItemsCount,
    multiselected: multiselected || !contextTab
  }) && modifiedItemsCount++;
  updateItem('context_toggleMuteTab-mute', {
    visible: contextTab && (!contextTab.mutedInfo || !contextTab.mutedInfo.muted) && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_toggleMuteTab-unmute', {
    visible: contextTab && contextTab.mutedInfo && contextTab.mutedInfo.muted && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_pinTab', {
    visible: contextTab && !contextTab.pinned && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_unpinTab', {
    visible: contextTab && contextTab.pinned && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_duplicateTab', {
    visible: contextTab && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_separator:afterDuplicate', {
    visible: contextTab && visibleItemsCount > 0
  }) && modifiedItemsCount++;
  visibleItemsCount = 0;

  updateItem('context_bookmarkSelected', {
    visible: !contextTab && ++visibleItemsCount
  }) && modifiedItemsCount++;
  updateItem('context_selectAllTabs', {
    visible: ++visibleItemsCount,
    enabled: !contextTab || selectedTabs.length < visibleTabs.length,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_bookmarkTab', {
    visible: contextTab && ++visibleItemsCount,
    multiselected: multiselected || !contextTab
  }) && modifiedItemsCount++;

  let showContextualIdentities = false;
  for (const item of mContextualIdentityItems.values()) {
    const id = item.id;
    let visible = contextTab && id != `context_reopenInContainer:${contextTab.cookieStoreId}`;
    if (id == 'context_reopenInContainer_separator')
      visible = contextTab && contextTab.cookieStoreId != 'firefox-default';
    updateItem(id, { visible }) && modifiedItemsCount++;
    if (visible)
      showContextualIdentities = true;
  }
  updateItem('context_reopenInContainer', {
    visible: contextTab && showContextualIdentities && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_moveTab', {
    visible: contextTab && ++visibleItemsCount,
    enabled: contextTab && hasMultipleTabs,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_moveTabToStart', {
    enabled: contextTab && hasMultipleTabs && previousTab && (previousTab.pinned == contextTab.pinned),
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_moveTabToEnd', {
    enabled: contextTab && hasMultipleTabs && nextTab && (nextTab.pinned == contextTab.pinned),
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_openTabInWindow', {
    enabled: contextTab && hasMultipleTabs,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_separator:afterSendTab', {
    visible: contextTab && visibleItemsCount > 0
  }) && modifiedItemsCount++;
  visibleItemsCount = 0;

  updateItem('context_closeTabsToTheEnd', {
    visible: contextTab && ++visibleItemsCount,
    enabled: hasMultipleNormalTabs && contextTab && nextTab,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_closeOtherTabs', {
    visible: contextTab && ++visibleItemsCount,
    enabled: hasMultipleNormalTabs,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_undoCloseTab', {
    visible: ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_closeTab', {
    visible: contextTab && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;

  visibleItemsCount = 0;

  const showInvertSelection = configs.context_invertSelection && selectedTabs.length > 0 && selectedTabs.length < visibleTabs.length && ++visibleItemsCount;

  updateItem('invertSelection', {
    visible: showInvertSelection
  }) && modifiedItemsCount++;
  updateItem('global_invertSelection', {
    visible: showInvertSelection && visibleItemsCount == 1
  }) && modifiedItemsCount++;
  updateItem('selection_invertSelection', {
    visible: showInvertSelection && visibleItemsCount > 1
  }) && modifiedItemsCount++;

  updateItem('selection', {
    visible: visibleItemsCount > 1,
  }) && modifiedItemsCount++;

  const forExtraItems = givenSelectedTabs && mExtraItems.size > 0 && Array.from(mExtraItems.values()).some(item => item.visible !== false)
  updateItem('lastSeparatorBeforeExtraItems', {
    visible: (forExtraItems || visibleItemsCount > 0) && ++visibleItemsCount
  }) && modifiedItemsCount++;

  /* eslint-enable no-unused-expressions */

  if (modifiedItemsCount)
    browser.menus.refresh();
}

async function onClick(info, contextTab) {
  //log('context menu item clicked: ', info, contextTab);
  const window            = await browser.windows.getLastFocused({ populate: true });
  const contextWindowId   = window.id;

  const multiselectedTabs = await Selection.getSelection(contextWindowId);
  const isMultiselected   = multiselectedTabs.length > 1;

  const activeTab = window.tabs.find(tab => tab.active);

  switch (info.menuItemId) {
    case 'context_reloadTab':
      if (isMultiselected) {
        for (const tab of multiselectedTabs) {
          browser.tabs.reload(tab.id);
        }
      }
      else {
        browser.tabs.reload(activeTab.id);
      }
      break;
    case 'context_toggleMuteTab-mute':
      if (isMultiselected) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.id, { muted: true });
        }
      }
      else {
        browser.tabs.update(contextTab.id, { muted: true });
      }
      break;
    case 'context_toggleMuteTab-unmute':
      if (isMultiselected) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.id, { muted: false });
        }
      }
      else {
        browser.tabs.update(contextTab.id, { muted: false });
      }
      break;
    case 'context_pinTab':
      if (isMultiselected) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.id, { pinned: true });
        }
      }
      else {
        browser.tabs.update(contextTab.id, { pinned: true });
      }
      break;
    case 'context_unpinTab':
      if (isMultiselected) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.id, { pinned: false });
        }
      }
      else {
        browser.tabs.update(contextTab.id, { pinned: false });
      }
      break;
    case 'context_duplicateTab':
      if (isMultiselected) {
        for (const tab of multiselectedTabs) {
          browser.tabs.duplicate(tab.id);
        }
      }
      else {
        browser.tabs.duplicate(contextTab.id);
      }
      break;
    case 'context_moveTabToStart': {
      const movedTabs   = isMultiselected ? multiselectedTabs : [contextTab];
      const movedTabIds = movedTabs.map(tab => tab.id);
      const doneByTST = await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_MOVE_TO_START,
        tabs: movedTabIds
      }).catch(handleMissingReceiverError);
      if (doneByTST)
        break;
      const allTabs   = window.tabs.filter(tab => tab.pinned == contextTab.pinned);
      const otherTabs = allTabs.filter(tab => !movedTabIds.includes(tab.id));
      if (otherTabs.length > 0)
        await browser.tabs.move(movedTabs.map(tab => tab.id), { index: otherTabs[0].index });
    }; break;
    case 'context_moveTabToEnd': {
      const movedTabs   = isMultiselected ? multiselectedTabs : [contextTab];
      const movedTabIds = movedTabs.map(tab => tab.id);
      const doneByTST = await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_MOVE_TO_END,
        tabs: movedTabIds
      }).catch(handleMissingReceiverError);
      if (doneByTST)
        break;
      const allTabs   = window.tabs.filter(tab => tab.pinned == contextTab.pinned);
      const otherTabs = allTabs.filter(tab => !movedTabIds.includes(tab.id));
      if (otherTabs.length > 0)
        await browser.tabs.move(movedTabs.map(tab => tab.id), { index: window.tabs.length - 1 });
    }; break;
    case 'context_openTabInWindow': {
      const doneByTST = await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_OPEN_IN_NEW_WINDOW,
        tabs: (isMultiselected ? multiselectedTabs : [contextTab]).map(tab => tab.id)
      }).catch(handleMissingReceiverError);
      if (doneByTST)
        break;
      if (isMultiselected) {
        await Commands.moveToWindow(multiselectedTabs.map(tab => tab.id));
      }
      else {
        await browser.windows.create({
          tabId:     contextTab.id,
          incognito: contextTab.incognito
        });
      }
    }; break;
    case 'context_selectAllTabs': {
      const tabs = await browser.tabs.query({ windowId: contextWindowId });
      browser.tabs.highlight({
        windowId: contextWindowId,
        populate: false,
        tabs:     tabs.map(tab => tab.index)
      });
    }; break;
    case 'context_bookmarkTab':
      if (!isMultiselected) {
        await Commands.bookmarkTabs([(contextTab || activeTab).id]);
        break;
      }
    case 'context_bookmarkAllTabs':
      await Commands.bookmarkTabs(multiselectedTabs.map(tab => tab.id));
      break;
    case 'context_reloadAllTabs': {
      const tabs = await browser.tabs.query({ windowId: contextWindowId }) ;
      for (const tab of tabs) {
        browser.tabs.reload(tab.id);
      }
    }; break;
    case 'context_closeTabsToTheEnd': {
      const tabs = await browser.tabs.query({ windowId: contextWindowId });
      let after = false;
      const closeTabs = [];
      const keptTabIds = isMultiselected ?
        multiselectedTabs.map(tab => tab.id) :
        [contextTab.id] ;
      for (const tab of tabs) {
        if (keptTabIds.includes(tab.id)) {
          after = true;
          continue;
        }
        if (after && !tab.pinned)
          closeTabs.push(tab);
      }
      /*
      const canceled = (await browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_NOTIFY_TABS_CLOSING,
        count:    closeTabs.length,
        windowId: contextWindowId
      })) === false
      if (canceled)
        break;
      */
      browser.tabs.remove(closeTabs.map(tab => tab.id));
    }; break;
    case 'context_closeOtherTabs': {
      const tabs  = await browser.tabs.query({ windowId: contextWindowId });
      const keptTabIds = isMultiselected ?
        multiselectedTabs.map(tab => tab.id) :
        [contextTab.id] ;
      const closeTabs = tabs.filter(tab => !tab.pinned && !keptTabIds.includes(tab.id)).map(tab => tab.id);
      /*
      const canceled = (await browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_NOTIFY_TABS_CLOSING,
        count:    closeTabs.length,
        windowId: contextWindowId
      })) === false
      if (canceled)
        break;
      */
      browser.tabs.remove(closeTabs);
    }; break;
    case 'context_undoCloseTab': {
      const sessions = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
      if (sessions.length && sessions[0].tab)
        browser.sessions.restore(sessions[0].tab.sessionId);
    }; break;
    case 'context_closeTab':
      if (isMultiselected) {
        // close down to top, to keep tree structure of Tree Style Tab
        multiselectedTabs.reverse();
        for (const tab of multiselectedTabs) {
          browser.tabs.remove(tab.id);
        }
      }
      else {
        browser.tabs.remove(contextTab.id);
      }
      break;

    case 'invertSelection':
      Selection.invert(contextWindowId);
      break;

    default: {
      const contextualIdentityMatch = info.menuItemId.match(/^context_reopenInContainer:(.+)$/);
      if (contextualIdentityMatch) {
        const sourceTabs = isMultiselected ? multiselectedTabs : [contextTab];
        const containerId = contextualIdentityMatch[1];
        const doneByTST = await browser.runtime.sendMessage(Constants.kTST_ID, {
          type: Constants.kTSTAPI_REOPEN_IN_CONTAINER,
          tabs: sourceTabs.map(tab => tab.id),
          containerId
        }).catch(handleMissingReceiverError);
        if (doneByTST)
          break;
        let index = sourceTabs[sourceTabs.length-1].index + 1;
        for (const sourceTab of sourceTabs) {
          await browser.tabs.create({
            windowId:      sourceTab.windowId,
            url:           sourceTab.url,
            cookieStoreId: containerId,
            index:         index++,
            active:        sourceTab == sourceTabs[0]
          });
        }
        break;
      }
      if (info.menuItemId.indexOf('extra:') == 0) {
        const idMatch   = info.menuItemId.match(/^extra:([^:]+):(.+)$/);
        const owner     = idMatch[1];
        const id        = idMatch[2];
        const selection = await Selection.getSelectionAndOthers(contextWindowId);
        browser.runtime.sendMessage(owner, {
          type: Constants.kMTHAPI_INVOKE_SELECTED_TAB_COMMAND,
          id,
          selection
        }).catch(_e => {});
      }
    }; break;
  }
}


function onMessage(message) {
  if (!message || !message.type)
    return;

  switch (message.type) {
    case Constants.kCOMMAND_PULL_ACTIVE_CONTEXT_MENU_INFO: return (async () => {
      const tabs = await Promise.all(message.tabIds.map(id => browser.tabs.get(id)));
      await onShown({}, tabs[0], tabs);
      let visibleItems = [];
      for (const id of Object.keys(mItemsById)) {
        const item = mItemsById[id];
        if (item.lastVisible &&
            (!item.viewTypes ||
             item.viewTypes.includes('popup')))
          visibleItems.push(item);
      }
      visibleItems = visibleItems.concat(Array.from(mExtraItems.values()));
      return visibleItems;
    })();

    case Constants.kCOMMAND_SELECTION_MENU_ITEM_CLICK:
      return onClick({ menuItemId: message.id }, message.contextTab);
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
      mExtraItems.set(`${sender.id}:${message.id}`, message);
      log('menu becomes dirty by added command from other addon');
      return Promise.resolve(true);
    };

    case Constants.kMTHAPI_REMOVE_SELECTED_TAB_COMMAND:
      mExtraItems.delete(`${sender.id}:${message.id}`);
      log('menu becomes dirty by removed command from other addon');
      return Promise.resolve(true);

    case Constants.kMTHAPI_REMOVE_ALL_SELECTED_TAB_COMMANDS:
      for (const key of mExtraItems.keys()) {
        if (key.indexOf(`${sender.id}:`) == 0) {
          mExtraItems.delete(key);
        }
      }
      return Promise.resolve(true);
  }
}

let mLastSelection;

function onTSTAPIMessage(message) {
  switch (message.type) {
    case Constants.kTSTAPI_CONTEXT_MENU_CLICK:
      return onClick(message.info, message.tab);
    case Constants.kTSTAPI_CONTEXT_MENU_SHOWN:
      return onShown(message.info, message.tab, mLastSelection);
  }
}


DragSelectionManager.onDragSelectionEnd.addListener(async (message, selectionInfo) => {
  try {
    if (configs.autoOpenMenuOnDragEnd) {
      mLastSelection = selectionInfo.selection;
      await onShown({}, selectionInfo.dragStartTab, mLastSelection);
      await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_CONTEXT_MENU_OPEN,
        window: (await browser.windows.getLastFocused()).id,
        tab:  selectionInfo.dragStartTab.id,
        left: message.clientX,
        top:  message.clientY
      }).catch(handleMissingReceiverError);
      mLastSelection = null;
    }
  }
  catch(e) {
    log('failed to open context menu: ', e);
  }
});
