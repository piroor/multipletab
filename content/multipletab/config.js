const XULAppInfo = Components.classes['@mozilla.org/xre/app-info;1']
		.getService(Components.interfaces.nsIXULAppInfo);
const comparator = Components.classes['@mozilla.org/xpcom/version-comparator;1']
					.getService(Components.interfaces.nsIVersionComparator);

var gAutoPopupItems = [];
var gDelayItems = [];
var gDragModeRadio;

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
