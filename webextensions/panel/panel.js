/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'Panel';

var gTabBar;

window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;
  var response = await browser.runtime.sendMessage({
    type: kCOMMAND_PULL_SELECTION_INFO
  });
  gSelection = response.selection;
  gDragSelection = response.dragSelection;

  browser.tabs.onActivated.addListener(onTabModified);
  browser.tabs.onCreated.addListener(onTabModified);
  browser.tabs.onRemoved.addListener(onTabModified);
  browser.runtime.onMessage.addListener(onMessage);

  gTabBar = document.querySelector('#tabs');
  gTabBar.addEventListener('click', onClick);
  gTabBar.addEventListener('mousedown', onMouseDown);
  gTabBar.addEventListener('mouseup', onMouseUp);
  await rebuildTabItems();
}, { once: true });

window.addEventListener('unload', () => {
  gTabBar.removeEventListener('click', onClick);
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
  clearSelection();
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
  while (!target.tab) {
    target = target.parentNode;
  }
  if (target.tab)
    return target;
  else
    return null;
}

function onClick(aEvent) {
  gWaitingToStartDrag = false;
  if (aEvent.target.classList.contains('closebox')) {
    browser.tabs.remove(aEvent.target.parentNode.tab.id);
    return;
  }
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
var gWaitingToStartDrag = false;

async function onMouseDown(aEvent) {
  gWaitingToStartDrag = true;
  gTabBar.addEventListener('mousemove', onMouseMove);
}

async function onMouseMove(aEvent) {
  gTabBar.removeEventListener('mousemove', onMouseMove);
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
    if (!gWaitingToStartDrag)
      return;
    gWaitingToStartDrag = false;
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
  var item = findTabItemFromEvent(aEvent);
  var isClosebox = aEvent.target.classList.contains('closebox');
  var target = gDragTargetIsClosebox && isClosebox ?
                 aEvent.target :
                 item ;
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
  var target = gDragTargetIsClosebox && isClosebox ?
                 aEvent.target :
                 item ;
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
  var label = document.createElement('label');
  var checkbox = document.createElement('input');
  checkbox.setAttribute('type', 'checkbox');
  if (aTab.id in gSelection.tabs)
    checkbox.setAttribute('checked', true);
  checkbox.addEventListener('change', () => {
    item.classList.toggle('selected');
    setSelection(aTab, item.classList.contains('selected'));
  });
  label.appendChild(checkbox);
  var favicon = document.createElement('img');
  favicon.setAttribute('src', aTab.favIconUrl);
  label.appendChild(favicon);
  label.appendChild(document.createTextNode(aTab.title));

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
