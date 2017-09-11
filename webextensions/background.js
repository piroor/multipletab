/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const kTST_ID = 'treestyletab@piro.sakura.ne.jp';
const kTSTAPI_REGISTER_SELF        = 'register-self';
const kTSTAPI_UNREGISTER_SELF      = 'unregister-self';
const kTSTAPI_NOTIFY_TAB_CLICKED   = 'tab-clicked';
const kTSTAPI_IS_SUBTREE_COLLAPSED = 'is-subtree-collapsed';
const kTSTAPI_HAS_CHILD_TABS       = 'has-child-tabs';
const kTSTAPI_GET_ACTIVE_TAB       = 'get-active-tab';
const kTSTAPI_GET_TABS             = 'get-tabs';
const kTSTAPI_GET_DESCENDANT_TABS  = 'get-descendant-tabs';
const kTSTAPI_GET_TAB_STATE        = 'get-tab-state';
const kTSTAPI_ADD_TAB_STATE        = 'add-tab-state';
const kTSTAPI_REMOVE_TAB_STATE     = 'remove-tab-state';

var gInSelectionSession = false;

function onMessageExternal(aMessage, aSender) {
  console.log('onMessageExternal: ', aMessage, aSender);
  switch (aMessage.type) {
    case kTSTAPI_NOTIFY_TAB_CLICKED: return (async () => {
      if (aMessage.button != 0)
        return false;

      if (!aMessage.ctrlKey && !aMessage.shiftKey) {
        // clear selection
        browser.runtime.sendMessage(kTST_ID, {
          type:  kTSTAPI_REMOVE_TAB_STATE,
          tabs:  '*',
          state: 'selected'
        });
        gInSelectionSession = false;
        return;
      }

      let activeTab = await browser.runtime.sendMessage(kTST_ID, {
        type: kTSTAPI_GET_ACTIVE_TAB
      });

      let tabIds = [aMessage.tab];
      if (aMessage.states.indexOf('subtree-collapsed') > -1) {
        let descendantIds = await browser.runtime.sendMessage(kTST_ID, {
          type: kTSTAPI_GET_DESCENDANT_TABS,
          tab:  aMessage.tab
        });
        tabIds = tabIds.concat(descendantIds);
      }

      if (aMessage.ctrlKey) {
        // toggle selection of the tab and all collapsed descendants
        if (aMessage.tab != activeTab.id &&
            activeTab.states.indexOf('selected') < 0 &&
            !gInSelectionSession) {
          browser.runtime.sendMessage(kTST_ID, {
            type:  kTSTAPI_ADD_TAB_STATE,
            tab:   activeTab.tab,
            state: 'selected'
          });
        }
        browser.runtime.sendMessage(kTST_ID, {
          type:  aMessage.states.indexOf('selected') < 0 ?
                   kTSTAPI_ADD_TAB_STATE :
                   kTSTAPI_REMOVE_TAB_STATE,
          tabs:  tabIds,
          state: 'selected'
        });
        gInSelectionSession = true;
        return true;
      }
      else if (aMessage.shiftKey) {
        // select the clicked tab and tabs between last activated tab
        browser.runtime.sendMessage(kTST_ID, {
          type:  kTSTAPI_REMOVE_TAB_STATE,
          tabs:  '*',
          state: 'selected'
        });
        let tabs = await browser.runtime.sendMessage(kTST_ID, {
          type:   kTSTAPI_GET_TABS,
          window: aMessage.window
        });
        let inSelection = false;
        let betweenTabIds = activeTab.id == aMessage.tab ?
                              [] :
                              tabs.ids.filter(aTabId => {
                                let isBoundary = aTabId == activeTab.id ||
                                                 aTabId == aMessage.tab;
                                if (isBoundary)
                                  inSelection = !inSelection;
                                return isBoundary || inSelection;
                              });
        browser.runtime.sendMessage(kTST_ID, {
          type:  kTSTAPI_ADD_TAB_STATE,
          tabs:  betweenTabIds.concat(tabIds),
          state: 'selected'
        });
        gInSelectionSession = true;
        return true;
      }
      return false;
    })();
  }
}

browser.runtime.onMessageExternal.addListener(onMessageExternal);


function registerToTST() {
  browser.runtime.sendMessage(kTST_ID, {
    type:  kTSTAPI_REGISTER_SELF,
    style: `
      .tab.selected::after,
      .tab.ready-to-close .closebox::after {
        content: " ";
        display: block;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: Highlight;
        opacity: 0.5;
        pointer-events: none;
        z-index: 10;
      }
    `
  });
}

function wait(aTimeout) {
  return new Promise((aResolve, aReject) => {
    setTimeout(aResolve, aTimeout || 0);
  });
}

async function tryRegisterToTST() {
  // retry until TST is initialized
  var start = Date.now();
  do {
    try {
      let TST = await browser.management.get(kTST_ID);
      let success = await registerToTST();
      if (success)
        return;
    }
    catch(e) { // not installed or not enabled
    }
    await wait(500);
  } while (Date.now() - start < 10 * 1000);
}

tryRegisterToTST();
