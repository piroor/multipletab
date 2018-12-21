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
import DragSelection from '/common/drag-selection.js';
import MenuUI from '/extlib/MenuUI.js';
import TabFavIconHelper from '/extlib/TabFavIconHelper.js';
import '../extlib/l10n.js';

log.context = 'Panel';

let gTabBar;
let gMenu;
let gSizeDefinitions;
let gLastClickedItem = null;
let gDragTargetIsClosebox;
let gClickFired = false;
let gWindowId = null;
let gDragSelection;

let gContextMenuIsOpened = false;

window.addEventListener('DOMContentLoaded', async () => {
  gTabBar = document.querySelector('#tabs');
  gMenu = document.querySelector('#menu');
  gMenu.ui = new MenuUI({
    root:              gMenu,
    onCommand:         onMenuCommand,
    onShown:           onMenuShown,
    animationDuration: 150
  });
  gSizeDefinitions = document.getElementById('size-definitions');

  await configs.$loaded;
  document.documentElement.dataset.theme = configs.theme;
  gWindowId = (await browser.windows.getLastFocused()).id;
  gDragSelection = new DragSelection(gWindowId)
  gDragSelection.syncFromHighlighted();
  gDragSelection.onDragSelectionEnd.addListener(onDragSelectionEnd);
  gDragSelection.onSelectionChange.addListener(onSelectionChange);
  gDragSelection.onCloseSelectionChange.addListener(onCloseSelectionChange);

  gLastClickedItem = null;

  await updateUIForTST();

  browser.tabs.onCreated.addListener(onTabModified);
  browser.tabs.onRemoved.addListener(onTabModified);
  browser.tabs.onMoved.addListener(onTabModified);
  browser.tabs.onAttached.addListener(onTabModified);
  browser.tabs.onDetached.addListener(onTabModified);

  browser.menus.onHidden.addListener(onMenuHidden);

  window.addEventListener('contextmenu', onContextMenu, { capture: true });
  window.addEventListener('click', onClick);
  gTabBar.addEventListener('mousedown', onMouseDown);
  gTabBar.addEventListener('mouseup', onMouseUp);
  await rebuildTabItems();

  gSizeDefinitions.textContent = `
    :root {
      --menu-max-width: ${window.innerWidth - 32}px;
      --menu-max-height: ${window.innerHeight - 32}px;
      --panel-min-width: ${configs.panelMinWidth};
      --panel-max-width: ${configs.panelMaxWidth};
      --panel-min-height: ${configs.panelMinHeight};
      --panel-max-height: ${configs.panelMaxHeight};
      --panel-font-size: ${configs.panelFontSize};
    }
  `;

  browser.runtime.connect({
    name: `${Constants.kCOMMAND_REQUEST_CONNECT_PREFIX}${Date.now()}`
  });

  browser.runtime.sendMessage({
    type: Constants.kCOMMAND_NOTIFY_PANEL_SHOWN
  });
}, { once: true });

window.addEventListener('pagehide', () => {
  window.removeEventListener('contextmenu', onContextMenu, { capture: true });
  window.removeEventListener('click', onClick);
  gTabBar.removeEventListener('mousedown', onMouseDown);
  gTabBar.removeEventListener('mouseup', onMouseUp);
  gTabBar.removeEventListener('mouseover', onMouseOver);
  gTabBar.removeEventListener('mouseout', onMouseOut);
  browser.tabs.onCreated.removeListener(onTabModified);
  browser.tabs.onRemoved.removeListener(onTabModified);
  browser.tabs.onMoved.removeListener(onTabModified);
  browser.tabs.onAttached.removeListener(onTabModified);
  browser.tabs.onDetached.removeListener(onTabModified);
  browser.menus.onHidden.removeListener(onMenuHidden);
  gDragSelection.onDragSelectionEnd.removeListener(onDragSelectionEnd);
  gDragSelection.onSelectionChange.removeListener(onSelectionChange);
  gDragSelection.onCloseSelectionChange.removeListener(onCloseSelectionChange);
  gDragSelection.destroy();
  gWindowId = null;
}, { once: true });

function onTabModified() {
  reserveClearSelection();
  reserveRebuildTabItems();
}

