/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'BG';

window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;

  browser.tabs.onActivated.addListener((aActiveInfo) => {
    if (!gSelection.tabs[TabIdFixer.fixTabId(aActiveInfo.tabId)])
      clearSelection();
  });
  browser.tabs.onCreated.addListener(() => clearSelection());
  browser.tabs.onRemoved.addListener(() => clearSelection());

  reserveRefreshContextMenuItems();
  configs.$addObserver(onConfigChanged);

  browser.browserAction.onClicked.addListener(onToolbarButtonClick);
  browser.browserAction.setPopup({ popup: kPOPUP_URL });
  Permissions.clearRequest();

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
    browser.browserAction.setPopup({ popup: kPOPUP_URL });
  }, 0);
}

async function onDragSelectionEnd(aMessage) {
  let tabId = gDragSelection.dragStartTarget.id;
  await refreshContextMenuItems(tabId, true);
  try {
    await browser.runtime.sendMessage(kTST_ID, {
      type: kTSTAPI_CONTEXT_MENU_OPEN,
      window: gSelection.targetWindow,
      tab:  tabId,
      left: aMessage.clientX,
      top:  aMessage.clientY
    });
  }
  catch(e) {
    log('failed to open context menu: ', e);
  }
}

function onTSTAPIMessage(aMessage) {
  switch (aMessage.type) {
    case kTSTAPI_NOTIFY_READY:
      registerToTST();
      return Promise.resolve(true);

    case kTSTAPI_NOTIFY_TAB_MOUSEDOWN:
      return onTabItemClick(aMessage);

    case kTSTAPI_NOTIFY_TAB_MOUSEUP:
      return onTabItemMouseUp(aMessage);

    case kTSTAPI_NOTIFY_TABBAR_CLICKED:
      return onNonTabAreaClick(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGREADY:
      return onTabItemDragReady(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGCANCEL:
      return onTabItemDragCancel(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGSTART:
      return onTabItemDragStart(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGENTER:
      return onTabItemDragEnter(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGEXIT:
      return onTabItemDragExit(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGEND:
      return onTabItemDragEnd(aMessage);

    case kTSTAPI_CONTEXT_MENU_CLICK:
      return contextMenuClickListener(aMessage.info, aMessage.tab);
  }
}

function onMessageExternal(aMessage, aSender) {
  if (configs.debug)
    console.log('onMessageExternal: ', aMessage, aSender);

  switch (aSender.id) {
    case kTST_ID: { // Tree Style Tab API
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
    case kMTHAPI_GET_TAB_SELECTION:
      return getAPITabSelection();

    case kMTHAPI_SET_TAB_SELECTION:
      return (async () => {
        var allTabs = await getAllTabs(aMessage.window || aMessage.windowId);

        var unselectTabs = aMessage.unselect;
        if (unselectTabs == '*') {
          unselectTabs = allTabs;
        }
        else {
          if (!Array.isArray(unselectTabs))
            unselectTabs = [unselectTabs];
          unselectTabs = allTabs.filter(aTab => unselectTabs.indexOf(aTab.id) > -1);
        }
        setSelection(unselectTabs, false, {
          globalHighlight: !gDragSelection.activatedInVerticalTabbarOfTST
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
        setSelection(selectTabs, true, {
          globalHighlight: !gDragSelection.activatedInVerticalTabbarOfTST
        });

        return true;
      })();

    case kMTHAPI_CLEAR_TAB_SELECTION:
      clearSelection();
      return Promise.resolve(true);

    case kMTHAPI_ADD_SELECTED_TAB_COMMAND: {
      let addons = configs.cachedExternalAddons;
      addons[aSender.id] = true;
      configs.cachedExternalAddons = addons;
      gExtraContextMenuItems[`${aSender.id}:${aMessage.id}`] = aMessage;
      return reserveRefreshContextMenuItems(null, true).then(() => true);
    };

    case kMTHAPI_REMOVE_SELECTED_TAB_COMMAND:
      delete gExtraContextMenuItems[`${aSender.id}:${aMessage.id}`];
      return reserveRefreshContextMenuItems(null, true).then(() => true);
  }
}

function onMessage(aMessage) {
  if (!aMessage || !aMessage.type)
    return;

  switch (aMessage.type) {
    case kCOMMAND_PULL_SELECTION_INFO:
      return Promise.resolve({
        selection:     gSelection,
        dragSelection: gDragSelection
      });

    case kCOMMAND_PUSH_SELECTION_INFO:
      gSelection = aMessage.selection;
      gDragSelection = aMessage.dragSelection;
      if (aMessage.updateMenu) {
        let tab = aMessage.contextTab ? { id: aMessage.contextTab } : null ;
        return refreshContextMenuItems(tab, true);
      }
      else {
        reserveRefreshContextMenuItems();
      }
      break;

    case kCOMMAND_PULL_ACTIVE_CONTEXT_MENU_INFO:
      return Promise.resolve(gActiveContextMenuItems);

    case kCOMMAND_SELECTION_MENU_ITEM_CLICK:
      return contextMenuClickListener({ menuItemId: aMessage.id });

    case kCOMMAND_UNREGISTER_FROM_TST:
      unregisterFromTST();
      break;
  }
}

function onSelectionChange(aTabs, aSelected, aOptions = {}) {
  reservePushSelectionState();
  if (!aOptions.dontUpdateMenu)
    reserveRefreshContextMenuItems();
}


async function registerToTST() {
  try {
    await browser.runtime.sendMessage(kTST_ID, {
      type:  kTSTAPI_REGISTER_SELF,
      name:  browser.i18n.getMessage('extensionName'),
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
    gDragSelection.activatedInVerticalTabbarOfTST = true;
    // force rebuild menu
    return reserveRefreshContextMenuItems(null, true).then(() => true);
  }
  catch(e) {
    return false;
  }
}

function unregisterFromTST() {
  gDragSelection.activatedInVerticalTabbarOfTST = false;
  try {
    browser.runtime.sendMessage(kTST_ID, {
      type: kTSTAPI_CONTEXT_MENU_REMOVE_ALL
    });
    browser.runtime.sendMessage(kTST_ID, {
      type: kTSTAPI_UNREGISTER_SELF
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
      browser.runtime.sendMessage(id, { type: kMTHAPI_READY });
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
  var description = browser.i18n.getMessage('message.updatedFromLegacy.description');
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
        aMessage.type == kCOMMAND_NOTIFY_PANEL_SHOWN) {
      browser.runtime.onMessage.removeListener(onMessage);
      browser.tabs.remove(tab.id)
        .catch(handleMissingTabError);
    }
  });
}
