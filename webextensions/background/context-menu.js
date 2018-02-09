/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var gContextMenuItems = `
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
`.trim().split(/\s+/).map(aId => `selection/${aId}`);
gContextMenuItems.unshift('selection');

var gActiveContextMenuItems = [];
var gExtraContextMenuItems  = {};

var gLastSelectedTabs = '';

var gLastRefreshStart = Date.now();
async function refreshContextMenuItems(aContextTab, aForce) {
  log('refreshContextMenuItems');
  var currentRefreshStart = gLastRefreshStart = Date.now();
  var promisedMenuUpdated = [];

  if (reserveRefreshContextMenuItems.timeout)
    clearTimeout(reserveRefreshContextMenuItems.timeout);
  delete reserveRefreshContextMenuItems.timeout;

  var serialized = JSON.stringify(gSelection.tabs);
  if (!aForce &&
      serialized == gLastSelectedTabs) {
    log(' => no change, skip');
    return;
  }

  promisedMenuUpdated.push(browser.contextMenus.removeAll());
  try {
    promisedMenuUpdated.push(browser.runtime.sendMessage(kTST_ID, {
      type: kTSTAPI_CONTEXT_MENU_REMOVE_ALL
    }));
  }
  catch(e) {
  }
  if (currentRefreshStart != gLastRefreshStart)
    return;
  gActiveContextMenuItems = [];
  gLastSelectedTabs       = serialized;
  var currentWindowId = aContextTab ? aContextTab.windowId : (await browser.windows.getLastFocused()).id;
  var otherWindows = (await browser.windows.getAll()).filter(aWindow => aWindow.id != currentWindowId);
  var visibilities = await getContextMenuItemVisibilities({
    tab:          aContextTab,
    otherWindows: otherWindows
  });
  if (currentRefreshStart != gLastRefreshStart)
    return;
  log('visibilities: ', visibilities);

  let hasSelection         = getSelectedTabIds().length > 0;
  let separatorsCount      = 0;
  let normalItemAppearedIn = {};
  let createdItems         = {};
  let nextSeparatorIn      = {};
  let registerItem = async (id, aOptions = {}) => {
    let parts = id.split('/');
    id = parts.pop();

    let parentId = parts.pop() || '';
    if (parentId && !(parentId in createdItems))
      return;

    let isSeparator = id.charAt(0) == '-';
    if (isSeparator) {
      if (!normalItemAppearedIn[parentId])
        return;
      normalItemAppearedIn[parentId] = false;
      id = `separator${separatorsCount++}`;
    }
    else {
      if (id in visibilities && !visibilities[id])
        return;
      if (!aOptions.always && !hasSelection)
        return;
      let key = `context_${id}`;
      if (configs[key] === false)
        return;
      normalItemAppearedIn[parentId] = true;
      if (nextSeparatorIn[parentId]) {
        gActiveContextMenuItems.push(nextSeparatorIn[parentId]);
        promisedMenuUpdated.push(browser.contextMenus.create(nextSeparatorIn[parentId]));
        try {
          promisedMenuUpdated.push(browser.runtime.sendMessage(kTST_ID, {
            type: kTSTAPI_CONTEXT_MENU_CREATE,
            params: nextSeparatorIn[parentId]
          }));
        }
        catch(e) {
        }
      }
      delete nextSeparatorIn[parentId];
    }
    log('build ', id, parentId);
    createdItems[id] = true;
    let type = isSeparator ? 'separator' : 'normal';
    let title = null;
    if (!isSeparator) {
      if (aOptions.title)
        title = aOptions.title;
      else
        title = browser.i18n.getMessage(`context_${id}_label`);
    }
    let params = {
      id, type, title,
      contexts: ['page', 'tab']
    };
    if (parentId)
      params.parentId = parentId;
    if (isSeparator) {
      nextSeparatorIn[parentId] = params;
      return;
    }
    gActiveContextMenuItems.push(params);
    promisedMenuUpdated.push(browser.contextMenus.create(Object.assign({}, params, {
      // Access key is not supported by WE API.
      // See also: https://bugzilla.mozilla.org/show_bug.cgi?id=1320462
      title: params.title && params.title.replace(/\(&[a-z]\)|&([a-z])/i, '$1')
    })));
    try {
      promisedMenuUpdated.push(browser.runtime.sendMessage(kTST_ID, {
        type: kTSTAPI_CONTEXT_MENU_CREATE,
        params
      }));
    }
    catch(e) {
    }
  }

  for (let id of gContextMenuItems) {
    await registerItem(id);
    if (currentRefreshStart != gLastRefreshStart)
      return;
  }

  // create submenu items for "copy to clipboard"
  var formatIds;
  var formats = configs.copyToClipboardFormats;
  if (Array.isArray(formats)) {
    formatIds = formats
      .map((aItem, aIndex) => `clipboard/clipboard:${aIndex}:${aItem.label}`)
      .filter((aItem, aIndex) => formats[aIndex].label);
  }
  else {
    let labels = Object.keys(formats);
    formatIds = labels
      .map((aLabel, aIndex) => `clipboard/clipboard:${aIndex}:${aLabel}`)
      .filter((aItem, aIndex) => labels[aIndex]);
  }
  for (let id of formatIds) {
    await registerItem(id, {
      title: id.replace(/^clipboard\/clipboard:[0-9]+:/, '')
    });
    if (currentRefreshStart != gLastRefreshStart)
      return;
  }

  // create submenu items for "move to other window"
  for (let window of otherWindows) {
    await registerItem(`moveToOtherWindow/moveToOtherWindow:${window.id}`, {
      title: window.title
    });
    if (currentRefreshStart != gLastRefreshStart)
      return;
  }

  // create additional items registered by other addons
  for (let id of Object.keys(gExtraContextMenuItems)) {
    await registerItem(`selection/extra:${id}`, gExtraContextMenuItems[id]);
    if (currentRefreshStart != gLastRefreshStart)
      return;
  }

  return Promise.all(promisedMenuUpdated);
}

