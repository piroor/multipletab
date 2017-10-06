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
  gFormatRows.addEventListener('input', onFormatInput);
  addButtonCommandListener(
    gFormatRows,
    (aEvent) => { onRowControlButtonClick(aEvent); }
  );
  addButtonCommandListener(
    document.querySelector('#copyToClipboardFormatsAddNewRow'),
    (aEvent) => { addFormatRow(); }
  );

  configs.$loaded.then(() => {
    options.buildUIForAllConfigs(document.querySelector('#debug-configs'));
    onConfigChanged('debug');
    rebuildFormatRows();
  });
}, { once: true });


function getButtonFromEvent(aEvent) {
  var target = aEvent.target;
  if (target.nodeType != Node.ELEMENT_NODE)
    target = target.parentNode;
  return target.localName == 'button' && target;
}

function addButtonCommandListener(aButton, aOnCommand) {
  aButton.addEventListener('click', (aEvent) => {
    if (!getButtonFromEvent(aEvent))
      return;
    aOnCommand(aEvent);
  });
  aButton.addEventListener('keypress', (aEvent) => {
    if (!getButtonFromEvent(aEvent))
      return;
    if (aEvent.keyCode == aEvent.DOM_VK_ENTER ||
        aEvent.keyCode == aEvent.DOM_VK_RETURN)
      aOnCommand(aEvent);
  });
}

function getInputFieldFromEvent(aEvent) {
  var target = aEvent.target;
  if (target.nodeType != Node.ELEMENT_NODE)
    target = target.parentNode;
  return target.localName == 'input' && target;
}

function onFormatInput(aEvent) {
  var field = getInputFieldFromEvent(aEvent);
  if (!field)
    return;
  if (field.throttleInputTimer)
    clearTimeout(field.throttleInputTimer);
  field.throttleInputTimer = setTimeout(() => {
    delete field.throttleInputTimer;
    var row = field.parentNode.parentNode;
    var formats = configs.copyToClipboardFormats;
    var item = formats[row.itemIndex];
    if (field.classList.contains('label'))
      item.label = field.value;
    else if (field.classList.contains('format'))
      item.format = field.value;
    else
      return;
    configs.copyToClipboardFormats = formats;
  }, 250);
}


var gFormatRows;

function rebuildFormatRows() {
  var range = document.createRange();
  range.selectNodeContents(gFormatRows);
  range.deleteContents();

  var rows = document.createDocumentFragment();
  if (!Array.isArray(configs.copyToClipboardFormats)) { // migrate to array
    var items = [];
    for (let label of Object.keys(configs.copyToClipboardFormats)) {
      items.push({
        label:  label,
        format: configs.copyToClipboardFormats[label]
      });
    }
    configs.copyToClipboardFormats = items;
  }
  configs.copyToClipboardFormats.forEach((aItem, aIndex) => {
    rows.appendChild(createFormatRow({
      index:  aIndex,
      label:  aItem.label,
      format: aItem.format
    }));
  });
  range.insertNode(rows);

  range.detach();
}

function addFormatRow() {
  var formats = configs.copyToClipboardFormats;
  var row = gFormatRows.appendChild(createFormatRow({
    index: formats.length
  }));
  formats.push({ label: '', format: '' });
  configs.copyToClipboardFormats = formats;
}

function createFormatRow(aParams = {}) {
  var row = document.createElement('tr');
  row.itemIndex= aParams.index;

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

function onRowControlButtonClick(aEvent) {
  var button = getButtonFromEvent(aEvent);
  var row = button.parentNode.parentNode;
  var formats = configs.copyToClipboardFormats;
  var item = formats[row.itemIndex];
  if (button.classList.contains('remove')) {
    formats.splice(row.itemIndex, 1);
    configs.copyToClipboardFormats = formats;
    row.parentNode.removeChild(row);
  }
  else if( button.classList.contains('up')) {
    if (row.itemIndex > 0) {
      formats.splice(row.itemIndex, 1);
      formats.splice(row.itemIndex - 1, 0, item);
      configs.copyToClipboardFormats = formats;
      row.parentNode.insertBefore(row, row.previousSibling);
    }
  }
  else if( button.classList.contains('down')) {
    if (row.itemIndex < formats.length - 1) {
      formats.splice(row.itemIndex, 1);
      formats.splice(row.itemIndex + 1, 0, item);
      configs.copyToClipboardFormats = formats;
      row.parentNode.insertBefore(row, row.nextSibling.nextSibling);
    }
  }
  Array.slice(row.parentNode.childNodes).forEach((aRow, aIndex) => {
    aRow.itemIndex = aIndex;
  });
}

