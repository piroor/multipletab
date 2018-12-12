/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import DragSelection from './drag-selection.js';
import EventListenerManager from '/extlib/EventListenerManager.js';

export const onDragSelectionEnd = new EventListenerManager();

const mDragSelection = new DragSelection();
mDragSelection.onDragSelectionEnd.addListener((...args) => {
  return onDragSelectionEnd.dispatch(...args);
});

export function getDragStartTargetId() {
  return mDragSelection.dragStartTarget && mDragSelection.dragStartTarget.id;
}

export function activateInVerticalTabbarOfTST() {
  mDragSelection.activatedInVerticalTabbarOfTST = true;
}

export function deactivateInVerticalTabbarOfTST() {
  mDragSelection.activatedInVerticalTabbarOfTST = false;
}

export function isActivatedInVerticalTabbarOfTST() {
  return !!mDragSelection.activatedInVerticalTabbarOfTST;
}


export async function onClick(message) {
  return mDragSelection.onClick(message);
}

export async function onMouseUp(message) {
  return mDragSelection.onMouseUp(message);
}

export async function onNonTabAreaClick(message) {
  return mDragSelection.onNonTabAreaClick(message);
}


export async function onDragReady(message) {
  return mDragSelection.onDragReady(message);
}

export async function onDragCancel(message) {
  return mDragSelection.onDragCancel(message);
}

export async function onDragStart(message) {
  return mDragSelection.onDragStart(message);
}

export async function onDragEnter(message) {
  return mDragSelection.onDragEnter(message);
}

export async function onDragExit(message) {
  return mDragSelection.onDragExit(message);
}

export async function onDragEnd(message) {
  return mDragSelection.onDragEnd(message);
}
