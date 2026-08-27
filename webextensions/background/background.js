/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  configs,
  notify,
  handleMissingReceiverError,
  TST_ID,
  WS_ID,
  callTSTAPI,
  getTSTVersion,
  fixupTSTTreeItemKeys,
  getCurrentIconTheme,
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
  const selectedTabs = await browser.tabs.query({
    windowId:    tab.windowId,
    highlighted: true
  });
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
let shoudHandleTSTLongPress = false;
let mousedownHandled = false;

function onTSTAPIMessage(message) {
  if (message && message.messages) {
    for (const oneMessage of message.messages) {
      onTSTAPIMessage(oneMessage);
    }
    return;
  }
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
      shoudHandleTSTLongPress = true;
      return fixupTSTTreeItemKeys(message, 'tab').then(async message => {
        const action = await DragSelectionManager.onMouseDown(message, { includeHidden: false });
        if (action & Constants.kCLICK_ACTION_REGULAR_CLICK &&
            configs.enableDragSelectionByLongPress &&
            shoudHandleTSTLongPress) {
          TSTLongPressTimer = setTimeout(async () => {
            TSTLongPressTimer = undefined;
            const window = await browser.windows.get(message.window, { populate: true });
            if (window.tabs.filter(tab => tab.highlighted).length > 1)
              return; // don't clear existing multiselection
            callTSTAPI({
              type:     Constants.kTSTAPI_START_CUSTOM_DRAG,
              windowId: message.windowId
            }).catch(handleMissingReceiverError);
            DragSelectionManager.onDragReady({
              tab:             message.tab,
              window:          message.windowId,
              windowId:        message.windowId,
              startOnClosebox: message.closebox,
              includeHidden:   false
            });
          }, configs.longPressDuration);
        }

        return action & Constants.kCLICK_ACTION_MULTISELECTION ? true : false;
      });

    case Constants.kTSTAPI_NOTIFY_TAB_MOUSEUP:
      shoudHandleTSTLongPress = false;
      if (!mousedownHandled)
        return;
      if (TSTLongPressTimer) {
        clearTimeout(TSTLongPressTimer);
        TSTLongPressTimer = undefined;
      }
      return fixupTSTTreeItemKeys(message, 'tab').then(message =>
        DragSelectionManager.onMouseUp(message, { includeHidden: false })
      );

    case Constants.kTSTAPI_NOTIFY_TABBAR_CLICKED:
      return DragSelectionManager.onNonTabAreaClick(message, { includeHidden: false });

      /*
    case Constants.kTSTAPI_NOTIFY_TAB_DRAGREADY:
      if (!configs.enableDragSelectionByLongPress)
        return;
      return DragSelectionManager.onDragReady(message, { includeHidden: false });
      */

    case Constants.kTSTAPI_NOTIFY_NATIVE_TAB_DRAGSTART:
      if (TSTLongPressTimer) {
        clearTimeout(TSTLongPressTimer);
        TSTLongPressTimer = undefined;
      }
      return;

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGCANCEL:
      if (!configs.enableDragSelectionByLongPress)
        return;
      return fixupTSTTreeItemKeys(message, 'tab').then(message =>
        DragSelectionManager.onDragCancel(message, { includeHidden: false })
      );

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGSTART:
      if (!configs.enableDragSelectionByLongPress)
        return;
      return fixupTSTTreeItemKeys(message, 'tab').then(message =>
        DragSelectionManager.onDragStart(message, { includeHidden: false })
      );

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGENTER:
      if (!configs.enableDragSelectionByLongPress)
        return;
      return fixupTSTTreeItemKeys(message, 'tab').then(message =>
        DragSelectionManager.onDragEnter(message, { includeHidden: false })
      );

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGEXIT:
      if (!configs.enableDragSelectionByLongPress)
        return;
      return fixupTSTTreeItemKeys(message, 'tab').then(message =>
        DragSelectionManager.onDragExit(message, { includeHidden: false })
      );

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGEND:
      if (!configs.enableDragSelectionByLongPress)
        return;
      return fixupTSTTreeItemKeys(message, 'tab').then(message =>
        DragSelectionManager.onDragEnd(message, { includeHidden: false })
      );

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
    // Tree Style Tab API
    case TST_ID:
    case WS_ID: {
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
    const [TSTVersion] = await Promise.all([
      getTSTVersion().catch(handleMissingReceiverError),
      callTSTAPI({
        type:               Constants.kTSTAPI_REGISTER_SELF,
        name:               browser.i18n.getMessage('extensionName'),
        icons:              browser.runtime.getManifest().icons,
        listeningTypes,
        allowBulkMessaging: true,
        lightTree:          false, // We need to use "index". We can listen full tree item because lisning events are limited.
        style:              `
          :root:is(.left, .right) {
            tab-item:is(.${Constants.kSELECTED}, .${Constants.kREADY_TO_SELECT})
              :is(:not(.highlighted), .active)
              tab-item-substance {
              outline: thin solid Highlight;
              outline-radius: 0.2em;
            }

            tab-item.${Constants.kREADY_TO_CLOSE} {
              /* ::after pseudo element prevents firing of dragstart event */
              tab-closebox {
                background: Highlight;
              }

              /* show closebox on non-active tabs while dragging */
              &:not(.active):not(#dummy-tab) tab-item-substance:not(:hover) tab-closebox {
                display: block;
              }
            }

            &[data-style="nova"]
              tab-item.${Constants.kREADY_TO_CLOSE}
              tab-closebox {
              border-radius: 100%;
            }
          }
        `
      }).catch(handleMissingReceiverError),
    ]);
    if (TSTVersion && parseInt(TSTVersion.split('.')[0]) >= 4) {
      configs.getTreeType = Constants.kTSTAPI_GET_LIGHT_TREE;
    }
    else {
      configs.getTreeType = Constants.kTSTAPI_GET_TREE;
    }

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
    callTSTAPI({
      type: Constants.kTSTAPI_CONTEXT_MENU_REMOVE_ALL
    }).catch(handleMissingReceiverError);
    callTSTAPI({
      type: Constants.kTSTAPI_UNREGISTER_SELF
    }).catch(handleMissingReceiverError);
  }
  catch(_e) {
  }
}


