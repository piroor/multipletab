/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'Options';
var options = new Options(configs);

function onConfigChanged(aKey) {
  switch (aKey) {
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
  gFormatRows = document.querySelector('#copyToClipboardFormatsRows');
  configs.$loaded.then(() => {
    options.buildUIForAllConfigs(document.querySelector('#debug-configs'));
    onConfigChanged('debug');
    rebuildFormatRows();
  });
}, { once: true });


var gFormatRows;

function rebuildFormatRows() {
  var range = document.createRange();
  range.selectNodeContents(gFormatRows);
  range.deleteContents();

  var rows = document.createDocumentFragment();
  if (Array.isArray(configs.copyToClipboardFormats)) {
    configs.copyToClipboardFormats.forEach((aItem, aIndex) => {
      rows.appendChild(createFormatRow(aItem));
    });
  }
  else {
    for (let label of Object.keys(configs.copyToClipboardFormats)) {
      rows.appendChild(createFormatRow({
        label:  label,
        format: configs.copyToClipboardFormats[label]
      }));
    }
  }
  range.insertNode(rows);

  range.detach();
}

function createFormatRow(aParams = {}) {
  var row = document.createElement('tr');

  var labelColumn = row.appendChild(document.createElement('td'));
  var labelField = labelColumn.appendChild(document.createElement('input'));
  labelField.classList.add('label');
  labelField.setAttribute('type', 'text');
  labelField.setAttribute('size', 10);
  if (aParams.label)
    labelField.value = aParams.label;

  var formatColumn = row.appendChild(document.createElement('td'));
  var formatField = formatColumn.appendChild(document.createElement('input'));
  labelField.classList.add('format');
  formatField.setAttribute('type', 'text');
  formatField.setAttribute('size', 20);
  if (aParams.format)
    formatField.value = aParams.format;

  var upColumn = row.appendChild(document.createElement('td'));
  var upButton = upColumn.appendChild(document.createElement('button'));
  upButton.classList.add('up');
  upButton.setAttribute('title', browser.i18n.getMessage('config.copyToClipboardFormats.up'));
  upButton.appendChild(document.createTextNode('▲'));

  var downColumn = row.appendChild(document.createElement('td'));
  var downButton = downColumn.appendChild(document.createElement('button'));
  downButton.classList.add('down');
  downButton.setAttribute('title', browser.i18n.getMessage('config.copyToClipboardFormats.down'));
  downButton.appendChild(document.createTextNode('▼'));

  var removeColumn = row.appendChild(document.createElement('td'));
  var removeButton = removeColumn.appendChild(document.createElement('button'));
  removeButton.classList.add('remove');
  removeButton.setAttribute('title', browser.i18n.getMessage('config.copyToClipboardFormats.remove'));
  removeButton.appendChild(document.createTextNode('✖'));

  return row;
}

