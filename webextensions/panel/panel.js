/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'Panel';

var gTabBar;
var gMenu;

window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;
  var response = await browser.runtime.sendMessage({
    type: kCOMMAND_PULL_SELECTION_INFO
  });
  gSelection = response.selection;
  gDragSelection = response.dragSelection;

  await updateUIForTST();

  browser.tabs.onActivated.addListener(onTabModified);
  browser.tabs.onCreated.addListener(onTabModified);
  browser.tabs.onRemoved.addListener(onTabModified);
  browser.runtime.onMessage.addListener(onMessage);

  window.addEventListener('contextmenu', onContextMenu, { capture: true });
  window.addEventListener('click', onClick);
  gTabBar = document.querySelector('#tabs');
  gTabBar.addEventListener('mousedown', onMouseDown);
  gTabBar.addEventListener('mouseup', onMouseUp);
  gMenu = document.querySelector('#menu ul');
  await rebuildTabItems();

  browser.runtime.sendMessage({
    type: kCOMMAND_NOTIFY_PANEL_SHOWN
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
  var disabledMessage = document.querySelector('#disabled-message');

  try {
    let responded = await browser.runtime.sendMessage(kTST_ID, {
      type: kTSTAPI_PING
    });
    if (responded)
      disabledMessage.style.display = 'block';
    return;
  }
  catch(e) {
    // failed to establish connection
  }

  browser.runtime.sendMessage({
    type: kCOMMAND_UNREGISTER_FROM_TST
  });
  disabledMessage.style.display = 'none';
}


function reserveClearSelection() {
  if (reserveClearSelection.reserved)
    clearTimeout(reserveClearSelection.reserved);
  reserveClearSelection.reserved = setTimeout(() => {
    delete reserveClearSelection.reserved;
    clearSelection();
  }, 100);
}

function onMessage(aMessage) {
  if (!aMessage || !aMessage.type)
    return;

  switch (aMessage.type) {
    case kCOMMAND_PUSH_SELECTION_INFO:
      gSelection = aMessage.selection;
      gDragSelection = aMessage.dragSelection;
      rebuildTabItems();
      break;
  }
}

function onSelectionChange(aTabs, aSelected, aOptions = {}) {
  if (gDragTargetIsClosebox) {
    let selectors = aTabs.map(aTab => `#tab-${aTab.id}`);
    let items = document.querySelectorAll(selectors.join(', '));
    for (let item of items) {
      if (aSelected)
        item.classList.add('ready-to-close');
      else
        item.classList.remove('ready-to-close');
    }
  }
  else {
    let selectors = aTabs.map(aTab => `#tab-${aTab.id} input[type="checkbox"]`);
    let checkboxes = document.querySelectorAll(selectors.join(', '));
    for (let checkbox of checkboxes) {
      checkbox.checked = !!aSelected;
      let item = checkbox.parentNode.parentNode;
      if (aSelected)
        item.classList.add('selected');
      else
        item.classList.remove('selected');
    }
  }
  reservePushSelectionState();
}

function findTabItemFromEvent(aEvent) {
  var target = aEvent.target;
  while (target && !target.tab) {
    target = target.parentNode;
  }
  if (target && target.tab)
    return target;
  else
    return null;
}

function findBottomCaptionFromEvent(aEvent) {
  var target = aEvent.target;
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
  var caption = findBottomCaptionFromEvent(aEvent);
  if (caption && !gMenu.classList.contains('open')) {
    openMenu();
    return;
  }
  closeMenu();
  var item = findTabItemFromEvent(aEvent);
  if (!item)
    clearSelection({
      states: ['selected', 'ready-to-close']
    });
}

var gLastDragEnteredItem;
var gLastDragEnteredTarget;
var gDragTargetIsClosebox;
var gOnDragExitTimeout;
var gClickFired = false;

async function onMouseDown(aEvent) {
  switch (aEvent.button) {
    case 0:
      gClickFired = false;
      gTabBar.addEventListener('mousemove', onMouseMove);
      break;

    case 2:
      aEvent.stopPropagation();
      aEvent.preventDefault();
      openMenu();
      break;
  }
}

async function onMouseMove(aEvent) {
  gTabBar.removeEventListener('mousemove', onMouseMove);
  if (gClickFired)
    return;
  var item = findTabItemFromEvent(aEvent);
  if (!item)
    return;
  gSelection.targetWindow = (await browser.windows.getCurrent()).id
  gDragTargetIsClosebox =  aEvent.target.classList.contains('closebox');
  gLastDragEnteredItem = item;
  gLastDragEnteredTarget = gDragTargetIsClosebox ? aEvent.target : item ;
  onTabItemDragReady({
    tab:             item.tab,
    window:          gSelection.targetWindow,
    startOnClosebox: gDragTargetIsClosebox
  })
  gTabBar.addEventListener('mouseover', onMouseOver);
  gTabBar.addEventListener('mouseout', onMouseOut);
  gTabBar.setCapture(false);
}

function onMouseUp(aEvent) {
  var item = findTabItemFromEvent(aEvent);
  setTimeout(() => {
    if (gClickFired)
      return;
    onTabItemDragEnd({
      tab:     item && item.tab,
      window:  gSelection.targetWindow,
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
  var item       = findTabItemFromEvent(aEvent);
  var target     = item;
  var isClosebox = aEvent.target.classList.contains('closebox');
  if (gDragTargetIsClosebox && isClosebox)
    target = aEvent.target;
  cancelDelayedDragExit(target);
  if (item &&
      (!gDragTargetIsClosebox || isClosebox)) {
    if (target != gLastDragEnteredTarget) {
      onTabItemDragEnter({
        tab:    item.tab,
        window: gSelection.targetWindow
      });
    }
  }
  gLastDragEnteredItem = item;
  gLastDragEnteredTarget = target;
}

function onMouseOut(aEvent) {
  var isClosebox = aEvent.target.classList.contains('closebox');
  if (gDragTargetIsClosebox && !isClosebox)
    return;
  var item = findTabItemFromEvent(aEvent);
  if (!item)
    return;
  var target = item;
  if (gDragTargetIsClosebox && isClosebox)
    target = aEvent.target;
  cancelDelayedDragExit(target);
  gOnDragExitTimeout = setTimeout(() => {
    gOnDragExitTimeout = null;
    onTabItemDragExit({
      tab:    item.tab,
      window: gSelection.targetWindow
    });
  }, 10);
}

function cancelDelayedDragExit() {
  if (gOnDragExitTimeout) {
    clearTimeout(gOnDragExitTimeout);
    gOnDragExitTimeout = null;
  }
}

function onDragSelectionEnd(aMessage) {
  let tab = gDragSelection.dragStartTarget.id;
  pushSelectionState({
    updateMenu: true,
    contextTab: tab.id
  }).then(() => {
    openMenu();
  });
}


async function rebuildTabItems() {
  var range = document.createRange();
  range.selectNodeContents(gTabBar);
  range.deleteContents();
  var fragment = document.createDocumentFragment();
  var tabs = await browser.tabs.query({ currentWindow: true });
  for (let tab of tabs) {
    let tabItem = buildTabItem(tab);
    fragment.appendChild(tabItem);
  }
  range.insertNode(fragment);
  range.detach();
}

function buildTabItem(aTab) {
  var label    = document.createElement('label');
  var checkbox = document.createElement('input');
  checkbox.setAttribute('type', 'checkbox');
  if (aTab.id in gSelection.tabs)
    checkbox.setAttribute('checked', true);
  checkbox.addEventListener('change', () => {
    item.classList.toggle('selected');
    setSelection(aTab, item.classList.contains('selected'), { globalHighlight: false });
  });
  label.appendChild(checkbox);
  var favicon = document.createElement('img');
  TabFavIconHelper.loadToImage({
    image: favicon,
    tab:   aTab
  });
  label.appendChild(favicon);

  var defaultFavicon = document.createElement('span');
  defaultFavicon.classList.add('default-favicon');
  label.appendChild(defaultFavicon);

  var title = document.createElement('span');
  title.classList.add('title');
  title.appendChild(document.createTextNode(aTab.title));
  label.appendChild(title);

  var item = document.createElement('li');
  item.setAttribute('id', `tab-${aTab.id}`);
  if (aTab.id in gSelection.tabs)
    item.classList.add('selected');
  item.appendChild(label);
  item.tab = aTab;

  var closebox = document.createElement('span');
  closebox.classList.add('closebox');
  item.appendChild(closebox);

  return item;
}


async function openMenu() {
  await buildMenu();
  gMenu.classList.add('open');
  setTimeout(() => {
    window.addEventListener('mousedown', onMenuMouseDown, { capture: true });
    window.addEventListener('click', onMenuClick, { capture: true });
  }, 150);
}

function closeMenu() {
  gMenu.classList.remove('open');
  setTimeout(() => {
    window.removeEventListener('mousedown', onMenuMouseDown, { capture: true });
    window.removeEventListener('click', onMenuClick, { capture: true });
  }, 150);
}

function onMenuMouseDown(aEvent) {
  aEvent.stopImmediatePropagation();
  aEvent.stopPropagation();
  aEvent.preventDefault();
}

function onMenuClick(aEvent) {
  if (aEvent.button != 0)
    return closeMenu();

  aEvent.stopImmediatePropagation();
  aEvent.stopPropagation();
  aEvent.preventDefault();

  var target = aEvent.target;
  while (target.nodeType != target.ELEMENT_NODE)
    target = target.parentNode;

  var id = target.getAttribute('data-item-id');
  if (id) {
    browser.runtime.sendMessage({
      type: kCOMMAND_SELECTION_MENU_ITEM_CLICK,
      id:   id
    });
  }

  closeMenu();
}

async function buildMenu() {
  var items = await browser.runtime.sendMessage({
    type: kCOMMAND_PULL_ACTIVE_CONTEXT_MENU_INFO
  });
  items.shift(); // delete toplevel "selection" menu

  var range = document.createRange();
  range.selectNodeContents(gMenu);
  range.deleteContents();

  var fragment = document.createDocumentFragment();
  var knownItems = {};
  for (let item of items) {
    if (item.id == 'select' ||
        item.id == 'unselect')
      continue;

    let itemNode = buildMenuItem(item);
    if (item.parentId &&
        item.parentId != 'selection' &&
        item.parentId in knownItems) {
      let parent = knownItems[item.parentId];
      parent.classList.add('has-submenu');
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
}

function buildMenuItem(aItem) {
  var itemNode = document.createElement('li');
  itemNode.setAttribute('data-item-id', aItem.id);
  itemNode.classList.add('extra');
  itemNode.classList.add(aItem.type);
  if (aItem.type != 'separator') {
    itemNode.appendChild(document.createTextNode(aItem.title));
    itemNode.setAttribute('title', aItem.title);
  }
  return itemNode;
}
