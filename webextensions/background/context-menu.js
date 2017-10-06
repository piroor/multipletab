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
  tearOffTabs
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
  suspendTabs
  resumeTabs
  -----------------
  selectAll
  select
  unselect
  invertSelection
`.trim().split(/\s+/).map(aId => `selection/${aId}`);
gContextMenuItems.unshift('selection');

var gActiveContextMenuItems = [];

var gLastSelectedTabs = '';

var gLastRefreshStart = Date.now();
async function refreshContextMenuItems(aContextTab, aForce) {
  log('refreshContextMenuItems');
  var currentRefreshStart = gLastRefreshStart = Date.now();

  if (reserveRefreshContextMenuItems.timeout)
    clearTimeout(reserveRefreshContextMenuItems.timeout);
  delete reserveRefreshContextMenuItems.timeout;

  var serialized = JSON.stringify(gSelection.tabs);
  if (!aForce &&
      serialized == gLastSelectedTabs) {
    log(' => no change, skip');
    return;
  }

  await browser.contextMenus.removeAll();
  try {
    await browser.runtime.sendMessage(kTST_ID, {
      type: kTSTAPI_CONTEXT_MENU_REMOVE_ALL
    });
  }
  catch(e) {
  }
  if (currentRefreshStart != gLastRefreshStart)
    return;
  gActiveContextMenuItems = [];
  gLastSelectedTabs = serialized;
  var visibilities = await getContextMenuItemVisibilities(aContextTab);
  if (currentRefreshStart != gLastRefreshStart)
    return;
  log('visibilities: ', visibilities);

  let separatorsCount = 0;
  let normalItemAppearedIn = {};
  let createdItems = {};
  let registerItem = async (id) => {
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
      let key = `context_${id}`;
      if (key in configs && !configs[key])
        return;
      normalItemAppearedIn[parentId] = true;
    }
    log('build ', id, parentId);
    createdItems[id] = true;
    let type = isSeparator ? 'separator' : 'normal';
    let title = isSeparator ?
                  null :
                id.indexOf('clipboard:') == 0 ?
                  id.replace(/^clipboard:[0-9]+:/, '') :
                  browser.i18n.getMessage(`context.${id}.label`);
    let params = {
      id, type, title,
      contexts: ['page', 'tab']
    };
    if (parentId)
      params.parentId = parentId;
    gActiveContextMenuItems.push(params);
    await browser.contextMenus.create(params);
    try {
      await browser.runtime.sendMessage(kTST_ID, {
        type: kTSTAPI_CONTEXT_MENU_CREATE,
        params
      });
    }
    catch(e) {
    }
  }

  for (let id of gContextMenuItems) {
    await registerItem(id);
    if (currentRefreshStart != gLastRefreshStart)
      return;
  }
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
    await registerItem(id);
    if (currentRefreshStart != gLastRefreshStart)
      return;
  }
}

function reserveRefreshContextMenuItems() {
  if (reserveRefreshContextMenuItems.timeout)
    clearTimeout(reserveRefreshContextMenuItems.timeout);
  reserveRefreshContextMenuItems.timeout = setTimeout(() => {
    refreshContextMenuItems();
  }, 150);
}

async function getContextMenuItemVisibilities(aContextTab) {
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
    tearOffTabs:   tabIds.length > 0,
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
    suspendTabs:   tabIds.length > 0 && suspendedCount < tabIds.length,
    resumeTabs:    tabIds.length > 0 && suspendedCount > 0,
    selectAll:     tabIds.length < allTabs.length,
    select:        !aContextTab || tabIds.indexOf(aContextTab.id) < 0,
    unselect:      !aContextTab || tabIds.indexOf(aContextTab.id) > -1,
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
  console.log('selectedTabIds ', selectedTabIds);
  switch (aInfo.menuItemId) {
    case 'reloadTabs':
      await reloadTabs(selectedTabIds);
      clearSelection();
      break;
    case 'bookmarkTabs':
    case 'removeBookmarkFromTabs':

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

    case 'tearOffTabs':

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

    case 'freezeTabs':
    case 'unfreezeTabs':
    case 'protectTabs':
    case 'unprotectTabs':
    case 'lockTabs':
    case 'unlockTabs':

    case 'suspendTabs':
    case 'resumeTabs':

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
      break;
  }
};
browser.contextMenus.onClicked.addListener(contextMenuClickListener);
