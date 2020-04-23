/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  wait,
  notify,
  handleMissingReceiverError
} from './common.js';
import * as Constants from './constants.js';
import * as Permissions from './permissions.js';

export async function bookmarkTabs(ids, options = {}) {
  if (!(await Permissions.isGranted(Permissions.BOOKMARKS))) {
    notify({
      title:   browser.i18n.getMessage('notPermitted_bookmarks_title'),
      message: browser.i18n.getMessage('notPermitted_bookmarks_message'),
      url:     `moz-extension://${location.host}/options/options.html#permissionsSection`
    });
    return null;
  }

  const tabs = await Promise.all(ids.map(id => browser.tabs.get(id)));
  const folderParams = {
    title: browser.i18n.getMessage('bookmarkFolder_label', tabs[0].title)
  };
  if (options.parentId) {
    folderParams.parentId = options.parentId;
    if ('index' in options)
      folderParams.index = options.index;
  }
  const folder = await browser.bookmarks.create(folderParams);
  for (let i = 0, maxi = tabs.length; i < maxi; i++) {
    const tab = tabs[i];
    await browser.bookmarks.create({
      parentId: folder.id,
      index:    i,
      title:    tab.title,
      url:      tab.url
    });
  }

  browser.bookmarks.get(folder.parentId).then(folders => {
    notify({
      title:   browser.i18n.getMessage('bookmarkTabs_notification_title'),
      message: browser.i18n.getMessage('bookmarkTabs_notification_message', [
        tabs[0].title,
        tabs.length,
        folders[0].title
      ]),
      icon:    Constants.kNOTIFICATION_DEFAULT_ICON
    });
  });
  return folder;
}

export async function moveToWindow(ids, windowId) {
  const structure = (await browser.runtime.sendMessage(Constants.kTST_ID, {
    type: Constants.kTSTAPI_GET_TREE_STRUCTURE,
    tabs: ids
  }).catch(handleMissingReceiverError));
  log('structure ', structure);
  const firstTab = ids[0];
  let window;
  if (windowId) {
    window = await browser.windows.get(windowId);
  }
  else {
    window = await browser.windows.create({
      tabId: firstTab
    });
    ids = ids.slice(1);
  }
  if (structure)
    await browser.runtime.sendMessage(Constants.kTST_ID, {
      type:   Constants.kTSTAPI_BLOCK_GROUPING,
      window: window.id
    }).catch(handleMissingReceiverError);
  const waitUntilCompletelyMoved = new Promise((resolve, _reject) => {
    let restTabs = ids.length - 1;
    const listener = (_tabId, _attachInfo) => {
      restTabs--;
      if (restTabs <= 0) {
        browser.tabs.onAttached.removeListener(listener);
        resolve();
      }
    };
    browser.tabs.onAttached.addListener(listener);
  });
  await Promise.all([
    safeMoveApiTabsAcrossWindows(ids, {
      index:    1,
      windowId: window.id
    }),
    waitUntilCompletelyMoved
  ]);
  await browser.tabs.update(firstTab, { active: true });
  if (structure) {
    await wait(500); // wait until TST's initialization is finished
    await browser.runtime.sendMessage(Constants.kTST_ID, {
      type: Constants.kTSTAPI_SET_TREE_STRUCTURE,
      tabs: ids,
      structure
    }).catch(handleMissingReceiverError);
    await browser.runtime.sendMessage(Constants.kTST_ID, {
      type:   Constants.kTSTAPI_UNBLOCK_GROUPING,
      window: window.id
    }).catch(handleMissingReceiverError);
  }
}

// workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1394477
export async function safeMoveApiTabsAcrossWindows(aTabIds, moveOptions) {
  return (await Promise.all(aTabIds.map(async (aTabId, index) => {
    try {
      let movedTab = await browser.tabs.move(aTabId, {
        ...moveOptions,
        index: moveOptions.index + index
      });
      if (Array.isArray(movedTab))
        movedTab = movedTab[0];
      return movedTab;
    }
    catch(_e) {
      return null;
    }
  }))).filter(tab => !!tab);
}
