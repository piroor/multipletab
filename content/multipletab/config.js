const XULAppInfo = Components.classes['@mozilla.org/xre/app-info;1']
		.getService(Components.interfaces.nsIXULAppInfo);
const comparator = Components.classes['@mozilla.org/xpcom/version-comparator;1']
					.getService(Components.interfaces.nsIVersionComparator);

const MENU_EDITOR_ID = '{EDA7B1D7-F793-4e03-B074-E6F303317FB0}';

var gAutoPopupItems = [];
var gDelayItems = [];
var gDragModeRadio;

function init()
{
	var installed = window['piro.sakura.ne.jp'].extensions.isInstalled(MENU_EDITOR_ID);
	var enabled = window['piro.sakura.ne.jp'].extensions.isEnabled(MENU_EDITOR_ID);

	[
		document.getElementById('menuEditorLink-selection'),
		document.getElementById('menuEditorLink-context')
	].forEach(function(aItem) {
		if (installed)
			aItem.setAttribute('collapsed', true);
		else
			aItem.removeAttribute('collapsed');
	});

	[
		document.getElementById('menuEditorConfig-selection'),
		document.getElementById('menuEditorConfig-context')
	].forEach(function(aItem) {
		if (installed)
			aItem.removeAttribute('collapsed');
		else
			aItem.setAttribute('collapsed', true);
		if (enabled)
			aItem.removeAttribute('disabled');
		else
			aItem.setAttribute('disabled', true);
	});


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

function initFeaturesPane()
{
	var useEffectiveTLD = document.getElementById('useEffectiveTLD');
	if (comparator.compare(XULAppInfo.version, '3.0') < 0) {
		useEffectiveTLD.setAttribute('collapsed', true);
	}
	else {
		useEffectiveTLD.removeAttribute('collapsed');
	}
}

function onDragModeChange()
{
	gDelayItems.forEach(function(aItem) {
		if (gDragModeRadio.value == 0)
			aItem.setAttribute('disabled', true);
		else
			aItem.removeAttribute('disabled');
	});
	gAutoPopupItems.forEach(function(aItem) {
		if (gDragModeRadio.value == 1)
			aItem.removeAttribute('disabled');
		else
			aItem.setAttribute('disabled', true);
	});
}

function openMenuEditorConfig()
{
	window['piro.sakura.ne.jp'].extensions.goToOptions(MENU_EDITOR_ID);
}
