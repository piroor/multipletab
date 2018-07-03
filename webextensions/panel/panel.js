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
import * as Commands from '../common/commands.js';
import * as DragSelection from '../common/drag-selection.js';
import MenuUI from '../extlib/MenuUI.js';
import TabFavIconHelper from '../extlib/TabFavIconHelper.js';
import TabIdFixer from '../extlib/TabIdFixer.js';
import '../extlib/l10n.js';

log.context = 'Panel';

let gTabBar;
let gMenu;
let gSizeDefinitions;
let gLastClickedItem = null;
let gDragTargetIsClosebox;
let gClickFired = false;

window.addEventListener('DOMContentLoaded', async () => {
  gTabBar = document.querySelector('#tabs');
  gMenu = document.querySelector('#menu');
  gMenu.ui = new MenuUI({
    root:              gMenu,
    onCommand:         onMenuCommand,
    animationDuration: 150
  });
  gSizeDefinitions = document.getElementById('size-definitions');

  await configs.$loaded;
  document.documentElement.dataset.theme = configs.theme;
  const response = await browser.runtime.sendMessage({
    type: Constants.kCOMMAND_PULL_SELECTION_INFO
  });
  Commands.gSelection.apply(response.selection);
  Commands.gDragSelection.apply(response.dragSelection);

  gLastClickedItem = null;

  await updateUIForTST();

  browser.tabs.onActivated.addListener(onTabModified);
  browser.tabs.onCreated.addListener(onTabModified);
  browser.tabs.onRemoved.addListener(onTabModified);
  browser.runtime.onMessage.addListener(onMessage);

  window.addEventListener('contextmenu', onContextMenu, { capture: true });
  window.addEventListener('click', onClick);
  gTabBar.addEventListener('mousedown', onMouseDown);
  gTabBar.addEventListener('mouseup', onMouseUp);
  await rebuildTabItems();

  gSizeDefinitions.textContent = `
    :root {
      --menu-max-width: ${window.innerWidth - 32}px;
      --menu-max-height: ${window.innerHeight - 32}px;
    }
  `;

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
  browser.tabs.onActivated.removeListener(onTabModified);
  browser.tabs.onCreated.removeListener(onTabModified);
  browser.tabs.onRemoved.removeListener(onTabModified);
  browser.runtime.onMessage.removeListener(onMessage);
}, { once: true });

function onTabModified() {
  reserveClearSelection();
}

async function updateUIForTST() {
  const disabledMessage = document.querySelector('#disabled-message');

  if (configs.disablePanelWhenAlternativeTabBarIsAvailable) {
    try {
      const responded = await browser.runtime.sendMessage(Constants.kTST_ID, {
        type: Constants.kTSTAPI_PING
      });
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
    Commands.clearSelection();
  }, 100);
}

function onMessage(aMessage) {
  if (!aMessage || !aMessage.type)
    return;

  switch (aMessage.type) {
    case Constants.kCOMMAND_PUSH_SELECTION_INFO:
      Commands.gSelection.apply(aMessage.selection);
      Commands.gDragSelection.apply(aMessage.dragSelection);
      rebuildTabItems();
      break;
  }
}

Commands.onSelectionChange.addListener((aTabs, aSelected, _options = {}) => {
  if (!aTabs.length)
    return;
  if (gDragTargetIsClosebox) {
    const selectors = aTabs.map(aTab => `#tab-${aTab.id}`);
    const items = document.querySelectorAll(selectors.join(', '));
    for (const item of items) {
      if (aSelected)
        item.classList.add('ready-to-close');
      else
        item.classList.remove('ready-to-close');
    }
  }
  else {
    const selectors = aTabs.map(aTab => `#tab-${aTab.id} input[type="checkbox"]`);
    const checkboxes = document.querySelectorAll(selectors.join(', '));
    for (const checkbox of checkboxes) {
      checkbox.checked = !!aSelected;
      const item = checkbox.parentNode.parentNode;
      if (aSelected)
        item.classList.add('selected');
      else
        item.classList.remove('selected');
    }
  }
  Commands.reservePushSelectionState();
});

function findTabItemFromEvent(aEvent) {
  let target = aEvent.target;
  while (target && !target.tab) {
    target = target.parentNode;
  }
  if (target && target.tab)
    return target;
  else
    return null;
}

