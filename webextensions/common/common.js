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
  ignoreHidden: true,

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

export function shouldIgnoreHidden(givenValue) {
  return givenValue !== undefined ? givenValue : configs.ignoreHidden;
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

export async function notify(params = {}) {
  const id = await browser.notifications.create({
    type:    'basic',
    iconUrl: params.icon,
    title:   params.title,
    message: params.message
  });

  let onClicked;
  if (params.url) {
    onClicked = notificationId => {
      if (notificationId != id)
        return;
      browser.tabs.create({
        url: params.url
      });
      browser.notifications.onClicked.removeListener(onClicked);
      onClicked = null;
    };
    browser.notifications.onClicked.addListener(onClicked);
  }

  let timeout = params.timeout;
  if (typeof timeout != 'number')
    timeout = configs.notificationTimeout;
  if (timeout >= 0)
    await wait(timeout);

  if (onClicked) {
    browser.notifications.onClicked.removeListener(onClicked);
    onClicked = null;
  }

  await browser.notifications.clear(id);
}

export function handleMissingReceiverError(error) {
  if (!error ||
      !error.message ||
      error.message.indexOf('Could not establish connection. Receiving end does not exist.') == -1)
    throw error;
  // otherwise, this error is caused from missing receiver.
  // we just ignore it.
}