function onMenuHidden() {
  gContextMenuIsOpened = false;
}

async function updateUIForTST() {
  const disabledMessage = document.querySelector('#disabled-message');

  if (configs.disablePanelWhenAlternativeTabBarIsAvailable) {
    try {
      const responded = await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_PING
      }).catch(handleMissingReceiverError);
      if (responded) {
        disabledMessage.style.display = 'block';
        return;
      }
    }
    catch(_e) {
      // failed to establish connection
    }

    browser.runtime.sendMessage({
      type: Constants.kCOMMAND_UNREGISTER_FROM_TST
    });
  }

  disabledMessage.style.display = 'none';
}


function reserveClearSelection() {
  if (reserveClearSelection.reserved)
    clearTimeout(reserveClearSelection.reserved);
  reserveClearSelection.reserved = setTimeout(() => {
    delete reserveClearSelection.reserved;
    gDragSelection.clear();
  }, 100);
}

function onDragSelectionEnd(message, _selectionInfo) {
  log('onDragSelectionEnd ', message);
  gDragSelection.syncToHighlighted().then(() => {
    log('ready to open');
    if (gContextMenuIsOpened)
      return;
    openMenu(message);
  }).catch(console.log);
}

function onSelectionChange(info) {
  for (const tab of info.selected.concat(info.unselected)) {
    const item = document.getElementById(`tab-${tab.id}`);
    if (!item)
      continue;
    const checkbox = item.querySelector('input[type="checkbox"]');
    const selected = info.selected.includes(tab);
    checkbox.checked = selected;
    if (selected)
      item.classList.add('selected');
    else
      item.classList.remove('selected');
  }
}

function onCloseSelectionChange(info) {
  for (const tab of info.selected.concat(info.unselected)) {
    const item = document.getElementById(`tab-${tab.id}`);
    if (!item)
      continue;
    if (info.selected.includes(tab))
      item.classList.add('ready-to-close');
    else
      item.classList.remove('ready-to-close');
  }
}

function findTabItemFromEvent(event) {
  let target = event.target;
  while (target && !target.tab) {
    target = target.parentNode;
  }
  if (target && target.tab)
    return target;
  else
    return null;
}

function findCheckboxFromEvent(event) {
  let target = event.target;
  while (target && String(target.localName).toLowerCase() != 'input') {
    target = target.parentNode;
  }
  if (target && target.getAttribute('type') == 'checkbox')
    return target;
  else
    return null;
}

function findBottomCaptionFromEvent(event) {
  let target = event.target;
  while (target && target.className != 'caption bottom') {
    target = target.parentNode;
  }
  if (target && target.className == 'caption bottom')
    return target;
  else
    return null;
}

function onContextMenu(event) {
  const tabItem = findTabItemFromEvent(event);
  if (tabItem) {
    browser.menus.overrideContext({
      context: 'tab',
      tabId:   tabItem.tab.id
    });
    gContextMenuIsOpened = true;
    return;
  }
  event.stopPropagation();
  event.preventDefault();
  openMenu(event);
}

let mLastDragSelectionClicked;

async function onClick(event) {
  if (event.button != 0)
    return;

  gClickFired = true;
  if (event.target.classList &&
      event.target.classList.contains('closebox')) {
    if (!document.querySelector('.ready-to-close'))
      browser.tabs.remove(event.target.parentNode.tab.id);
    return;
  }
  const caption = findBottomCaptionFromEvent(event);
  if (caption && !gMenu.classList.contains('open')) {
    openMenu(event);
    return;
  }
  gMenu.ui.close();
  if (findCheckboxFromEvent(event))
    return;
  const item = findTabItemFromEvent(event);
  if (item) {
    mLastDragSelectionClicked = gDragSelection.onClick({
      window:        item.tab.windowId,
      tab:           item.tab,
      lastActiveTab: gLastClickedItem && gLastClickedItem.tab,
      button:        event.button,
      altKey:        event.altKey,
      ctrlKey:       event.ctrlKey,
      metaKey:       event.metaKey,
      shiftKey:      event.shiftKey
    }, true).catch(console.log);
    if (gLastClickedItem)
      gLastClickedItem.classList.remove('last-focused');
    gLastClickedItem = item;
    gLastClickedItem.classList.add('last-focused');
  }
  else
    gDragSelection.onNonTabAreaClick({
      button: event.button
    }).catch(console.log);
}

