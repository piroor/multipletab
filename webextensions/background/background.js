/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  wait,
  configs
} from '../common/common.js';
import * as Constants from '../common/constants.js';
import * as Selections from '../common/selections.js';
import * as Commands from '../common/commands.js';
import * as Permissions from '../common/permissions.js';
import * as DragSelection from '../common/drag-selection.js';
import * as SharedState from '../common/shared-state.js';
import RichConfirm from '../extlib/RichConfirm.js';
import TabIdFixer from '../extlib/TabIdFixer.js';
import * as ContextMenu from './context-menu.js';

log.context = 'BG';

window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;

  browser.tabs.onActivated.addListener((activeInfo) => {
    if (!Selections.selection.tabs[TabIdFixer.fixTabId(activeInfo.tabId)])
      Commands.clearSelection();
  });
  browser.tabs.onCreated.addListener(() => Commands.clearSelection());
  browser.tabs.onRemoved.addListener(() => Commands.clearSelection());

  ContextMenu.init();
  SharedState.initAsMaster();

  browser.browserAction.onClicked.addListener(onToolbarButtonClick);
  browser.browserAction.setPopup({ popup: Constants.kPOPUP_URL });
  Permissions.clearRequest();

  browser.commands.onCommand.addListener(onShortcutCommand);

  browser.runtime.onMessage.addListener(onMessage);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
  registerToTST();

  notifyReady();
  notifyUpdatedFromLegacy();

  window.addEventListener('pagehide', async () => {
    unregisterFromTST();
  }, { once: true });
}, { once: true });


/*  listen events */

function onToolbarButtonClick(_tab) {
  Permissions.requestPostProcess();
  setTimeout(() => {
    browser.browserAction.setPopup({ popup: Constants.kPOPUP_URL });
  }, 0);
}

async function onShortcutCommand(command) {
  const activeTab = (await browser.tabs.query({
    active:        true,
    currentWindow: true
  }))[0];
  const selectedTabIds = Commands.getSelectedTabIds();

  if (selectedTabIds.length <= 0)
    return;

  switch (command) {
    case 'reloadSelectedTabs':
      Commands.reloadTabs(selectedTabIds);
      break;
    case 'bookmarkSelectedTabs':
      Commands.bookmarkTabs(selectedTabIds);
      break;

    case 'duplicateSelectedTabs':
      Commands.duplicateTabs(selectedTabIds);
      break;

    case 'pinSelectedTabs':
      Commands.pinTabs(selectedTabIds);
      break;
    case 'unpinSelectedTabs':
      Commands.unpinTabs(selectedTabIds);
      break;
    case 'muteSelectedTabs':
      Commands.muteTabs(selectedTabIds);
      break;
    case 'unmuteSelectedTabs':
      Commands.unmuteTabs(selectedTabIds);
      break;

    case 'moveSelectedTabsToNewWindow':
      Commands.moveToWindow(selectedTabIds);
      break;

    case 'moveSelectedTabsToOtherWindow': {
      const otherWindows = (await browser.windows.getAll()).filter(window => window.id != activeTab.windowId);
      if (otherWindows.length <= 0)
        return Commands.moveToWindow(selectedTabIds);
      const result = await RichConfirm.showInTab(activeTab.id, {
        message: browser.i18n.getMessage('command_moveSelectedTabsToOtherWindow_message'),
        buttons: otherWindows.map(window => window.title)
      });
      if (result.buttonIndex > -1)
        Commands.moveToWindow(selectedTabIds, otherWindows[result.buttonIndex].id);
    }; break;

    case 'removeSelectedTabs':
      Commands.removeTabs(selectedTabIds);
      break;
    case 'removeUnselectedTabs':
      Commands.removeOtherTabs(selectedTabIds);
      break;

    case 'copySelectedTabs': {
      let formats;
      if (!Array.isArray(configs.copyToClipboardFormats)) { // migrate to array
        formats = [];
        for (const label of Object.keys(configs.copyToClipboardFormats)) {
          formats.push({
            label:  label,
            format: configs.copyToClipboardFormats[label]
          });
        }
      }
      else {
        formats = configs.copyToClipboardFormats;
      }
      const result = await RichConfirm.showInTab(activeTab.id, {
        message: browser.i18n.getMessage('command_copySelectedTabs_message'),
        buttons: formats.map(format => format.label)
      });
      if (result.buttonIndex > -1) {
        await Commands.clearSelection();
        await wait(100); // to wait tab titles are updated
        await Commands.copyToClipboard(selectedTabIds, formats[result.buttonIndex].format);
        const tabs = await Commands.getAllTabs(activeTab.windowId);
        tabs.filter(tab => selectedTabIds.indexOf(tab.id) > -1)
          .forEach(tab => Commands.setSelection(tab, true));
      }
    } break;

    case 'saveSelectedTabs':
      await Commands.clearSelection();
      await wait(100); // to wait tab titles are updated
      await Commands.saveTabs(selectedTabIds);
      const tabs = await Commands.getAllTabs(activeTab.windowId);
      tabs.filter(tab => selectedTabIds.indexOf(tab.id) > -1)
        .forEach(tab => Commands.setSelection(tab, true));
      break;

    case 'printSelectedTabs':
      break;

    case 'groupSelectedTabs':
      browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_GROUP_TABS,
        tabs: selectedTabIds
      }).catch(_e => {});
      break;

    case 'suspendSelectedTabs':
      Commands.suspendTabs(selectedTabIds);
      break;
    case 'resumeSelectedTabs':
      Commands.resumeTabs(selectedTabIds);
      break;

    case 'toggleSelection':
      Commands.setSelection(activeTab, selectedTabIds.indexOf(activeTab.id) < 0);
      break;
    case 'selectAll':
      Commands.selectAllTabs();
      break;
    case 'invertSelection':
      Commands.invertSelection();
      break;
  }
}

