/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const kID = 'multipletab@piro.sakura.ne.jp';
const kTST_ID = 'treestyletab@piro.sakura.ne.jp';

const kTSTAPI_REGISTER_LISTENER_ADDON   = `${kTST_ID}:register-listener-addon`;
const kTSTAPI_UNREGISTER_LISTENER_ADDON = `${kTST_ID}:unregister-listener-addon`;
const kTSTAPI_NOTIFY_TAB_CLICKED        = `${kTST_ID}:notify:tab-clicked`;
const kTSTAPI_IS_SUBTREE_COLLAPSED      = `${kTST_ID}:request:is-subtree-collapsed`;
const kTSTAPI_HAS_CHILD_TABS            = `${kTST_ID}:request:has-child-tabs`;
const kTSTAPI_GET_DESCENDANT_TABS       = `${kTST_ID}:request:get-descendant-tabs`;


function onMessageExternal(aMessage, aSender) {
  console.log('onMessageExternal: ', aMessage, aSender);
  switch (aMessage.type) {
    case kTSTAPI_NOTIFY_TAB_CLICKED: {
      if (aMessage.button != 0)
        return;
      if (aMessage.ctrlKey) {
        // toggle selection of the tab and all collapsed descendants
      }
      else if (aMessage.shiftKey) {
        // select the clicked tab and tabs between last activated tab
      }
    }; break;
  }
}

browser.runtime.onMessageExternal.addListener(onMessageExternal);

function registerSelf() {
  browser.runtime.sendMessage(kTST_ID, {
    type: kTSTAPI_REGISTER_LISTENER_ADDON
  });
}

browser.management.get(kTST_ID).then(registerSelf);
/*
browser.management.onInstalled(aAddon => {
  if (aAddon.id == kTST_ID)
    registerSelf();
});
browser.management.onEnabled(aAddon => {
  if (aAddon.id == kTST_ID)
    registerSelf();
});
*/