function findCheckboxFromEvent(aEvent) {
  let target = aEvent.target;
  while (target && String(target.localName).toLowerCase() != 'input') {
    target = target.parentNode;
  }
  if (target && target.getAttribute('type') == 'checkbox')
    return target;
  else
    return null;
}

function findBottomCaptionFromEvent(aEvent) {
  let target = aEvent.target;
  while (target && target.className != 'caption bottom') {
    target = target.parentNode;
  }
  if (target && target.className == 'caption bottom')
    return target;
  else
    return null;
}

function onContextMenu(aEvent) {
  aEvent.stopPropagation();
  aEvent.preventDefault();
  openMenu(aEvent);
}

function onClick(aEvent) {
  if (aEvent.button != 0)
    return;

  gClickFired = true;
  if (aEvent.target.classList &&
      aEvent.target.classList.contains('closebox')) {
    if (!document.querySelector('.ready-to-close'))
      browser.tabs.remove(aEvent.target.parentNode.tab.id);
    return;
  }
  const caption = findBottomCaptionFromEvent(aEvent);
  if (caption && !gMenu.classList.contains('open')) {
    openMenu(aEvent);
    return;
  }
  gMenu.ui.close();
  if (findCheckboxFromEvent(aEvent))
    return;
  const item = findTabItemFromEvent(aEvent);
  if (item) {
    DragSelection.onTabItemClick({
      window:        item.tab.windowId,
      tab:           item.tab,
      lastActiveTab: gLastClickedItem.tab,
      button:        aEvent.button,
      altKey:        aEvent.altKey,
      ctrlKey:       aEvent.ctrlKey,
      metaKey:       aEvent.metaKey,
      shiftKey:      aEvent.shiftKey
    });
    gLastClickedItem.classList.remove('last-focused');
    gLastClickedItem = item;
    gLastClickedItem.classList.add('last-focused');
  }
  else
    DragSelection.onNonTabAreaClick({
      button: aEvent.button
    });
}

let gLastDragEnteredTarget;
let gOnDragExitTimeout;

async function onMouseDown(aEvent) {
  switch (aEvent.button) {
    case 0:
      gClickFired = false;
      gTabBar.addEventListener('mousemove', onMouseMove);
      break;
  }
}

async function onMouseMove(aEvent) {
  gTabBar.removeEventListener('mousemove', onMouseMove);
  if (gClickFired)
    return;
  const item = findTabItemFromEvent(aEvent);
  if (!item)
    return;
  Commands.gSelection.targetWindow = (await browser.windows.getCurrent()).id
  gDragTargetIsClosebox =  aEvent.target.classList.contains('closebox');
  gLastDragEnteredTarget = gDragTargetIsClosebox ? aEvent.target : item ;
  DragSelection.onTabItemDragReady({
    tab:             item.tab,
    window:          Commands.gSelection.targetWindow,
    startOnClosebox: gDragTargetIsClosebox
  })
  gTabBar.addEventListener('mouseover', onMouseOver);
  gTabBar.addEventListener('mouseout', onMouseOut);
  gTabBar.setCapture(false);
}

function onMouseUp(aEvent) {
  if (gMenu.classList.contains('open'))
    return;
  const item = findTabItemFromEvent(aEvent);
  setTimeout(() => {
    if (gClickFired)
      return;
    DragSelection.onTabItemDragEnd({
      tab:     item && item.tab,
      window:  Commands.gSelection.targetWindow,
      clientX: aEvent.clientX,
      clientY: aEvent.clientY
    });
  }, 10);
  gTabBar.removeEventListener('mousemove', onMouseMove);
  gTabBar.removeEventListener('mouseover', onMouseOver);
  gTabBar.removeEventListener('mouseout', onMouseOut);
  document.releaseCapture();
}

function onMouseOver(aEvent) {
  const item       = findTabItemFromEvent(aEvent);
  let target     = item;
  const isClosebox = aEvent.target.classList.contains('closebox');
  if (gDragTargetIsClosebox && isClosebox)
    target = aEvent.target;
  cancelDelayedDragExit(target);
  if (item &&
      (!gDragTargetIsClosebox || isClosebox)) {
    if (target != gLastDragEnteredTarget) {
      DragSelection.onTabItemDragEnter({
        tab:    item.tab,
        window: Commands.gSelection.targetWindow
      });
    }
  }
  gLastDragEnteredTarget = target;
}

