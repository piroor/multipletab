/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  configs
} from '/common/common.js';
import * as Permissions from '/common/permissions.js';
import Options from '/extlib/Options.js';
import ShortcutCustomizeUI from '/extlib/ShortcutCustomizeUI.js';
import '../extlib/l10n.js';

log.context = 'Options';
const options = new Options(configs);

function onConfigChanged(key) {
  switch (key) {
    case 'debug':
      if (configs.debug)
        document.documentElement.classList.add('debugging');
      else
        document.documentElement.classList.remove('debugging');
      break;
  }
}

configs.$addObserver(onConfigChanged);
window.addEventListener('DOMContentLoaded', () => {
  // remove accesskey mark
  for (const label of Array.slice(document.querySelectorAll('#menu-items label, #bookmarksPermissionCheck'))) {
    label.lastChild.nodeValue = label.lastChild.nodeValue.replace(/\(&[a-z]\)|&([a-z])/i, '$1');
  }

  ShortcutCustomizeUI.build().then(aUI => {
    document.getElementById('shortcuts').appendChild(aUI);
  });

  configs.$loaded.then(() => {
    Permissions.bindToCheckbox(
      Permissions.BOOKMARKS,
      document.querySelector('#bookmarksPermissionGranted')
    );

    options.buildUIForAllConfigs(document.querySelector('#debug-configs'));
    onConfigChanged('debug');
    initCollapsibleSections();
  });
}, { once: true });


function initCollapsibleSections() {
  for (const heading of Array.slice(document.querySelectorAll('body > section > h1'))) {
    const section = heading.parentNode;
    section.style.maxHeight = `${heading.offsetHeight}px`;
    if (configs.optionsExpandedSections.indexOf(section.id) < 0)
      section.classList.add('collapsed');
    heading.addEventListener('click', () => {
      section.classList.toggle('collapsed');
      const otherExpandedSections = configs.optionsExpandedSections.filter(id => id != section.id);
      if (section.classList.contains('collapsed'))
        configs.optionsExpandedSections = otherExpandedSections;
      else
        configs.optionsExpandedSections = otherExpandedSections.concat([section.id]);
    });
  }
}
