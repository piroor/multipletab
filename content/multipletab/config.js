Components.utils.import('resource://gre/modules/Services.jsm');

var gAutoPopupItems = [];
var gDelayItems = [];
var gDragModeRadio;

function init()
{
	var { AddonManager } = Components.utils.import('resource://gre/modules/AddonManager.jsm', {});

	const MENU_EDITOR_ID = '{EDA7B1D7-F793-4e03-B074-E6F303317FB0}';
	const TAB_MIX_PLUS_ID = '{dc572301-7619-498c-a57d-39143191b318}';
	const TAB_UTILITIES_ID = 'tabutils@ithinc.cn';
	const SUPER_TAB_MODE_ID = '{752a85d4-68d6-48ae-ab7d-6640f5f75d85}';
	const PRINT_ALL_TABS_ID = 'printalltabs@peculier.com';

	AddonManager.getAddonsByIDs([
		MENU_EDITOR_ID,
		TAB_MIX_PLUS_ID,
		TAB_UTILITIES_ID,
		SUPER_TAB_MODE_ID,
		PRINT_ALL_TABS_ID
	], function(aAddons) {
		var menuEditor = aAddons[0];
		var tabMixPlus = aAddons[1];
		var tabUtilities = aAddons[2];
		var superTabMode = aAddons[3];
		var printAllTabs = aAddons[4];

		[
			'menuEditorLink-selection',
			'menuEditorLink-context'
		].forEach(function(aItem) {
			aItem = document.getElementById(aItem);
			aItem.setAttribute('collapsed', true);
			if (!menuEditor)
				aItem.removeAttribute('collapsed');
		});

		[
			'menuEditorConfig-selection',
			'menuEditorConfig-context'
		].forEach(function(aItem) {
			aItem = document.getElementById(aItem);
			aItem.setAttribute('collapsed', true);
			aItem.setAttribute('disabled', true);
			if (menuEditor) {
				aItem.removeAttribute('collapsed');
				if (menuEditor.isActive)
					aItem.removeAttribute('disabled');
			}
		});

		{
			let printAllTabsCheck = document.getElementById('extensions.multipletab.show.multipletab-selection-printTabs-check');
			if (printAllTabs)
				printAllTabsCheck.removeAttribute('disabled');
			else
				printAllTabsCheck.setAttribute('disabled', true);
		}

		{
			let protectItems = [
					'extensions.multipletab.show.multipletab-selection-freezeTabs-check',
					'extensions.multipletab.show.multipletab-selection-protectTabs-check'
				].map(document.getElementById, document);
			if (tabMixPlus || tabUtilities)
				protectItems.forEach((aItem) => aItem.removeAttribute('disabled'));
			else
				protectItems.forEach((aItem) => aItem.setAttribute('disabled', true));
		}

		{
			let lockItem = document.getElementById('extensions.multipletab.show.multipletab-selection-lockTabs-check');
			if (tabMixPlus || tabUtilities || superTabMode)
				lockItem.removeAttribute('disabled');
			else
				lockItem.setAttribute('disabled', true);
		}
	});

	new window['piro.sakura.ne.jp'].arrowScrollBoxScrollHelper('formatTypeBox', 'radio');
	new window['piro.sakura.ne.jp'].arrowScrollBoxScrollHelper('selectionMenuItemsBox', 'checkbox');
	new window['piro.sakura.ne.jp'].arrowScrollBoxScrollHelper('contextMenuItemsBox', 'checkbox');

//	sizeToContent();
}

function initGeneralPane()
{
	gDragModeRadio = document.getElementById('extensions.multipletab.tabdrag.mode-radiogroup');

	gDelayItems.push(document.getElementById('extensions.multipletab.tabdrag.delay-textbox'));
	gDelayItems.push(gDelayItems[0].previousSibling);
	gDelayItems.push(gDelayItems[0].nextSibling);

	gAutoPopupItems.push(document.getElementById('extensions.multipletab.tabdrag.autopopup-check'));
	gAutoPopupItems.push(document.getElementById('extensions.multipletab.tabdrag.autoclear-check'));

	onDragModeChange();
}

function onDragModeChange()
{
	for (let i = 0, maxi = gDelayItems.length; i < maxi; i++)
	{
		let item = gDelayItems[i];
		if (gDragModeRadio.value == 0)
			item.setAttribute('disabled', true);
		else
			item.removeAttribute('disabled');
	}
	for (let i = 0, maxi = gAutoPopupItems.length; i < maxi; i++)
	{
		let item = gAutoPopupItems[i];
		if (gDragModeRadio.value == 1)
			item.removeAttribute('disabled');
		else
			item.setAttribute('disabled', true);
	}
}



const kROW_ID_PREFIX = 'format-';

var gFormatsPref;
var gFormatsBox;
var gFormatsRadio;
var gFormatTemplate;
var gAddFormatButton;
var gUndoRemoveFormatButton;
var gFormatsUndoCache = [];

function initClipboardPane()
{
	gFormatsPref     = document.getElementById('extensions.multipletab.clipboard.formats');
	gFormatsBox      = document.getElementById('formats-box');
	gFormatsRadio    = document.getElementById('extensions.multipletab.clipboard.formatType-radiogroup');
	gFormatTemplate  = document.getElementById('format-template');
	gAddFormatButton = document.getElementById('formats-add');
	gUndoRemoveFormatButton = document.getElementById('formats-undo');

	initCustomFormats();
	gFormatsRadio.value = document.getElementById('extensions.multipletab.clipboard.formatType').value;
}

