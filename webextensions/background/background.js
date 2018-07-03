/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

log.context = 'BG';

window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;

  browser.tabs.onActivated.addListener((aActiveInfo) => {
    if (!Commands.gSelection.tabs[TabIdFixer.fixTabId(aActiveInfo.tabId)])
      Commands.clearSelection();
  });
  browser.tabs.onCreated.addListener(() => Commands.clearSelection());
  browser.tabs.onRemoved.addListener(() => Commands.clearSelection());

  reserveRefreshContextMenuItems();
  configs.$addObserver(onConfigChanged);

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

function onToolbarButtonClick(aTab) {
  Permissions.requestPostProcess();
  setTimeout(() => {
    browser.browserAction.setPopup({ popup: Constants.kPOPUP_URL });
  }, 0);
}

async function onDragSelectionEnd(aMessage) {
  let tabId = Commands.gDragSelection.dragStartTarget.id;
  await refreshContextMenuItems(tabId, true);
  try {
    await browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_CONTEXT_MENU_OPEN,
      window: Commands.gSelection.targetWindow,
      tab:  tabId,
      left: aMessage.clientX,
      top:  aMessage.clientY
    });
  }
  catch(e) {
    log('failed to open context menu: ', e);
  }
}

async function onShortcutCommand(aCommand) {
  const activeTab = (await browser.tabs.query({
    active:        true,
    currentWindow: true
  }))[0];
  const selectedTabIds = Commands.getSelectedTabIds();

  if (selectedTabIds.length <= 0)
    return;

  switch (aCommand) {
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
      const otherWindows = (await browser.windows.getAll()).filter(aWindow => aWindow.id != activeTab.windowId);
      if (otherWindows.length <= 0)
        return Commands.moveToWindow(selectedTabIds);
      const result = await RichConfirm.showInTab(activeTab.id, {
        message: browser.i18n.getMessage('command_moveSelectedTabsToOtherWindow_message'),
        buttons: otherWindows.map(aWindow => aWindow.title)
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
        for (let label of Object.keys(configs.copyToClipboardFormats)) {
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
        buttons: formats.map(aFormat => aFormat.label)
      });
      if (result.buttonIndex > -1) {
        await Commands.clearSelection();
        await wait(100); // to wait tab titles are updated
        await Commands.copyToClipboard(selectedTabIds, formats[result.buttonIndex].format);
        const tabs = await Commands.getAllTabs(activeTab.windowId);
        tabs.filter(aTab => selectedTabIds.indexOf(aTab.id) > -1)
          .forEach(aTab => Commands.setSelection(aTab, true));
      }
    } break;

    case 'saveSelectedTabs':
      await Commands.clearSelection();
      await wait(100); // to wait tab titles are updated
      await Commands.saveTabs(selectedTabIds);
      const tabs = await Commands.getAllTabs(activeTab.windowId);
      tabs.filter(aTab => selectedTabIds.indexOf(aTab.id) > -1)
        .forEach(aTab => Commands.setSelection(aTab, true));
      break;

    case 'printSelectedTabs':
      break;

    case 'groupSelectedTabs':
      browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_GROUP_TABS,
        tabs: selectedTabIds
      }).catch(e => {});
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

function onTSTAPIMessage(aMessage) {
  switch (aMessage.type) {
    case Constants.kTSTAPI_NOTIFY_READY:
      registerToTST();
      return Promise.resolve(true);

    case Constants.kTSTAPI_NOTIFY_TAB_MOUSEDOWN:
      return onTabItemClick(aMessage);

    case Constants.kTSTAPI_NOTIFY_TAB_MOUSEUP:
      return onTabItemMouseUp(aMessage);

    case Constants.kTSTAPI_NOTIFY_TABBAR_CLICKED:
      return onNonTabAreaClick(aMessage);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGREADY:
      return onTabItemDragReady(aMessage);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGCANCEL:
      return onTabItemDragCancel(aMessage);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGSTART:
      return onTabItemDragStart(aMessage);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGENTER:
      return onTabItemDragEnter(aMessage);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGEXIT:
      return onTabItemDragExit(aMessage);

    case Constants.kTSTAPI_NOTIFY_TAB_DRAGEND:
      return onTabItemDragEnd(aMessage);

    case Constants.kTSTAPI_CONTEXT_MENU_CLICK:
      return contextMenuClickListener(aMessage.info, aMessage.tab);
  }
}

function onMessageExternal(aMessage, aSender) {
  if (configs.debug)
    console.log('onMessageExternal: ', aMessage, aSender);

  switch (aSender.id) {
    case Constants.kTST_ID: { // Tree Style Tab API
      let result = onTSTAPIMessage(aMessage);
      if (result !== undefined)
        return result;
    }; break;

    default:
      break;
  }

  if (!aMessage ||
      typeof aMessage.type != 'string')
    return;

  switch (aMessage.type) {
    case Constants.kMTHAPI_GET_TAB_SELECTION:
      return Commands.getAPITabSelection();

    case Constants.kMTHAPI_SET_TAB_SELECTION:
      return (async () => {
        var allTabs = await Commands.getAllTabs(aMessage.window || aMessage.windowId);

        var unselectTabs = aMessage.unselect;
        if (unselectTabs == '*') {
          unselectTabs = allTabs;
        }
        else {
          if (!Array.isArray(unselectTabs))
            unselectTabs = [unselectTabs];
          unselectTabs = allTabs.filter(aTab => unselectTabs.indexOf(aTab.id) > -1);
        }
        Commands.setSelection(unselectTabs, false, {
          globalHighlight: !Commands.gDragSelection.activatedInVerticalTabbarOfTST
        });

        var selectTabs = aMessage.select;
        if (selectTabs == '*') {
          selectTabs = allTabs;
        }
        else {
          if (!Array.isArray(selectTabs))
            selectTabs = [selectTabs];
          selectTabs = allTabs.filter(aTab => selectTabs.indexOf(aTab.id) > -1);
        }
        Commands.setSelection(selectTabs, true, {
          globalHighlight: !Commands.gDragSelection.activatedInVerticalTabbarOfTST
        });

        return true;
      })();

    case Constants.kMTHAPI_CLEAR_TAB_SELECTION:
      Commands.clearSelection();
      return Promise.resolve(true);

    case Constants.kMTHAPI_ADD_SELECTED_TAB_COMMAND: {
      let addons = Object.assign({}, configs.cachedExternalAddons);
      addons[aSender.id] = true;
      configs.cachedExternalAddons = addons;
      gExtraContextMenuItems[`${aSender.id}:${aMessage.id}`] = aMessage;
      return reserveRefreshContextMenuItems(null, true).then(() => true);
    };

    case Constants.kMTHAPI_REMOVE_SELECTED_TAB_COMMAND:
      delete gExtraContextMenuItems[`${aSender.id}:${aMessage.id}`];
      return reserveRefreshContextMenuItems(null, true).then(() => true);
  }
}