async function notifyReady() {
  const addons = configs.cachedExternalAddons;
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
  const isInitialInstall = configs.notifiedFeaturesVersion == 0;

  if (configs.notifiedFeaturesVersion >= featuresVersion)
    return false;
  configs.notifiedFeaturesVersion = featuresVersion;

  const suffix = isInitialInstall ? 'installed' : 'updated';
  notify({
    url:     browser.extension.getURL(`resources/notify-features.html?${suffix}`),
    title:   browser.i18n.getMessage(`startup_notification_title_${suffix}`),
    message: browser.i18n.getMessage(`startup_notification_message_${suffix}`),
    timeout: 90 * 1000
  });

  return true;
}

async function notifyUpdatedFromLegacy() {
  if (!configs.shouldNotifyUpdatedFromLegacyVersion)
    return false;
  configs.shouldNotifyUpdatedFromLegacyVersion = false;

  notify({
    url:     browser.extension.getURL(`resources/notify-features.html?legacy`),
    title:   browser.i18n.getMessage(`startup_notification_title_legacy`),
    message: browser.i18n.getMessage(`startup_notification_message_legacy`),
    timeout: 90 * 1000
  });
}

function initNotifyFeaturesTab(tab) {
  const type = /\?(legacy|installed|updated)/i.test(tab.url) && String(RegExp.$1).toLowerCase();

  const title = `${browser.i18n.getMessage('extensionName')} ${browser.runtime.getManifest().version}`;
  const description = browser.i18n.getMessage(
    type == 'legacy' ?
      'message_updatedFromLegacy_description' :
      'message_newFeatures_description'
  );

  browser.tabs.executeScript(tab.id, {
    code: `
      document.querySelector('#title').textContent = document.title = ${JSON.stringify(title)};
      document.querySelector('#description').innerHTML = ${JSON.stringify(description)};
    `
  });
}