function onMouseOut(aEvent) {
  const isClosebox = aEvent.target.classList.contains('closebox');
  if (gDragTargetIsClosebox && !isClosebox)
    return;
  const item = findTabItemFromEvent(aEvent);
  if (!item)
    return;
  let target = item;
  if (gDragTargetIsClosebox && isClosebox)
    target = aEvent.target;
  cancelDelayedDragExit(target);
  gOnDragExitTimeout = setTimeout(() => {
    gOnDragExitTimeout = null;
    DragSelection.onTabItemDragExit({
      tab:    item.tab,
      window: Commands.gSelection.targetWindow
    });
  }, 10);
}

function cancelDelayedDragExit() {
  if (gOnDragExitTimeout) {
    clearTimeout(gOnDragExitTimeout);
    gOnDragExitTimeout = null;
  }
}

DragSelection.onDragSelectionEnd.addListener(aMessage => {
  const tab = Commands.gDragSelection.dragStartTarget.id;
  Commands.pushSelectionState({
    updateMenu: true,
    contextTab: tab.id
  }).then(() => {
    openMenu(aMessage);
  });
});


async function rebuildTabItems() {
  const range = document.createRange();
  range.selectNodeContents(gTabBar);
  range.deleteContents();
  const fragment = document.createDocumentFragment();
  const tabs = await browser.tabs.query({ currentWindow: true });
  for (const tab of tabs) {
    TabIdFixer.fixTab(tab);
    const tabItem = buildTabItem(tab);
    fragment.appendChild(tabItem);
  }
  range.insertNode(fragment);
  range.detach();
}

function buildTabItem(aTab) {
  const item = document.createElement('li');

  const label    = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.setAttribute('type', 'checkbox');
  if (aTab.id in Commands.gSelection.tabs)
    checkbox.setAttribute('checked', true);
  checkbox.addEventListener('change', () => {
    item.classList.toggle('selected');
    Commands.setSelection(aTab, item.classList.contains('selected'), { globalHighlight: false });
  });
  label.appendChild(checkbox);
  const favicon = document.createElement('img');
  TabFavIconHelper.loadToImage({
    image: favicon,
    tab:   aTab
  });
  label.appendChild(favicon);

  const defaultFavicon = document.createElement('span');
  defaultFavicon.classList.add('default-favicon');
  label.appendChild(defaultFavicon);

  const title = document.createElement('span');
  title.classList.add('title');
  title.appendChild(document.createTextNode(aTab.title));
  label.appendChild(title);

  item.setAttribute('id', `tab-${aTab.id}`);
  if (aTab.active) {
    gLastClickedItem = item;
    item.classList.add('last-focused');
  }
  if (aTab.id in Commands.gSelection.tabs)
    item.classList.add('selected');
  item.appendChild(label);
  item.tab = aTab;

  const closebox = document.createElement('span');
  closebox.classList.add('closebox');
  item.appendChild(closebox);

  return item;
}


async function openMenu(aEvent) {
  const hasItems = await buildMenu();
  if (!hasItems)
    return;
  gMenu.ui.open({
    left: aEvent.clientX,
    top:  aEvent.clientY
  });
}

function onMenuCommand(aItem, aEvent) {
  if (aEvent.button != 0)
    return gMenu.ui.close();

  wait(0).then(() => gMenu.ui.close());

  const id = aItem.getAttribute('data-item-id');
  if (id) {
    browser.runtime.sendMessage({
      type: Constants.kCOMMAND_SELECTION_MENU_ITEM_CLICK,
      id:   id
    });
  }
}

async function buildMenu() {
  const items = await browser.runtime.sendMessage({
    type: Constants.kCOMMAND_PULL_ACTIVE_CONTEXT_MENU_INFO
  });
  items.shift(); // delete toplevel "selection" menu

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

function buildMenuItem(aItem) {
  const itemNode = document.createElement('li');
  itemNode.setAttribute('data-item-id', aItem.id);
  itemNode.classList.add('extra');
  itemNode.classList.add(aItem.type);
  if (aItem.type != 'separator') {
    itemNode.appendChild(document.createTextNode(aItem.title));
    itemNode.setAttribute('title', aItem.title);
  }
  return itemNode;
}
