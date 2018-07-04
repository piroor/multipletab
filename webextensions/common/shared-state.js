/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as Constants from './constants.js';
import * as Selections from './selections.js';
import * as Commands from './commands.js';
import * as DragSelection from './drag-selection.js';

import EventListenerManager from '../extlib/EventListenerManager.js';

export const onUpdated = new EventListenerManager();

export function initAsMaster() {
  browser.runtime.onMessage.addListener((message, _sender) => {
    if (!message || !message.type)
      return;

    switch (message.type) {
      case Constants.kCOMMAND_PULL_SELECTION_INFO:
        return Promise.resolve(serialize());
    }
  });
}

export async function initAsSlave() {
  const state = await browser.runtime.sendMessage({
    type: Constants.kCOMMAND_PULL_SELECTION_INFO
  });
  apply(state);
}

function reservePush() {
  if (reservePush.reserved)
    clearTimeout(reservePush.reserved);
  reservePush.reserved = setTimeout(() => {
    push();
  }, 150);
}

export async function push(extraInfo = {}) {
  if (reservePush.reserved) {
    clearTimeout(reservePush.reserved);
    delete reservePush.reserved;
  }
  await browser.runtime.sendMessage({
    type:  Constants.kCOMMAND_PUSH_SELECTION_INFO,
    state: serialize(),
    extraInfo
  });
}

function serialize() {
  return {
    selection: Selections.selection.export(),
    dragSelection: DragSelection.serialize()
  };
}

function apply(selections, extraInfo = {}) {
  Selections.selection.apply(selections.selection);
  DragSelection.apply(selections.dragSelection);
  onUpdated.dispatch(extraInfo);
}


browser.runtime.onMessage.addListener((message, _sender) => {
  if (!message || !message.type)
    return;

  switch (message.type) {
    case Constants.kCOMMAND_PUSH_SELECTION_INFO:
      apply(message.state, message.extraInfo);
      break;

    default:
      break;
  }
});

Commands.onSelectionChange.addListener((_tabs, _selected, _options = {}) => {
  reservePush();
});
