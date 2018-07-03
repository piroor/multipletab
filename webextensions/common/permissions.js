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

export function isGranted(aPermissions) {
  return browser.permissions.contains(aPermissions);
}

export function bindToCheckbox(aPermissions, aCheckbox, aOptions = {}) {
  isGranted(aPermissions).then(aGranted => {
    aCheckbox.checked = aGranted;
  });
  aCheckbox.addEventListener('change', _event => {
    aCheckbox.requestPermissions()
  });

  browser.runtime.onMessage.addListener((aMessage, _sender) => {
    if (!aMessage ||
          !aMessage.type ||
          aMessage.type != Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED ||
          JSON.stringify(aMessage.permissions) != JSON.stringify(aPermissions))
      return;
    if (aOptions.onChanged)
      aOptions.onChanged(true);
    aCheckbox.checked = true;
  });

  /*
    // These events are not available yet on Firefox...
    browser.permissions.onAdded.addListener(aAddedPermissions => {
      if (aAddedPermissions.permissions.indexOf('...') > -1)
        aCheckbox.checked = true;
    });
    browser.permissions.onRemoved.addListener(aRemovedPermissions => {
      if (aRemovedPermissions.permissions.indexOf('...') > -1)
        aCheckbox.checked = false;
    });
    */

  aCheckbox.requestPermissions = async () => {
    try {
      if (!aCheckbox.checked) {
        await browser.permissions.remove(aPermissions);
        if (aOptions.onChanged)
          aOptions.onChanged(false);
        return;
      }

      const granted = await isGranted(aPermissions);
      if (granted) {
        aOptions.onChanged(true);
        return;
      }

      configs.requestingPermissions = aPermissions;
      aCheckbox.checked = false;
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
        if (!await browser.permissions.request(aPermissions)) {
          aCheckbox.checked = false;
          return;
        }
        */
    }
    catch(aError) {
      console.log(aError);
    }
    aCheckbox.checked = false;
  };
}

export function requestPostProcess() {
  if (!configs.requestingPermissions)
    return false;

  const permissions = configs.requestingPermissions;
  configs.requestingPermissions = null;
  browser.browserAction.setBadgeText({ text: '' });
  browser.permissions.request(permissions).then(aGranted => {
    log('permission requested: ', permissions, aGranted);
    if (aGranted)
      browser.runtime.sendMessage({
        type:        Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED,
        permissions: permissions
      });
  });
  return true;
}
