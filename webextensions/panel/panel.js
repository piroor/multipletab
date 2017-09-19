/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'Panel';

window.addEventListener('DOMContentLoaded', async () => {
  await configs.$loaded;

  browser.tabs.onActivated.addListener(() => clearSelection());
  browser.tabs.onCreated.addListener(() => clearSelection());
  browser.tabs.onRemoved.addListener(() => clearSelection());

  await rebuildTabItems();
}, { once: true });

async function rebuildTabItems() {
  var tabbar = document.querySelector('#tabs');
  var range = document.createRange();
  range.selectNodeContents(tabbar);
  range.deleteContents();
  var fragment = document.createDocumentFragment();
  var tabs = await browser.tabs.query({ currentWindow: true });
  for (let tab of tabs) {
    let tabItem = buildTabItem(tab);
    fragment.appendChild(tabItem);
  }
  range.insertNode(fragment);
  range.detach();
}

function buildTabItem(aTab) {
  var label = document.createElement('label');
  var checkbox = document.createElement('input');
  checkbox.setAttribute('type', 'checkbox');
  label.appendChild(checkbox);
  label.appendChild(document.createTextNode(aTab.title));
  var item = document.createElement('li');
  item.appendChild(label);
  return item;
}