browser.tabs.onUpdated.addListener(
  (_tabId, updateInfo, tab) => {
    if (updateInfo.status != 'complete')
      return;
    initNotifyFeaturesTab(tab);
  },
  { properties: ['status'],
    urls:       [browser.extension.getURL(`resources/notify-features.html*`)] }
);
browser.tabs.query({ url: browser.extension.getURL(`resources/notify-features.html*`) })
  .then(tabs => tabs.forEach(initNotifyFeaturesTab));


const BASE_ICONS = {
  '16': '/resources/16x16.svg',
  '20': '/resources/20x20.svg',
  '24': '/resources/24x24.svg',
  '64': '/resources/64x64.svg',
};
async function updateIconForBrowserTheme(theme) {
  // generate icons with theme specific color
  const toolbarIcons = {};

  if (!theme) {
    const win = await browser.windows.getLastFocused();
    theme = await browser.theme.getCurrent(win.id);
  }

  log('updateIconForBrowserTheme: ', theme);
  if (theme.colors) {
    const isNativeVerticalTabs = browser.browserSettings && 'verticalTabs' in browser.browserSettings ? (await browser.browserSettings.verticalTabs.get({})).value : false;
    const toolbarIconColor = theme.colors.icons || (
      isNativeVerticalTabs ?
        'CanvasText' : // --toolbarbutton-icon-fill in https://searchfox.org/firefox-main/rev/91c8ca3faa6ccbb72d65d89401fd31fd3313afc4/toolkit/themes/shared/design-system/dist/tokens-platform.css#225
        theme.colors.toolbar_text || theme.colors.tab_text || theme.colors.tab_background_text || theme.colors.bookmark_text || theme.colors.textcolor
    );
    log(' => ', { toolbarIconColor }, theme.colors);
    await Promise.all(Array.from(Object.entries(BASE_ICONS), async ([size, url]) => {
      const response = await fetch(url);
      const body = await response.text();
      const toolbarIconSource = body.replace(/transparent\s*\/\*\s*TO BE REPLACED WITH THEME COLOR\s*\*\//g, toolbarIconColor);
      toolbarIcons[size] = `data:image/svg+xml,${escape(toolbarIconSource)}#toolbar-theme`;
    }));
  }
  else {
    const themeSuffix = getCurrentIconTheme();
    for (const [size, url] of Object.entries(BASE_ICONS)) {
      toolbarIcons[size] = `${url}#toolbar-${themeSuffix}`;
    }
  }

  log('updateIconForBrowserTheme: applying icons: ', {
    toolbarIcons,
  });

  await Promise.all([
    browser.action?.setIcon({ path: toolbarIcons }), // Manifest v3
    browser.browserAction?.setIcon({ path: toolbarIcons }), // Manifest v2
  ]);
}

browser.theme.onUpdated.addListener(updateInfo => {
  updateIconForBrowserTheme(updateInfo.theme);
});

const mDarkModeMatchMedia = window.matchMedia('(prefers-color-scheme: dark)');
mDarkModeMatchMedia.addListener(async _event => {
  updateIconForBrowserTheme();
});

browser.permissions.onAdded?.addListener(addedPermissions => {
  if (new Set([...addedPermissions.permissions, ...Permissions.BROWSER_SETTINGS.permissions]).size < addedPermissions.permissions.length)
    return;

  updateIconForBrowserTheme();

  if ('verticalTabs' in browser.browserSettings &&
      !updateIconForBrowserTheme.$listeningBrowserSettings) {
    updateIconForBrowserTheme.$listeningBrowserSettings = true;
    browser.browserSettings.verticalTabs.onChange.addListener(_details => updateIconForBrowserTheme());
  }
});

if (browser.browserSettings &&
    'verticalTabs' in browser.browserSettings) {
  updateIconForBrowserTheme.$listeningBrowserSettings = true;
  browser.browserSettings.verticalTabs.onChange.addListener(_details => updateIconForBrowserTheme());
}

configs.$loaded.then(() => {
  updateIconForBrowserTheme();
});