let gLastDragEnteredTarget;
let gOnDragExitTimeout;

async function onMouseDown(event) {
  switch (event.button) {
    case 0:
      gClickFired = false;
      gTabBar.addEventListener('mousemove', onMouseMove);
      break;
  }
}

let mIsCapturing = false;

async function onMouseMove(event) {
  gTabBar.removeEventListener('mousemove', onMouseMove);
  if (gClickFired ||
      !configs.enableDragSelection)
    return;
  const item = findTabItemFromEvent(event);
  if (!item)
    return;
  gDragTargetIsClosebox =  event.target.classList.contains('closebox');
  gLastDragEnteredTarget = gDragTargetIsClosebox ? event.target : item ;
  gDragSelection.onDragReady({
    tab:             item.tab,
    window:          gWindowId,
    startOnClosebox: gDragTargetIsClosebox
  }).catch(console.log);
  gTabBar.addEventListener('mouseover', onMouseOver);
  gTabBar.addEventListener('mouseout', onMouseOut);
  gTabBar.setCapture(false);
  mIsCapturing = true;
}

function onMouseUp(event) {
  if (gLastClickedItem)
    gLastClickedItem.classList.remove('last-focused');
  gLastClickedItem = null;
  if (mIsCapturing) {
    gTabBar.removeEventListener('mousemove', onMouseMove);
    gTabBar.removeEventListener('mouseover', onMouseOver);
    gTabBar.removeEventListener('mouseout', onMouseOut);
  }
  document.releaseCapture();
  if (event.button != 0 ||
      gMenu.classList.contains('open') ||
      !configs.enableDragSelection)
    return;
  const item = findTabItemFromEvent(event);
  gLastClickedItem = item;
  setTimeout(async () => {
    if (gClickFired)
      return;
    await buildMenu();
    gDragSelection.onDragEnd({
      tab:     item && item.tab,
      window:  gWindowId,
      clientX: event.clientX,
      clientY: event.clientY
    }).catch(console.log);
  }, 10);
}

function onMouseOver(event) {
  if (!configs.enableDragSelection)
    return;
  const item       = findTabItemFromEvent(event);
  let target     = item;
  const isClosebox = event.target.classList.contains('closebox');
  if (gDragTargetIsClosebox && isClosebox)
    target = event.target;
  cancelDelayedDragExit(target);
  if (item &&
      (!gDragTargetIsClosebox || isClosebox)) {
    if (target != gLastDragEnteredTarget) {
      gDragSelection.onDragEnter({
        tab:    item.tab,
        window: gWindowId
      }).catch(console.log);
    }
  }
  gLastDragEnteredTarget = target;
}

function onMouseOut(event) {
  const isClosebox = event.target.classList.contains('closebox');
  if (gDragTargetIsClosebox && !isClosebox)
    return;
  const item = findTabItemFromEvent(event);
  if (!item ||
      !configs.enableDragSelection)
    return;
  let target = item;
  if (gDragTargetIsClosebox && isClosebox)
    target = event.target;
  cancelDelayedDragExit(target);
  gOnDragExitTimeout = setTimeout(() => {
    gOnDragExitTimeout = null;
    gDragSelection.onDragExit({
      tab:    item.tab,
      window: gWindowId
    }).catch(console.log);
  }, 10);
}

function cancelDelayedDragExit() {
  if (gOnDragExitTimeout) {
    clearTimeout(gOnDragExitTimeout);
    gOnDragExitTimeout = null;
  }
}


function reserveRebuildTabItems() {
  if (reserveRebuildTabItems.reserved)
    clearTimeout(reserveRebuildTabItems.reserved);
  reserveRebuildTabItems.reserved = setTimeout(() => {
    delete reserveRebuildTabItems.reserved;
    rebuildTabItems();
  }, 100);
}

