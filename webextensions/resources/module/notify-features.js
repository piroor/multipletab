/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const type = /(legacy|installed|updated)/i.test(location.search) && String(RegExp.$1).toLowerCase();

  const title = `${browser.i18n.getMessage('extensionName')} ${browser.runtime.getManifest().version}`;
  const description = browser.i18n.getMessage(
    type == 'legacy' ?
      'message_updatedFromLegacy_description' :
      'message_newFeatures_description'
  );

  document.querySelector('#title').textContent = document.title = title;
  document.querySelector('#description').innerHTML = description;
}, { once: true });
