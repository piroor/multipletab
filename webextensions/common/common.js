/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var configs;
var gLogContext = '?';

function log(aMessage, ...aArgs)
{
  if (!configs || !configs.debug)
    return;

  var nest = (new Error()).stack.split('\n').length;
  var indent = '';
  for (let i = 0; i < nest; i++) {
    indent += ' ';
  }
  console.log(`mth<${gLogContext}>: ${indent}${aMessage}`, ...aArgs);
}

async function wait(aTask = 0, aTimeout = 0) {
  if (typeof aTask != 'function') {
    aTimeout = aTask;
    aTask = null;
  }
  return new Promise((aResolve, aReject) => {
    setTimeout(async () => {
      if (aTask)
        await aTask();
      aResolve();
    }, aTimeout);
  });
}

async function notify(aParams = {}) {
  var id = await browser.notifications.create({
    type:    'basic',
    iconUrl: aParams.icon,
    title:   aParams.title,
    message: aParams.message
  });

  var timeout = aParams.timeout;
  if (typeof timeout != 'number')
    timeout = configs.notificationTimeout;
  if (timeout >= 0)
    await wait(timeout);

  await browser.notifications.clear(id);
}

var defaultClipboardFormats = [];
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_url_label'),
  format: '%URL%'
});
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_title_and_url_label'),
  format: '%TITLE%%EOL%%URL%'
});
/*
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_title_and_url_tree_label'),
  format: '%TST_INDENT(|   )(|---)%%TITLE%%EOL%%TST_INDENT(|   )%%URL%'
});
*/
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_html_link_label'),
  format: '<a title="%TITLE_HTML%" href="%URL_HTML%">%TITLE_HTML%</a>'
});
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_markdown_label'),
  format: '[%TITLE%](%URL% "%TITLE%")'
});
defaultClipboardFormats.push({
  label:  browser.i18n.getMessage('context_clipboard_markdown_list_label'),
  format: '%TST_INDENT(  )%* [%TITLE%](%URL% "%TITLE%")'
});

configs = new Configs({
  context_reloadTabs: true,
  context_bookmarkTabs: true,
  context_removeBookmarkFromTabs: false,
  context_duplicateTabs: true,
  context_pinTabs: true,
  context_unpinTabs: true,
  context_muteTabs: true,
  context_unmuteTabs: true,
  context_moveToNewWindow: true,
  context_moveToOtherWindow: true,
  context_removeTabs: true,
  context_removeOther: true,
  context_clipboard: true,
  context_saveTabs: true,
  context_printTabs: false,
  context_freezeTabs: false,
  context_unfreezeTabs: false,
  context_protectTabs: false,
  context_unprotectTabs: false,
  context_lockTabs: false,
  context_unlockTabs: false,
  context_groupTabs: false,
  context_suspendTabs: true,
  context_resumeTabs: true,
  context_selectAll: true,
  context_select: true,
  context_unselect: true,
  context_invertSelection: true,

  autoOpenMenuOnDragEnd: true,
  copyToClipboardFormats: defaultClipboardFormats,
  useCRLF: false,
  useWorkaroundForBug1272869: true,

  saveTabsPrefix: browser.i18n.getMessage('saveTabsPrefix_defaultValue'),

  disablePanelWhenAlternativeTabBarIsAvailable: true,

  cachedExternalAddons: {},

  requestingPermissions: null,

  shouldNotifyUpdatedFromLegacyVersion: false,
  debug: false
}, {
  localKeys: `
    useCRLF
    useWorkaroundForBug1272869
    cachedExternalAddons
    requestingPermissions
    shouldNotifyUpdatedFromLegacyVersion
    debug
  `.trim().split('\n').map(aKey => aKey.trim()).filter(aKey => aKey && aKey.indexOf('//') != 0)
});
