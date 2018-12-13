/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  wait,
  configs,
  handleMissingReceiverError
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as Selection from '/common/selection.js';
import * as Commands from '/common/commands.js';
import * as Permissions from '/common/permissions.js';
import * as DragSelectionManager from '/common/drag-selection-manager.js';
import RichConfirm from '/extlib/RichConfirm.js';
import * as ContextMenu from './context-menu.js';

log.context = 'BG';

window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;

  ContextMenu.init();

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
  const selectedTabs   = await Selection.getSelection(activeTab.windowId);
  const selectedTabIds = selectedTabs.map(tab => tab.id);

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
        await Selection.clear(activeTab.windowId);
        await Commands.copyToClipboard(selectedTabIds, formats[result.buttonIndex].format);
        Selection.select(selectedTabs);
      }
    } break;

    case 'saveSelectedTabs':
      await Selection.clear(activeTab.windowId);
      await wait(100); // to wait tab titles are updated
      await Commands.saveTabs(selectedTabIds);
      Selection.select(selectedTabs);
      break;

    case 'printSelectedTabs':
      break;

    case 'groupSelectedTabs':
      browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_GROUP_TABS,
        tabs: selectedTabIds
      }).catch(handleMissingReceiverError);
      break;

    case 'suspendSelectedTabs':
      Commands.suspendTabs(selectedTabIds);
      break;
    case 'resumeSelectedTabs':
      Commands.resumeTabs(selectedTabIds);
      break;

    case 'toggleSelection':
      Selection.toggle(activeTab);
      break;
    case 'selectAll':
      Selection.selectAll(activeTab.windowId);
      break;
    case 'invertSelection':
      Selection.invert();
      break;
  }
}