function reserveRefreshContextMenuItems() {
  if (reserveRefreshContextMenuItems.timeout)
    clearTimeout(reserveRefreshContextMenuItems.timeout);
  reserveRefreshContextMenuItems.timeout = setTimeout(() => {
    refreshContextMenuItems();
  }, 150);
}

async function getContextMenuItemVisibilities(aParams) {
  var tab = aParams.tab;
  var allTabs = await getAllTabs();
  var pinnedCount = 0;
  var mutedCount = 0;
  var suspendedCount = 0;
  var lockedCount = 0;
  var protectedCount = 0;
  var frozenCount = 0;
  var tabIds = getSelectedTabIds();
  for (let id of tabIds) {
    let tab = gSelection.tabs[id];
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
    reloadTabs:    tabIds.length > 0,
    bookmarkTabs:  tabIds.length > 0,
    removeBookmarkFromTabs: tabIds.length > 0,
    duplicateTabs: tabIds.length > 0,
    pinTabs:       tabIds.length > 0 && pinnedCount < tabIds.length,
    unpinTabs:     tabIds.length > 0 && pinnedCount > 0,
    muteTabs:      tabIds.length > 0 && mutedCount < tabIds.length,
    unmuteTabs:    tabIds.length > 0 && mutedCount > 0,
    moveToNewWindow: tabIds.length > 0,
    moveToOtherWindow: tabIds.length > 0 && aParams.otherWindows.length > 0,
    removeTabs:    tabIds.length > 0,
    removeOther:   tabIds.length > 0 && tabIds.length < allTabs.length,
    clipboard:     tabIds.length > 0,
    saveTabs:      tabIds.length > 0,
    printTabs:     tabIds.length > 0,
    freezeTabs:    tabIds.length > 0 && frozenCount < tabIds.length,
    unfreezeTabs:  tabIds.length > 0 && frozenCount > 0,
    protectTabs:   tabIds.length > 0 && protectedCount < tabIds.length,
    unprotectTabs: tabIds.length > 0 && protectedCount > 0,
    lockTabs:      tabIds.length > 0 && lockedCount < tabIds.length,
    unlockTabs:    tabIds.length > 0 && lockedCount > 0,
    groupTabs:     tabIds.length > 1,
    suspendTabs:   tabIds.length > 0 && suspendedCount < tabIds.length,
    resumeTabs:    tabIds.length > 0 && suspendedCount > 0,
    selectAll:     tabIds.length < allTabs.length,
    select:        !tab || tabIds.indexOf(tab.id) < 0,
    unselect:      !tab || tabIds.indexOf(tab.id) > -1,
    invertSelection: tabIds.length > 0
  };
}