function getRowById(aID)
{
	return document.getElementById(kROW_ID_PREFIX+aID);
}
function getRadioFromRow(aRow)
{
	return aRow.getElementsByTagName('radio')[0];
}
function getLabelFieldFromRow(aRow)
{
	return aRow.getElementsByTagName('textbox')[0];
}
function getFormatFieldFromRow(aRow)
{
	return aRow.getElementsByTagName('textbox')[1];
}

function removeFormat(aRow)
{
	var id           = getRadioFromRow(aRow).getAttribute('value');
	var selected     = parseInt(gFormatsRadio.value);
	var selectedItem = gFormatsRadio.selectedItem;

	var cache = {
			id     : id,
			label  : getLabelFieldFromRow(aRow).value,
			format : getFormatFieldFromRow(aRow).value
		};
	if (cache.label || cache.format) {
		gFormatsUndoCache.push(cache);
		gUndoRemoveFormatButton.removeAttribute('disabled');
	}

	var nextRow = aRow.nextSibling;
	while (nextRow)
	{
		let radio = getRadioFromRow(nextRow);
		let id = radio.getAttribute('value');
		id = parseInt(id)-1;
		radio.setAttribute('value', id);
		nextRow.setAttribute('id', kROW_ID_PREFIX+id);
		nextRow = nextRow.nextSibling;
	}
	gFormatsBox.removeChild(aRow);

	if (selected == id) {
		gFormatsRadio.value = -1;
		cache.selected = true;
	}
	else if (selected >= 1000) {
		gFormatsRadio.selectedItem = selectedItem;
	}

	updateCustomFormats();
}

function undoRemoveFormat()
{
	if (!gFormatsUndoCache.length) return;

	var cache = gFormatsUndoCache.pop();
	var newRow = addNewFormat(cache.label, cache.format);

	var row = getRowById(cache.id);
	if (row && row != newRow) {
		(function(aRow) {
			let nextRow = aRow.nextSibling;
			if (!nextRow) return;

			arguments.callee(nextRow);

			getLabelFieldFromRow(nextRow).value = getLabelFieldFromRow(aRow).value;
			getFormatFieldFromRow(nextRow).value = getFormatFieldFromRow(aRow).value;

			if (!cache.selected) {
				let radio = getRadioFromRow(aRow);
				if (radio == gFormatsRadio.selectedItem)
					gFormatsRadio.selectedItem = getRadioFromRow(nextRow);
			}
		})(row);
		getLabelFieldFromRow(row).value = cache.label;
		getFormatFieldFromRow(row).value = cache.format;
		if (cache.selected)
			gFormatsRadio.selectedItem = getRadioFromRow(row);
	}

	updateCustomFormats();

	if (!gFormatsUndoCache.length)
		gUndoRemoveFormatButton.setAttribute('disabled', true);
}

function addNewFormat(aLabel, aFormat)
{
	var id = parseInt(getRadioFromRow(gFormatsBox.lastChild).getAttribute('value')) + 1;

	var newRow = gFormatTemplate.cloneNode(true);
	getRadioFromRow(newRow).setAttribute('value', id);
	newRow.setAttribute('id', kROW_ID_PREFIX+id);

	gFormatsBox.appendChild(newRow);

	var radio = getRadioFromRow(newRow);

	if (aLabel) {
		getLabelFieldFromRow(newRow).value = aLabel;
	}
	if (aFormat) {
		getFormatFieldFromRow(newRow).value = aFormat;
		onFormatInput(newRow);
	}

	if (!aLabel && !aFormat) {
		window.setTimeout(function() {
			getLabelFieldFromRow(newRow).focus();
			updateCustomFormats();
		}, 0);
	}

	return newRow;
}

function updateCustomFormats()
{
	var value = [];
	var row = gFormatTemplate.nextSibling;
	while (row)
	{
		value.push(
			[
				getFormatFieldFromRow(row).value,
				getLabelFieldFromRow(row).value
			]
			.map(encodeURIComponent)
			.join('/')
		);
		row = row.nextSibling;
	}
	value = value.join('|')
			.replace(/[\|\/]+$/, ''); // delete last blank rows
	if (value != gFormatsPref.value)
		gFormatsPref.value = value;
}

function initCustomFormats()
{
	var range = document.createRange();
	range.selectNodeContents(gFormatsBox);
	range.setStartAfter(gFormatTemplate);
	range.deleteContents();
	range.detach();
	var value = gFormatsPref.value
		.replace(/[\|\/]+$/, ''); // delete last blank rows
	if (!value) return;
	var formatDefinitions = value.split('|');
	for (let i = 0, maxi = formatDefinitions.length; i < maxi; i++)
	{
		let formatDefinition = formatDefinitions[i];
		let format, label;
		[format, label] = formatDefinition.split('/').map(decodeURIComponent);
		addNewFormat(label, format);
	}
}

function onFormatInput(aRow)
{
	var radio = getRadioFromRow(aRow);
	var format = getFormatFieldFromRow(aRow);
	if (format.value) {
		radio.removeAttribute('disabled');
	}
	else {
		radio.setAttribute('disabled', true);
		if (radio == gFormatsRadio.selectedItem)
			gFormatsRadio.value = -1;
	}
}