function onTSTAPIMessage(message) {
  switch (message.type) {
    case Constants.kTSTAPI_NOTIFY_READY:
      registerToTST();
      return Promise.resolve(true);

    case Constants.kTSTAPI_NOTIFY_TAB_MOUSEDOWN:
      if (message.soundButton)
        return;
      return DragSelectionManager.onClick(message);

    case Constants.kTSTAPI_NOTIFY_TAB_MOUSEUP:
      if (message.soundButton)
        return;
      return DragSelectionManager.onMouseUp(message);

    case Constants.kTSTAPI_NOTIFY_TABBAR_CLICKED:
      return DragSelectionManager.onNonTabAreaClick(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGREADY:
      if (!configs.enableDragSelection)
        return;
      return DragSelectionManager.onDragReady(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGCANCEL:
      if (!configs.enableDragSelection)
        return;
      return DragSelectionManager.onDragCancel(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGSTART:
      if (!configs.enableDragSelection)
        return;
      return DragSelectionManager.onDragStart(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGENTER:
      if (!configs.enableDragSelection)
        return;
      return DragSelectionManager.onDragEnter(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGEXIT:
      if (!configs.enableDragSelection)
        return;
      return DragSelectionManager.onDragExit(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGEND:
      if (!configs.enableDragSelection)
        return;
      return DragSelectionManager.onDragEnd(message);

    case Constants.kTSTAPI_NOTIFY_SIDEBAR_SHOW:
      Selection.getAllTabs(message.windowId || message.window).then(tabs => {
        Selection.notifyTabStateToTST(
          tabs,
          [Constants.kSELECTED, Constants.kREADY_TO_CLOSE],
          false
        );
      });
      return;
  }
}

function onMessageExternal(message, sender) {
  //log('onMessageExternal: ', message, sender);

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
      return Selection.getSelection();

    case Constants.kMTHAPI_SET_TAB_SELECTION:
      return (async () => {
        const allTabs = await Selection.getAllTabs(message.window || message.windowId)();
        const selectedTabs = await Selection.getAllTabs(message.window || message.windowId)();
        const toBeSelectedTabIds = new Set(selectedTabs.map(tab => tab.id));

        let unselectTabs = message.unselect;
        if (unselectTabs == '*') {
          unselectTabs = allTabs;
        }
        else {
          if (!Array.isArray(unselectTabs))
            unselectTabs = [unselectTabs];
          unselectTabs = allTabs.filter(tab => unselectTabs.indexOf(tab.id) > -1);
        }
        for (const tab of unselectTabs) {
          toBeSelectedTabIds.delete(tab.id);
        }

        let selectTabs = message.select;
        if (selectTabs == '*') {
          selectTabs = allTabs;
        }
        else {
          if (!Array.isArray(selectTabs))
            selectTabs = [selectTabs];
          selectTabs = allTabs.filter(tab => selectTabs.indexOf(tab.id) > -1);
        }
        for (const tab of selectTabs) {
          toBeSelectedTabIds.add(tab.id);
        }

        if (toBeSelectedTabIds.size == 0)
          toBeSelectedTabIds.add(allTabs.filter(tab => tab.active)[0].id);

        await Selection.select(allTabs.filter(tab => toBeSelectedTabIds.has(tab.id)));
        return true;
      })();

    case Constants.kMTHAPI_CLEAR_TAB_SELECTION:
      return Selection.clear().then(() => true);
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

configs.$addObserver(key => {
  switch (key) {
    case 'enableDragSelection':
      unregisterFromTST();
      registerToTST();
      break;
  }
});


async function registerToTST() {
  const baseListeningTypes = [
    Constants.kTSTAPI_NOTIFY_READY,
    Constants.kTSTAPI_NOTIFY_TAB_MOUSEDOWN,
    Constants.kTSTAPI_NOTIFY_TAB_MOUSEUP,
    Constants.kTSTAPI_NOTIFY_TABBAR_CLICKED,
    Constants.kTSTAPI_CONTEXT_MENU_CLICK,
    Constants.kTSTAPI_CONTEXT_MENU_SHOWN
  ];
  const dragSelectionListeningTypes = [
    Constants.kTSTAPI_NOTIFY_TAB_DRAGREADY,
    Constants.kTSTAPI_NOTIFY_TAB_DRAGCANCEL,
    Constants.kTSTAPI_NOTIFY_TAB_DRAGSTART,
    Constants.kTSTAPI_NOTIFY_TAB_DRAGENTER,
    Constants.kTSTAPI_NOTIFY_TAB_DRAGEXIT,
    Constants.kTSTAPI_NOTIFY_TAB_DRAGEND
  ];
  const listeningTypes = configs.enableDragSelection ?
    baseListeningTypes.concat(dragSelectionListeningTypes) :
    baseListeningTypes;
  try {
    await browser.runtime.sendMessage(Constants.kTST_ID, {
      type:  Constants.kTSTAPI_REGISTER_SELF,
      name:  browser.i18n.getMessage('extensionName'),
      icons: browser.runtime.getManifest().icons,
      listeningTypes,
      style: `
        .tab.${Constants.kSELECTED}::after,
        .mutiple-highlighted > .tab.highlighted::after {
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
        .tab.${Constants.kREADY_TO_CLOSE} .closebox {
          background: Highlight;
        }
      `
    }).catch(handleMissingReceiverError);
    DragSelectionManager.activateInVerticalTabbarOfTST();

    const allWindows = await browser.windows.getAll({ populate: true });
    for (const window of allWindows) {
      Selection.notifyTabStateToTST(
        window.tabs,
        [Constants.kSELECTED, Constants.kREADY_TO_CLOSE],
        false
      );
    }
  }
  catch(_e) {
    return false;
  }
}

function unregisterFromTST() {
  DragSelectionManager.deactivateInVerticalTabbarOfTST();
  try {
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_CONTEXT_MENU_REMOVE_ALL
    }).catch(handleMissingReceiverError);
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_UNREGISTER_SELF
    }).catch(handleMissingReceiverError);
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

// This section should be removed and define those context-fill icons
// statically on manifest.json after Firefox ESR66 (or 67) is released.
// See also: https://github.com/piroor/multipletab/issues/215
async function applyThemeColorToIcon() {
  const browserInfo = await browser.runtime.getBrowserInfo();
  if (configs.applyThemeColorToIcon &&
      parseInt(browserInfo.version.split('.')[0]) >= 62)
    browser.browserAction.setIcon({ path: browser.runtime.getManifest().icons });
}
configs.$addObserver(key => {
  if (key == 'applyThemeColorToIcon')
    applyThemeColorToIcon();
});
configs.$loaded.then(applyThemeColorToIcon);
