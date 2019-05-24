/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const EXPORTABLE_TAB_PROPERTIES = [
  // basic tabs.Tab properties
  'active',
  'attention',
  'audible',
  'autoDiscardable',
  'discarded',
  'height',
  'hidden',
  'highlighted',
  'id',
  'incognito',
  'index',
  'isArticle',
  'isInReaderMode',
  'lastAccessed',
  'mutedInfo',
  'openerTabId',
  'pinned',
  'selected',
  'sessionId',
  'sharingState',
  'status',
  'successorId',
  'width',
  'windowId'
];

export function sanitize(tabOrTabs) {
  if (Array.isArray(tabOrTabs)) {
    const tabs = [];
    for (const tab of tabOrTabs) {
      const sanitized = sanitizeTab(tab);
      if (sanitized)
        tabs.push(sanitized);
    }
    return tabs;
  }
  return sanitizeTab(tabOrTabs);
}

function sanitizeTab(tab) {
  if (!tab ||
      tab.incognito)
    return null;
  const sanitizedTab = {};
  for (const key of EXPORTABLE_TAB_PROPERTIES) {
    if (key in tab)
      sanitizedTab[key] = tab[key];
  }
  return sanitizedTab;
}