function onMessage(aMessage) {
  if (!aMessage || !aMessage.type)
    return;

  switch (aMessage.type) {
    case Constants.kCOMMAND_PULL_SELECTION_INFO:
      return Promise.resolve({
        selection:     Commands.gSelection,
        dragSelection: Commands.gDragSelection.export()
      });

    case Constants.kCOMMAND_PUSH_SELECTION_INFO:
      Commands.gSelection = aMessage.selection;
      Commands.gDragSelection.apply(aMessage.dragSelection);
      if (aMessage.updateMenu) {
        let tab = aMessage.contextTab ? { id: aMessage.contextTab } : null ;
        return refreshContextMenuItems(tab, true);
      }
      else {
        reserveRefreshContextMenuItems();
      }
      break;

    case Constants.kCOMMAND_PULL_ACTIVE_CONTEXT_MENU_INFO:
      return Promise.resolve(gActiveContextMenuItems);

    case Constants.kCOMMAND_SELECTION_MENU_ITEM_CLICK:
      return contextMenuClickListener({ menuItemId: aMessage.id });

    case Constants.kCOMMAND_UNREGISTER_FROM_TST:
      unregisterFromTST();
      break;
  }
}

Commands.onSelectionChange.addListener((aTabs, aSelected, aOptions = {}) => {
  Commands.reservePushSelectionState();
  if (!aOptions.dontUpdateMenu)
    reserveRefreshContextMenuItems();
});


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
    Commands.gDragSelection.activatedInVerticalTabbarOfTST = true;
    // force rebuild menu
    return reserveRefreshContextMenuItems(null, true).then(() => true);
  }
  catch(e) {
    return false;
  }
}

function unregisterFromTST() {
  Commands.gDragSelection.activatedInVerticalTabbarOfTST = false;
  try {
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_CONTEXT_MENU_REMOVE_ALL
    });
    browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_UNREGISTER_SELF
    });
  }
  catch(e) {
  }
}

function onConfigChanged(aKey) {
  switch (aKey) {
    case 'copyToClipboardFormats':
      reserveRefreshContextMenuItems(null, true);
      break;

    default:
      if (aKey.indexOf('context_') == 0)
        reserveRefreshContextMenuItems(null, true);
      break;
  }
}


async function notifyReady() {
  var addons   = configs.cachedExternalAddons;
  var modified = false;
  for (let id of Object.keys(addons)) {
    try {
      browser.runtime.sendMessage(id, { type: Constants.kMTHAPI_READY });
    }
    catch(e) {
      delete addons[id];
      modified = true;
    }
  }
  if (modified)
    configs.cachedExternalAddons = addons;
}

// migration

browser.runtime.onInstalled.addListener(aDetails => {
  /* When MTH 2 (or later) is newly installed, this listener is invoked.
     We should not notify "updated from legacy" for this case.
     On the other hand, when MTH is updated from legacy to 2 (or later),
     this listener is not invoked with the reason "install" and
     invoked with the reason "updated" after Firefox is restarted. */
  if (aDetails.reason == 'install')
    configs.shouldNotifyUpdatedFromLegacyVersion = false;
});

async function notifyUpdatedFromLegacy() {
  if (!configs.shouldNotifyUpdatedFromLegacyVersion)
    return;
  configs.shouldNotifyUpdatedFromLegacyVersion = false;

  var tab = await browser.tabs.create({
    url:    browser.extension.getURL('resources/updated-from-legacy.html'),
    active: true
  });
  var title       = `${browser.i18n.getMessage('extensionName')} ${browser.runtime.getManifest().version}`
  var description = browser.i18n.getMessage('message_updatedFromLegacy_description');
  browser.tabs.executeScript(tab.id, {
    code: `
      document.querySelector('#title').textContent = document.title = ${JSON.stringify(title)};
      document.querySelector('#description').innerHTML = ${JSON.stringify(description)};
      location.replace('data:text/html,' + encodeURIComponent(document.documentElement.innerHTML));
    `
  });

  browser.runtime.onMessage.addListener(function onMessage(aMessage, aSender) {
    if (aMessage &&
        typeof aMessage.type == 'string' &&
        aMessage.type == Constants.kCOMMAND_NOTIFY_PANEL_SHOWN) {
      browser.runtime.onMessage.removeListener(onMessage);
      browser.tabs.remove(tab.id)
        .catch(handleMissingTabError);
    }
  });
}