function onTSTAPIMessage(message) {
  switch (message.type) {
    case Constants.kTSTAPI_NOTIFY_READY:
      registerToTST();
      return Promise.resolve(true);

    case Constants.kTSTAPI_NOTIFY_TAB_MOUSEDOWN:
      return DragSelection.onTabItemClick(message);

    case Constants.kTSTAPI_NOTIFY_TAB_MOUSEUP:
      return DragSelection.onTabItemMouseUp(message);

    case Constants.kTSTAPI_NOTIFY_TABBAR_CLICKED:
      return DragSelection.onNonTabAreaClick(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGREADY:
      return DragSelection.onTabItemDragReady(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGCANCEL:
      return DragSelection.onTabItemDragCancel(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGSTART:
      return DragSelection.onTabItemDragStart(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGENTER:
      return DragSelection.onTabItemDragEnter(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGEXIT:
      return DragSelection.onTabItemDragExit(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGEND:
      return DragSelection.onTabItemDragEnd(message);
  }
}

function onMessageExternal(message, sender) {
  if (configs.debug)
    console.log('onMessageExternal: ', message, sender);

  switch (sender.id) {
    case Constants.kTST_ID: { // Tree Style Tab API
      const result = onTSTAPIMessage(message);
      if (result !== undefined)
        return result;
    }; break;

    default:
      break;
  }

  if (!message ||
      typeof message.type != 'string')
    return;

  switch (message.type) {
    case Constants.kMTHAPI_GET_TAB_SELECTION:
      return Commands.getAPITabSelection();

    case Constants.kMTHAPI_SET_TAB_SELECTION:
      return (async () => {
        const allTabs = await Commands.getAllTabs(message.window || message.windowId);

        let unselectTabs = message.unselect;
        if (unselectTabs == '*') {
          unselectTabs = allTabs;
        }
        else {
          if (!Array.isArray(unselectTabs))
            unselectTabs = [unselectTabs];
          unselectTabs = allTabs.filter(tab => unselectTabs.indexOf(tab.id) > -1);
        }
        Commands.setSelection(unselectTabs, false, {
          globalHighlight: !DragSelection.isActivatedInVerticalTabbarOfTST()
        });

        let selectTabs = message.select;
        if (selectTabs == '*') {
          selectTabs = allTabs;
        }
        else {
          if (!Array.isArray(selectTabs))
            selectTabs = [selectTabs];
          selectTabs = allTabs.filter(tab => selectTabs.indexOf(tab.id) > -1);
        }
        Commands.setSelection(selectTabs, true, {
          globalHighlight: !DragSelection.isActivatedInVerticalTabbarOfTST()
        });

        return true;
      })();

    case Constants.kMTHAPI_CLEAR_TAB_SELECTION:
      Commands.clearSelection();
      return Promise.resolve(true);
  }
}

function onMessage(message) {
  if (!message || !message.type)
    return;

  switch (message.type) {
    case Constants.kCOMMAND_UNREGISTER_FROM_TST:
      unregisterFromTST();
      break;
  }
}


async function registerToTST() {
  try {
    await browser.runtime.sendMessage(Constants.kTST_ID, {
      type:  Constants.kTSTAPI_REGISTER_SELF,
      name:  browser.i18n.getMessage('extensionName'),
      icons: browser.runtime.getManifest().icons,
      listeningTypes: [
        Constants.kTSTAPI_NOTIFY_READY,
        Constants.kTSTAPI_NOTIFY_TAB_MOUSEDOWN,
        Constants.kTSTAPI_NOTIFY_TAB_MOUSEUP,
        Constants.kTSTAPI_NOTIFY_TABBAR_CLICKED,
        Constants.kTSTAPI_NOTIFY_TAB_DRAGREADY,
        Constants.kTSTAPI_NOTIFY_TAB_DRAGCANCEL,
        Constants.kTSTAPI_NOTIFY_TAB_DRAGSTART,
        Constants.kTSTAPI_NOTIFY_TAB_DRAGENTER,
        Constants.kTSTAPI_NOTIFY_TAB_DRAGEXIT,
        Constants.kTSTAPI_NOTIFY_TAB_DRAGEND
      ],
      style: `
        .tab.selected::after {
          background: Highlight;
          bottom: 0;
          content: " ";
          display: block;
          left: 0;
          opacity: 0.5;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 0;
          z-index: 10;
        }

        /* ::after pseudo element prevents firing of dragstart event */
        .tab.ready-to-close .closebox {
          background: Highlight;
        }
      `
    });
    DragSelection.activateInVerticalTabbarOfTST();
    // force rebuild menu
    return ContextMenu.reserveRefreshItems(null, true).then(() => true);
  }
  catch(_e) {
    return false;
  }
}

function unregisterFromTST() {
  DragSelection.deactivateInVerticalTabbarOfTST();
  try {
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_CONTEXT_MENU_REMOVE_ALL
    });
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_UNREGISTER_SELF
    });
  }
  catch(_e) {
  }
}


async function notifyReady() {
  const addons   = configs.cachedExternalAddons;
  let modified = false;
  for (const id of Object.keys(addons)) {
    try {
      browser.runtime.sendMessage(id, { type: Constants.kMTHAPI_READY });
    }
    catch(_e) {
      delete addons[id];
      modified = true;
    }
  }
  if (modified)
    configs.cachedExternalAddons = addons;
}

// migration

browser.runtime.onInstalled.addListener(details => {
  /* When MTH 2 (or later) is newly installed, this listener is invoked.
     We should not notify "updated from legacy" for this case.
     On the other hand, when MTH is updated from legacy to 2 (or later),
     this listener is not invoked with the reason "install" and
     invoked with the reason "updated" after Firefox is restarted. */
  if (details.reason == 'install')
    configs.shouldNotifyUpdatedFromLegacyVersion = false;
});

async function notifyUpdatedFromLegacy() {
  if (!configs.shouldNotifyUpdatedFromLegacyVersion)
    return;
  configs.shouldNotifyUpdatedFromLegacyVersion = false;

  const tab = await browser.tabs.create({
    url:    browser.extension.getURL('resources/updated-from-legacy.html'),
    active: true
  });
  const title       = `${browser.i18n.getMessage('extensionName')} ${browser.runtime.getManifest().version}`
  const description = browser.i18n.getMessage('message_updatedFromLegacy_description');
  browser.tabs.executeScript(tab.id, {
    code: `
      document.querySelector('#title').textContent = document.title = ${JSON.stringify(title)};
      document.querySelector('#description').innerHTML = ${JSON.stringify(description)};
      location.replace('data:text/html,' + encodeURIComponent(document.documentElement.innerHTML));
    `
  });

  browser.runtime.onMessage.addListener(function onMessage(message, _sender) {
    if (message &&
        typeof message.type == 'string' &&
        message.type == Constants.kCOMMAND_NOTIFY_PANEL_SHOWN) {
      browser.runtime.onMessage.removeListener(onMessage);
      browser.tabs.remove(tab.id)
        .catch(_e => {}); // ignore already closed tab
    }
  });
}
