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
import * as Permissions from '/common/permissions.js';
import * as DragSelectionManager from '/common/drag-selection-manager.js';
import * as TabSanitizer from '/common/tab-sanitizer.js';
import * as ContextMenu from './context-menu.js';

log.context = 'BG';

const kFEATURES_VERSION = 1;

window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;

  ContextMenu.init();

  browser.browserAction.onClicked.addListener(onToolbarButtonClick);
  browser.browserAction.setPopup({ popup: Constants.kPOPUP_URL });
  Permissions.clearRequest();

  browser.commands.onCommand.addListener(onShortcutCommand);

  browser.runtime.onMessage.addListener(onMessage);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);

  browser.windows.getAll({}).then(windows => {
    windows.forEach(onWindowCreated);
  });

  browser.windows.onCreated.addListener(onWindowCreated);
  browser.windows.onRemoved.addListener(onWindowRemoved);

  registerToTST();

  notifyReady();

  window.addEventListener('pagehide', async () => {
    unregisterFromTST();
  }, { once: true });

  if (!(await notifyUpdatedFromLegacy()))
    notifyNewFeatures();
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
    case 'invertSelection':
      Selection.invert();
      break;
  }
}

function onWindowCreated(window) {
  const dragSelection = DragSelectionManager.getDragSelection(window.id);
  dragSelection.onSelectionChange.addListener(onSelectionChange);
}

function onWindowRemoved(windowId) {
  const dragSelection = DragSelectionManager.getDragSelection(windowId);
  dragSelection.onSelectionChange.removeListener(onSelectionChange);
}

async function onSelectionChange(info) {
  if (info.bySelf)
    return;
  const tab = info.selected.length > 0 ? info.selected[0] : info.unselected[0];
  if (!tab)
    return;
  const selectedTabs = await browser.tabs.query({ windowId: tab.windowId, highlighted: true });
  if (selectedTabs.length == 1 &&
      (info.unselected.length > 1 /* multiple tabs are unselected */ ||
       info.selected.length == 0 /* one tab is unselected and no new tab is newly selected */) &&
      !info.clear) {
    info.dragSelection.clear({
      selected:   info.selected,
      unselected: info.unselected,
      force:      true
    });
  }
}

let TSTLongPressTimer;
let mousedownHandled = false;

