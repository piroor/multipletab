/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const kID = 'multipletab@piro.sakura.ne.jp';
const kTST_ID = 'treestyletab@piro.sakura.ne.jp';

const kCOMMAND_TST_REGISTER_LISTENER_ADDON   = `${kTST_ID}:register-listener-addon`;
const kCOMMAND_TST_UNREGISTER_LISTENER_ADDON = `${kTST_ID}:unregister-listener-addon`;
const kCOMMAND_TST_TAB_CLICKED               = `${kTST_ID}:notify:tab-clicked`;
const kCOMMAND_TST_IS_SUBTREE_COLLAPSED      = `${kTST_ID}:request:is-subtree-collapsed`;
const kCOMMAND_TST_HAS_CHILD_TABS            = `${kTST_ID}:request:has-child-tabs`;
const kCOMMAND_TST_GET_DESCENDANT_TABS       = `${kTST_ID}:request:get-descendant-tabs`;

browser.runtime.sendMessage(kTST_ID, {
  type: kCOMMAND_TST_REGISTER_LISTENER_ADDON
});

function onMessageExternal(aMessage, aSender) {
  console.log('onMessageExternal: ', aMessage, aSender);
  switch (aMessage.type) {
    case kCOMMAND_TST_TAB_CLICKED: {
    }; break;
  }
}

browser.runtime.onMessageExternal.addListener(onMessageExternal);

