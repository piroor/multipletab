/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import Configs from '/extlib/Configs.js';

export const configs = new Configs({
  optionsExpandedSections: ['section-general'],

  context_invertSelection: true,

  autoOpenMenuOnDragEnd: true,
  theme: 'default',
  useCRLF: false,
  useWorkaroundForBug1272869: true,
  includeHidden: false,

  panelMinWidth: '25em',
  panelMaxWidth: '30em',
  panelMinHeight: '20em',
  panelMaxHeight: '25em',
  panelFontSize: 'medium',

  disablePanelWhenAlternativeTabBarIsAvailable: true,

  cachedExternalAddons: {},

  enableDragSelection: true,
  enableDragSelectionByLongPress: true,
  longPressDuration: 400,

  notificationTimeout: 10 * 1000,

  requestingPermissions: null,
  requestingPermissionsNatively: null,

  applyThemeColorToIcon: false,

  notifiedFeaturesVersion: 0,
  shouldNotifyUpdatedFromLegacyVersion: false,
  debug: false
}, {
  localKeys: `
    optionsExpandedSections
    theme
    useCRLF
    useWorkaroundForBug1272869
    cachedExternalAddons
    requestingPermissions
    requestingPermissionsNatively
    notifiedFeaturesVersion
    shouldNotifyUpdatedFromLegacyVersion
    debug
  `.trim().split('\n').map(key => key.trim()).filter(key => key && key.indexOf('//') != 0)
});

export function shouldIncludeHidden(givenValue) {
  return givenValue !== undefined ? givenValue : configs.includeHidden;
}


export function log(message, ...args)
{
  if (!configs || !configs.debug)
    return;

  const nest = (new Error()).stack.split('\n').length;
  let indent = '';
  for (let i = 0; i < nest; i++) {
    indent += ' ';
  }
  console.log(`mth<${log.context}>: ${indent}${message}`, ...args);
}
log.context = '?';

export async function wait(task = 0, timeout = 0) {
  if (typeof task != 'function') {
    timeout = task;
    task = null;
  }
  return new Promise((resolve, _reject) => {
    setTimeout(async () => {
      if (task)
        await task();
      resolve();
    }, timeout);
  });
}


export async function notify({ icon, title, message, timeout, url } = {}) {
  const id = await browser.notifications.create({
    type:    'basic',
    iconUrl: icon || browser.extension.getURL(`resources/64x64.svg`),
    title,
    message
  });

  let onClicked;
  let onClosed;
  return new Promise(async (resolve, _reject) => {
    let resolved = false;

    onClicked = notificationId => {
      if (notificationId != id)
        return;
      if (url) {
        browser.tabs.create({
          url
        });
      }
      resolved = true;
      resolve(true);
    };
    browser.notifications.onClicked.addListener(onClicked);

    onClosed = notificationId => {
      if (notificationId != id)
        return;
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    };
    browser.notifications.onClosed.addListener(onClosed);

    if (typeof timeout != 'number')
      timeout = configs.notificationTimeout;
    if (timeout >= 0) {
      await wait(timeout);
    }
    await browser.notifications.clear(id);
    if (!resolved)
      resolve(false);
  }).then(clicked => {
    browser.notifications.onClicked.removeListener(onClicked);
    onClicked = null;
    browser.notifications.onClosed.removeListener(onClosed);
    onClosed = null;
    return clicked;
  });
}

export function handleMissingReceiverError(error) {
  if (!error ||
      !error.message ||
      error.message.indexOf('Could not establish connection. Receiving end does not exist.') == -1)
    throw error;
  // otherwise, this error is caused from missing receiver.
  // we just ignore it.
}