async function rebuildTabItems() {
  const range = document.createRange();
  range.selectNodeContents(gTabBar);
  range.deleteContents();
  const fragment = document.createDocumentFragment();
  const tabs = await browser.tabs.query({ currentWindow: true });
  for (const tab of tabs) {
    const tabItem = buildTabItem(tab);
    fragment.appendChild(tabItem);
  }
  range.insertNode(fragment);
  range.detach();
}

function buildTabItem(tab) {
  const item = document.createElement('li');
  item.classList.toggle('tab');

  const label    = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.setAttribute('type', 'checkbox');
  if (gDragSelection.has(tab))
    checkbox.setAttribute('checked', true);
  checkbox.addEventListener('change', async () => {
    await mLastDragSelectionClicked;
    item.classList.toggle('selected');
    if (item.classList.contains('selected')) {
      gDragSelection.add(tab);
    }
    else {
      gDragSelection.delete(tab);
    }
    gDragSelection.syncToHighlighted();
  });
  label.appendChild(checkbox);
  const favicon = document.createElement('img');
  TabFavIconHelper.loadToImage({
    image: favicon,
    tab:   tab
  });
  label.appendChild(favicon);

  const defaultFavicon = document.createElement('span');
  defaultFavicon.classList.add('default-favicon');
  label.appendChild(defaultFavicon);

  const title = document.createElement('span');
  title.classList.add('title');
  title.appendChild(document.createTextNode(tab.title));
  label.appendChild(title);

  item.setAttribute('id', `tab-${tab.id}`);
  if (tab.active) {
    gLastClickedItem = item;
    item.classList.add('last-focused');
  }
  if (gDragSelection.has(tab))
    item.classList.add('selected');
  item.appendChild(label);
  item.tab = tab;

  const closebox = document.createElement('span');
  closebox.classList.add('closebox');
  item.appendChild(closebox);

  return item;
}


async function openMenu(event) {
  const hasItems = await buildMenu();
  log('openMenu: hasItems ', hasItems);
  if (!hasItems)
    return;
  gMenu.ui.open({
    left: event.clientX,
    top:  event.clientY
  });
}

async function onMenuCommand(item, event) {
  if (event.button != 0)
    return gMenu.ui.close();

  wait(0).then(() => gMenu.ui.close());

  const id = item.getAttribute('data-item-id');
  if (id) {
    const contextTab = gLastClickedItem && gLastClickedItem.tab || (await browser.tabs.query({ currentWindow: true, active: true }))[0];
    browser.runtime.sendMessage({
      type: Constants.kCOMMAND_SELECTION_MENU_ITEM_CLICK,
      id:   id,
      contextTab
    });
  }
}

function onMenuShown() {
}

async function buildMenu() {
  const items = await browser.runtime.sendMessage({
    type:   Constants.kCOMMAND_PULL_ACTIVE_CONTEXT_MENU_INFO,
    tabIds: gDragSelection.selectedTabIds
  });
  log('buildMenu for ', items);

  const range = document.createRange();
  range.selectNodeContents(gMenu);
  range.deleteContents();

  const fragment = document.createDocumentFragment();
  const knownItems = {};
  for (const item of items) {
    if (item.id == 'select' ||
        item.id == 'unselect')
      continue;

    const itemNode = buildMenuItem(item);
    if (item.icons)
      itemNode.dataset.icon = item.icons['16'];
    if (item.parentId &&
        item.parentId != 'selection' &&
        item.parentId in knownItems) {
      const parent = knownItems[item.parentId];
      let subMenu = parent.lastChild;
      if (!subMenu || subMenu.localName != 'ul')
        subMenu = parent.appendChild(document.createElement('ul'));
      subMenu.appendChild(itemNode);
    }
    else {
      gMenu.appendChild(itemNode);
    }
    knownItems[item.id] = itemNode;
  }
  range.insertNode(fragment);

  range.detach();
  return gMenu.hasChildNodes();
}

function buildMenuItem(item) {
  const itemNode = document.createElement('li');
  itemNode.setAttribute('data-item-id', item.id);
  itemNode.classList.add('extra');
  itemNode.classList.add(item.type);
  if (item.type != 'separator') {
    itemNode.appendChild(document.createTextNode(item.title));
    itemNode.setAttribute('title', item.title);
  }
  return itemNode;
}
