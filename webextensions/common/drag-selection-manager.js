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
  const dragSelection = getDragSelection(windowId);
  dragSelection.onDragSelectionEnd.removeListener(delegateOnDragSelectionEnd);
  mDragSelections.delete(windowId);
});

async function getWindowId(message) {
  return message.window || message.windowId ||
    (message.tab && message.tab.windowId) ||
      (await browser.windows.getLastFocused({})).id;
}

function getDragSelection(windowId) {
  if (mDragSelections.has(windowId))
    return mDragSelections.get(windowId);

  const dragSelection = new DragSelection();
  dragSelection.onDragSelectionEnd.addListener(delegateOnDragSelectionEnd);
  mDragSelections.set(windowId, dragSelection);
  return dragSelection;
}

function delegateOnDragSelectionEnd(...args) {
  return onDragSelectionEnd.dispatch(...args);
}


export async function onClick(message) {
  return getDragSelection(await getWindowId(message)).onClick(message);
}

export async function onMouseUp(message) {
  return getDragSelection(await getWindowId(message)).onMouseUp(message);
}

export async function onNonTabAreaClick(message) {
  return getDragSelection(await getWindowId(message)).onNonTabAreaClick(message);
}


export async function onDragReady(message) {
  return getDragSelection(await getWindowId(message)).onDragReady(message);
}

export async function onDragCancel(message) {
  return getDragSelection(await getWindowId(message)).onDragCancel(message);
}

export async function onDragStart(message) {
  return getDragSelection(await getWindowId(message)).onDragStart(message);
}

export async function onDragEnter(message) {
  return getDragSelection(await getWindowId(message)).onDragEnter(message);
}

export async function onDragExit(message) {
  return getDragSelection(await getWindowId(message)).onDragExit(message);
}

export async function onDragEnd(message) {
  return getDragSelection(await getWindowId(message)).onDragEnd(message);
}


export function activateInVerticalTabbarOfTST() {
  DragSelection.activatedInVerticalTabbarOfTST = true;
}

export function deactivateInVerticalTabbarOfTST() {
  DragSelection.activatedInVerticalTabbarOfTST = false;
}

export function isActivatedInVerticalTabbarOfTST() {
  return !!DragSelection.activatedInVerticalTabbarOfTST;
}
