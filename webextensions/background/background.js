/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'BG';

window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;

  browser.tabs.onActivated.addListener(() => clearSelection());
  browser.tabs.onCreated.addListener(() => clearSelection());
  browser.tabs.onRemoved.addListener(() => clearSelection());

  reserveRefreshContextMenuItems();
  configs.$addObserver(onConfigChanged);

  browser.runtime.onMessageExternal.addListener(onMessageExternal);
  registerToTST();
}, { once: true });


/*  listen events */

function onDragSelectionEnd(aMessage) {
    let tab = gDragSelection.dragStartTarget.id;
    refreshContextMenuItems(tab).then(() => {
      browser.runtime.sendMessage(kTST_ID, {
        type: kTSTAPI_CONTEXT_MENU_OPEN,
        window: gSelection.targetWindow,
        tab:  tab,
        left: aMessage.clientX,
        top:  aMessage.clientY
      });
    });
}

function onTSTAPIMessage(aMessage) {
  switch (aMessage.type) {
    case kTSTAPI_NOTIFY_READY:
      registerToTST();
      return Promise.resolve(true);

    case kTSTAPI_NOTIFY_TAB_CLICKED:
      return onTabItemClick(aMessage);

    case kTSTAPI_NOTIFY_TABBAR_CLICKED:
      return onNonTabAreaClick(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGREADY:
      return onTabItemDragReady(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGSTART:
      return onTabItemDragStart(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGENTER:
      return onTabItemDragEnter(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGEXIT:
      return onTabItemDragExit(aMessage);

    case kTSTAPI_NOTIFY_TAB_DRAGEND:
      return onTabItemDragEnd(aMessage);

    case kTSTAPI_CONTEXT_MENU_CLICK:
      return contextMenuClickListener(aMessage.info, aMessage.tab);
  }
}

function onMessageExternal(aMessage, aSender) {
  //console.log('onMessageExternal: ', aMessage, aSender);
  switch (aSender.id) {
    case kTST_ID:
      return onTSTAPIMessage(aMessage);
  }
}


async function registerToTST() {
  await browser.runtime.sendMessage(kTST_ID, {
    type:  kTSTAPI_REGISTER_SELF,
    name:  browser.i18n.getMessage('extensionName'),
    style: `
      .tab.selected::after {
        background: Highlight;
        bottom: 0;
        content: " ";
        display: block;
        left: 0;
        opacity: 0.5;
        pointer-events: none;
        position: absolute;
        right: 0;
        top: 0;
        z-index: 10;
      }

      /* ::after pseudo element prevents firing of dragstart event */
      .tab.ready-to-close .closebox {
        background: Highlight;
      }
    `
  });
  refreshContextMenuItems(null, true); // force rebuild menu
}

function onConfigChanged(aKey) {
  switch (aKey) {
    case 'copyToClipboardFormats':
      reserveRefreshContextMenuItems();
      break;

    default:
      if (aKey.indexOf('context_') == 0)
        reserveRefreshContextMenuItems();
      break;
  }
}
