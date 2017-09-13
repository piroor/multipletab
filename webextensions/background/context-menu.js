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
`.trim().split(/\s+/);

var gLastSelectedTabs = '';

async function refreshContextMenuItems(aContextTab, aForce) {
  var serialized = JSON.stringify(gSelectedTabs);
  if (!aForce &&
      serialized == gLastSelectedTabs)
    return;

  await browser.contextMenus.removeAll();
  try {
    await browser.runtime.sendMessage(kTST_ID, {
      type: kTSTAPI_CONTEXT_MENU_REMOVE_ALL
    });
  }
  catch(e) {
  }
  gLastSelectedTabs = serialized;
  var visibilities = await getContextMenuItemVisibilities(aContextTab);

  let separatorsCount = 0;
  let normalItemAppeared = false;
  for (let id of gContextMenuItems) {
    let isSeparator = id.charAt(0) == '-';
    if (isSeparator) {
      if (!normalItemAppeared)
        continue;
      normalItemAppeared = false;
      id = `separator${separatorsCount++}`;
    }
    else {
      if (id in visibilities && !visibilities[id])
        continue;
//      if (!configs[`context_${id}`])
//        continue;
      normalItemAppeared = true;
    }
    let type = isSeparator ? 'separator' : 'normal';
    let title = isSeparator ? null : browser.i18n.getMessage(`context.${id}.label`);
    await browser.contextMenus.create({
      id, type, title,
      contexts: ['page', 'tab']
    });
    try {
      await browser.runtime.sendMessage(kTST_ID, {
        type: kTSTAPI_CONTEXT_MENU_CREATE,
        params: {
          id, type, title,
          contexts: ['page', 'tab']
        }
      });
    }
    catch(e) {
    }
  }
}

function reserveRefreshContextMenuItems() {
  if (reserveRefreshContextMenuItems.timeout)
    clearTimeout(reserveRefreshContextMenuItems.timeout);
  reserveRefreshContextMenuItems.timeout = setTimeout(() => {
    delete reserveRefreshContextMenuItems.timeout;
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
    let tab = gSelectedTabs[id];
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
    removeBookmarkFromTabs: false && tabIds.length > 0,
    duplicateTabs: tabIds.length > 0,
    pinTabs:       tabIds.length > 0 && pinnedCount < tabIds.length,
    unpinTabs:     tabIds.length > 0 && pinnedCount > 0,
    muteTabs:      tabIds.length > 0 && mutedCount < tabIds.length,
    unmuteTabs:    tabIds.length > 0 && mutedCount > 0,
    tearOffTabs:   tabIds.length > 0,
    removeTabs:    tabIds.length > 0,
    removeOther:   tabIds.length > 0 && tabIds.length < allTabs.length,
    clipboard:     false && tabIds.length > 0,
    saveTabs:      false && tabIds.length > 0,
    printTabs:     false && tabIds.length > 0,
    freezeTabs:    false && tabIds.length > 0 && frozenCount < tabIds.length,
    unfreezeTabs:  false && tabIds.length > 0 && frozenCount > 0,
    protectTabs:   false && tabIds.length > 0 && protectedCount < tabIds.length,
    unprotectTabs: false && tabIds.length > 0 && protectedCount > 0,
    lockTabs:      false && tabIds.length > 0 && lockedCount < tabIds.length,
    unlockTabs:    false && tabIds.length > 0 && lockedCount > 0,
    suspendTabs:   false && tabIds.length > 0 && suspendedCount < tabIds.length,
    resumeTabs:    false && tabIds.length > 0 && suspendedCount > 0,
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
    case 'saveTabs':

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
      break;
  }
};
browser.contextMenus.onClicked.addListener(contextMenuClickListener);
