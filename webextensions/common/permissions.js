/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  notify,
  configs
} from './common.js';
import * as Constants from './constants.js';

export const ALL_URLS        = { origins: ['<all_urls>'] };
export const BOOKMARKS       = { permissions: ['bookmarks'] };
export const CLIPBOARD_WRITE = { permissions: ['clipboardWrite'], origins: ['<all_urls>'] };

export function clearRequest() {
  configs.requestingPermissions = null;
}

export function isGranted(permissions) {
  return browser.permissions.contains(permissions);
}

export function bindToCheckbox(permissions, checkbox, options = {}) {
  isGranted(permissions).then(granted => {
    checkbox.checked = granted;
  });
  checkbox.addEventListener('change', _event => {
    checkbox.requestPermissions()
  });

  browser.runtime.onMessage.addListener((message, _sender) => {
    if (!message ||
          !message.type ||
          message.type != Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED ||
          JSON.stringify(message.permissions) != JSON.stringify(permissions))
      return;
    if (options.onChanged)
      options.onChanged(true);
    checkbox.checked = true;
  });

  /*
    // These events are not available yet on Firefox...
    browser.permissions.onAdded.addListener(addedPermissions => {
      if (addedPermissions.permissions.indexOf('...') > -1)
        checkbox.checked = true;
    });
    browser.permissions.onRemoved.addListener(removedPermissions => {
      if (removedPermissions.permissions.indexOf('...') > -1)
        checkbox.checked = false;
    });
    */

  checkbox.requestPermissions = async () => {
    try {
      if (!checkbox.checked) {
        await browser.permissions.remove(permissions);
        if (options.onChanged)
          options.onChanged(false);
        return;
      }

      const granted = await isGranted(permissions);
      if (granted) {
        options.onChanged(true);
        return;
      }

      configs.requestingPermissions = permissions;
      checkbox.checked = false;
      browser.browserAction.setBadgeText({ text: '!' });
      browser.browserAction.setPopup({ popup: '' });

      notify({
        title:   browser.i18n.getMessage('config_permissions_fallbackToToolbarButton_title'),
        message: browser.i18n.getMessage('config_permissions_fallbackToToolbarButton_message'),
        icon:    '/resources/24x24-light.svg'
      });
      return;

      /*
        // following codes don't work as expected due to https://bugzilla.mozilla.org/show_bug.cgi?id=1382953
        if (!await browser.permissions.request(permissions)) {
          checkbox.checked = false;
          return;
        }
        */
    }
    catch(error) {
      console.log(error);
    }
    checkbox.checked = false;
  };
}

export function requestPostProcess() {
  if (!configs.requestingPermissions)
    return false;

  const permissions = configs.requestingPermissions;
  configs.requestingPermissions = null;
  browser.browserAction.setBadgeText({ text: '' });
  browser.permissions.request(permissions).then(granted => {
    log('permission requested: ', permissions, granted);
    if (granted)
      browser.runtime.sendMessage({
        type:        Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED,
        permissions: permissions
      });
  });
  return true;
}

export function isPermittedTab(tab) {
  if (tab.discarded)
    return false;
  return /^about:blank($|\?|#)/.test(tab.url) ||
         !/^(about|resource|chrome|file|view-source):/.test(tab.url);
}