function onTSTAPIMessage(message) {
  switch (message.type) {
    case Constants.kTSTAPI_NOTIFY_READY:
    case Constants.kTSTAPI_PERMISSIONS_CHANGED:
      registerToTST();
      return Promise.resolve(true);

    case Constants.kTSTAPI_NOTIFY_TAB_MOUSEDOWN:
      if (message.twisty || message.soundButton) {
        mousedownHandled = false;
        return;
      }
      mousedownHandled = true;
      return DragSelectionManager.onMouseDown(message).then(action => {
        if (action & Constants.kCLICK_ACTION_REGULAR_CLICK &&
            configs.enableDragSelectionByLongPress) {
          TSTLongPressTimer = setTimeout(async () => {
            TSTLongPressTimer = undefined;
            const window = await browser.windows.get(message.window, { populate: true });
            if (window.tabs.filter(tab => tab.highlighted).length > 1)
              return; // don't clear existing multiselection
            browser.runtime.sendMessage(Constants.kTST_ID, {
              type:     Constants.kTSTAPI_START_CUSTOM_DRAG,
              windowId: message.windowId
            }).catch(handleMissingReceiverError);
            DragSelectionManager.onDragReady({
              tab:             message.tab,
              window:          message.windowId,
              windowId:        message.windowId,
              startOnClosebox: message.closebox
            });
          }, configs.longPressDuration);
        }

        return action & Constants.kCLICK_ACTION_MULTISELECTION ? true : false;
      });

    case Constants.kTSTAPI_NOTIFY_TAB_MOUSEUP:
      if (!mousedownHandled)
        return;
      if (TSTLongPressTimer) {
        clearTimeout(TSTLongPressTimer);
        TSTLongPressTimer = undefined;
      }
      return DragSelectionManager.onMouseUp(message);

    case Constants.kTSTAPI_NOTIFY_TABBAR_CLICKED:
      return DragSelectionManager.onNonTabAreaClick(message);

    //case Constants.kTSTAPI_NOTIFY_TAB_DRAGREADY:
    //  if (!configs.enableDragSelectionByLongPress)
    //    return;
    //  return DragSelectionManager.onDragReady(message);

    case Constants.kTSTAPI_NOTIFY_NATIVE_TAB_DRAGSTART:
      if (TSTLongPressTimer) {
        clearTimeout(TSTLongPressTimer);
        TSTLongPressTimer = undefined;
      }
      return;

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGCANCEL:
      if (!configs.enableDragSelectionByLongPress)
        return;
      return DragSelectionManager.onDragCancel(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGSTART:
      if (!configs.enableDragSelectionByLongPress)
        return;
      return DragSelectionManager.onDragStart(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGENTER:
      if (!configs.enableDragSelectionByLongPress)
        return;
      return DragSelectionManager.onDragEnter(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGEXIT:
      if (!configs.enableDragSelectionByLongPress)
        return;
      return DragSelectionManager.onDragExit(message);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGEND:
      if (!configs.enableDragSelectionByLongPress)
        return;
      return DragSelectionManager.onDragEnd(message);

    case Constants.kTSTAPI_NOTIFY_SIDEBAR_SHOW:
      Selection.clearTabStateFromTST(
        message.windowId || message.window.id,
        [Constants.kSELECTED, Constants.kREADY_TO_CLOSE],
        false
      );
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
      return (async () => {
        const highlightedTabs = await Selection.getSelection();
        return TabSanitizer.sanitize(highlightedTabs);
      })();

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
    case 'enableDragSelectionByLongPress':
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
    Constants.kTSTAPI_PERMISSIONS_CHANGED,
    Constants.kTSTAPI_CONTEXT_MENU_CLICK,
    Constants.kTSTAPI_CONTEXT_MENU_SHOWN
  ];
  const dragSelectionListeningTypes = [
    //Constants.kTSTAPI_NOTIFY_TAB_DRAGREADY,
    Constants.kTSTAPI_NOTIFY_NATIVE_TAB_DRAGSTART,
    Constants.kTSTAPI_NOTIFY_TAB_DRAGCANCEL,
    Constants.kTSTAPI_NOTIFY_TAB_DRAGSTART,
    Constants.kTSTAPI_NOTIFY_TAB_DRAGENTER,
    Constants.kTSTAPI_NOTIFY_TAB_DRAGEXIT,
    Constants.kTSTAPI_NOTIFY_TAB_DRAGEND
  ];
  const listeningTypes = configs.enableDragSelectionByLongPress ?
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
        .tab.${Constants.kREADY_TO_SELECT}::after {
          background: var(--multiselected-color);
          bottom: 0;
          content: " ";
          display: block;
          left: 0;
          opacity: var(--multiselected-color-opacity);
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 0;
          z-index: 10;
        }
        .tab.${Constants.kREADY_TO_SELECT}::after,
        .mutiple-highlighted > .tab.highlighted.${Constants.kREADY_TO_SELECT}::after {
          opacity: calc(var(--multiselected-color-opacity) + 0.15);
        }

        /* ::after pseudo element prevents firing of dragstart event */
        .tab.${Constants.kREADY_TO_CLOSE} tab-closebox,
        .tab.${Constants.kREADY_TO_CLOSE} .closebox /* for TST 3.1.8 or older */ {
          background: Highlight;
        }
      `
    }).catch(handleMissingReceiverError);

    const allWindows = await browser.windows.getAll({ populate: false });
    for (const window of allWindows) {
      Selection.clearTabStateFromTST(
        window.id,
        [Constants.kSELECTED, Constants.kREADY_TO_SELECT, Constants.kREADY_TO_CLOSE],
        false
      );
    }
  }
  catch(_e) {
    return false;
  }
}

function unregisterFromTST() {
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

async function notifyNewFeatures() {
  /*
  let featuresVersionOffset = 0;
  const browserInfo = await browser.runtime.getBrowserInfo();
  // "search" permission becomes available!
  if (parseInt(browserInfo.version.split('.')[0]) >= 63)
    featuresVersionOffset++;
  // "menus.overrideContext" permission becomes available!
  if (parseInt(browserInfo.version.split('.')[0]) >= 64)
    featuresVersionOffset++;
  */

  const featuresVersion = kFEATURES_VERSION /*+ featuresVersionOffset*/;

  if (configs.notifiedFeaturesVersion >= featuresVersion)
    return false;
  configs.notifiedFeaturesVersion = featuresVersion;

  const tab = await browser.tabs.create({
    url:    browser.extension.getURL('resources/notify-features.html'),
    active: true
  });
  const title       = `${browser.i18n.getMessage('extensionName')} ${browser.runtime.getManifest().version}`
  const description = browser.i18n.getMessage('message_newFeatures_description');
  browser.tabs.executeScript(tab.id, {
    code: `
      document.querySelector('#title').textContent = document.title = ${JSON.stringify(title)};
      document.querySelector('#description').innerHTML = ${JSON.stringify(description)};
      location.replace('data:text/html,' + encodeURIComponent(document.documentElement.innerHTML));
    `
  });
  return true;
}

async function notifyUpdatedFromLegacy() {
  if (!configs.shouldNotifyUpdatedFromLegacyVersion)
    return false;
  configs.shouldNotifyUpdatedFromLegacyVersion = false;

  const tab = await browser.tabs.create({
    url:    browser.extension.getURL('resources/notify-features.html'),
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
