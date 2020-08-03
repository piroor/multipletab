/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import DragSelection from './drag-selection.js';
import EventListenerManager from '/extlib/EventListenerManager.js';

export const onDragSelectionEnd = new EventListenerManager();

const mDragSelections = new Map();

browser.windows.onCreated.addListener(window => {
  getDragSelection(window.id);
});

browser.windows.onRemoved.addListener(windowId => {
  setTimeout(() => {
    const dragSelection = getDragSelection(windowId);
    dragSelection.onDragSelectionEnd.removeListener(delegateOnDragSelectionEnd);
    dragSelection.destroy();
    mDragSelections.delete(windowId);
  }, 100);
});

browser.tabs.onCreated.addListener(tab => {
  getDragSelection(tab.windowId).clear();
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (!removeInfo.isWindowClosing) {
    const selection = getDragSelection(removeInfo.windowId);
    if (selection.selection.has(tabId))
      selection.clear();
  }
});

async function getWindowId(message) {
  return message.window || message.windowId ||
    (message.tab && message.tab.windowId) ||
      (await browser.windows.getLastFocused({})).id;
}

export function getDragSelection(windowId) {
  if (mDragSelections.has(windowId))
    return mDragSelections.get(windowId);

  const dragSelection = new DragSelection(windowId);
  dragSelection.onDragSelectionEnd.addListener(delegateOnDragSelectionEnd);
  mDragSelections.set(windowId, dragSelection);
  return dragSelection;
}

function delegateOnDragSelectionEnd(...args) {
  return onDragSelectionEnd.dispatch(...args);
}


export async function onMouseDown(message, options = {}) {
  return getDragSelection(await getWindowId(message)).onMouseDown(message, options);
}

export async function onMouseUp(message, options = {}) {
  return getDragSelection(await getWindowId(message)).onMouseUp(message, options);
}

export async function onNonTabAreaClick(message, options = {}) {
  return getDragSelection(await getWindowId(message)).onNonTabAreaClick(message, options);
}


export async function onDragReady(message, options = {}) {
  return getDragSelection(await getWindowId(message)).onDragReady(message, options);
}

export async function onDragCancel(message, options = {}) {
  return getDragSelection(await getWindowId(message)).onDragCancel(message, options);
}

export async function onDragStart(message, options = {}) {
  return getDragSelection(await getWindowId(message)).onDragStart(message, options);
}

export async function onDragEnter(message, options = {}) {
  return getDragSelection(await getWindowId(message)).onDragEnter(message, options);
}

export async function onDragExit(message, options = {}) {
  return getDragSelection(await getWindowId(message)).onDragExit(message, options);
}

export async function onDragEnd(message, options = {}) {
  return getDragSelection(await getWindowId(message)).onDragEnd(message, options);
}