/*
configs.$load().then(() => {
  refreshContextMenuItems();
});

configs.$addObserver(aKey => {
  if (aKey.indexOf('context_') == 0)
    refreshContextMenuItems();
});
*/

var contextMenuClickListener = async (aInfo, aTab) => {
  //log('context menu item clicked: ', aInfo, aTab);
  var selectedTabIds = getSelectedTabIds();
  console.log('aInfo.menuItemId, selectedTabIds ', aInfo.menuItemId, selectedTabIds);
  switch (aInfo.menuItemId) {
    case 'reloadTabs':
      await reloadTabs(selectedTabIds);
      clearSelection();
      break;
    case 'bookmarkTabs':
      await bookmarkTabs(selectedTabIds);
      break;
    case 'removeBookmarkFromTabs':
      // not implemented
      break;

    case 'duplicateTabs':
      await duplicateTabs(selectedTabIds);
      clearSelection();
      break;

    case 'pinTabs':
      await pinTabs(selectedTabIds);
      clearSelection();
      break;
    case 'unpinTabs':
      await unpinTabs(selectedTabIds);
      clearSelection();
      break;
    case 'muteTabs':
      await muteTabs(selectedTabIds);
      clearSelection();
      break;
    case 'unmuteTabs':
      await unmuteTabs(selectedTabIds);
      clearSelection();
      break;

    case 'moveToNewWindow':
      await moveToWindow(selectedTabIds);
      break;

    case 'removeTabs':
      await removeTabs(selectedTabIds);
      clearSelection();
      break;
    case 'removeOther':
      await removeOtherTabs(selectedTabIds);
      clearSelection();
      break;

    case 'clipboard':
      clearSelection();
      break;
    case 'saveTabs':
      await clearSelection();
      await wait(100); // to wait tab titles are updated
      await saveTabs(selectedTabIds);
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
      browser.runtime.sendMessage(kTST_ID, {
        type: kTSTAPI_GROUP_TABS,
        tabs: selectedTabIds
      }).catch(e => {});
      break;

    case 'suspendTabs':
    case 'resumeTabs':
      break;

    case 'selectAll':
      selectAllTabs();
      break;
    case 'select':
      setSelection(aTab, true);
      break;
    case 'unselect':
      setSelection(aTab, false);
      break;
    case 'invertSelection':
      invertSelection();
      break;

    default:
      if (aInfo.menuItemId.indexOf('clipboard:') == 0) {
        let id = aInfo.menuItemId.replace(/^clipboard:/, '');
        let format;
        if (Array.isArray(configs.copyToClipboardFormats)) {
          let index = id.match(/^([0-9]+):/);
          index = parseInt(index[1]);
          let item = configs.copyToClipboardFormats[index];
          format = item.format;
        }
        else {
          format = configs.copyToClipboardFormats[id.replace(/^[0-9]+:/, '')];
        }
        await clearSelection();
        await wait(100); // to wait tab titles are updated
        await copyToClipboard(selectedTabIds, format);
      }
      else if (aInfo.menuItemId.indexOf('moveToOtherWindow:') == 0) {
        let id = parseInt(aInfo.menuItemId.replace(/^moveToOtherWindow:/, ''));
        await moveToWindow(selectedTabIds, id);
        await clearSelection();
      }
      else if (aInfo.menuItemId.indexOf('extra:') == 0) {
        let idMatch   = aInfo.menuItemId.match(/^extra:([^:]+):(.+)$/);
        let owner     = idMatch[1];
        let id        = idMatch[2];
        let selection = await getAPITabSelection({
          selectedIds: selectedTabIds
        });
        browser.runtime.sendMessage(owner, {
          type: kMTHAPI_INVOKE_SELECTED_TAB_COMMAND,
          id, selection
        }).catch(e => {});
      }
      break;
  }
};
browser.contextMenus.onClicked.addListener(contextMenuClickListener);
