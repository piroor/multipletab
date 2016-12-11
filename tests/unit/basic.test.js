utils.include('./common.inc.js');

function test_isEventFiredOnTabIcon()
{
	var node = tabs[0];
	assert.isTrue(sv.isEventFiredOnTabIcon(createEventStubByClass('tab-icon-image', node)));
	assert.isTrue(sv.isEventFiredOnTabIcon(createEventStubByClass('tab-extra-status', node)));
	assert.isTrue(sv.isEventFiredOnTabIcon(createEventStubByClass('tab-icon', node)));
	assert.isFalse(sv.isEventFiredOnTabIcon(createEventStubByClass('tab-text', node)));
	assert.isFalse(sv.isEventFiredOnTabIcon(createEventStubByClass('tab-close-button', node)));
	assert.isFalse(sv.isEventFiredOnTabIcon(createEventStubFor(node)));
	assert.isFalse(sv.isEventFiredOnTabIcon(createEventStubFor(gBrowser.mTabContainer)));
	assert.isFalse(sv.isEventFiredOnTabIcon(createEventStubFor(gBrowser)));
	assert.isFalse(sv.isEventFiredOnTabIcon(createEventStubByClass('tabs-alltabs-button', gBrowser.mTabContainer)));
	assert.isFalse(sv.isEventFiredOnTabIcon(createEventStubByClass('close-button tabs-closebutton', gBrowser.mTabContainer)));
}

function test_isEventFiredOnClickable()
{
	var node = tabs[0];
	assert.isFalse(sv.isEventFiredOnClickable(createEventStubByClass('tab-icon-image', node)));
	assert.isFalse(sv.isEventFiredOnClickable(createEventStubByClass('tab-extra-status', node)));
	assert.isFalse(sv.isEventFiredOnClickable(createEventStubByClass('tab-icon', node)));
	assert.isFalse(sv.isEventFiredOnClickable(createEventStubByClass('tab-text', node)));
	assert.isTrue(sv.isEventFiredOnClickable(createEventStubByClass('tab-close-button', node)));
	assert.isFalse(sv.isEventFiredOnClickable(createEventStubFor(node)));
	assert.isFalse(sv.isEventFiredOnClickable(createEventStubFor(gBrowser.mTabContainer)));
	assert.isFalse(sv.isEventFiredOnClickable(createEventStubFor(gBrowser)));
	assert.isTrue(sv.isEventFiredOnClickable(createEventStubByClass('tabs-alltabs-button', gBrowser.mTabContainer)));
	assert.isTrue(sv.isEventFiredOnClickable(createEventStubByClass('close-button tabs-closebutton', gBrowser.mTabContainer)));
}

function test_getCloseboxFromEvent()
{
	var node = tabs[0];
	assert.isNull(sv.getCloseboxFromEvent(createEventStubByClass('tab-icon-image', node)));
	assert.isNull(sv.getCloseboxFromEvent(createEventStubByClass('tab-extra-status', node)));
	assert.isNull(sv.getCloseboxFromEvent(createEventStubByClass('tab-icon', node)));
	assert.isNull(sv.getCloseboxFromEvent(createEventStubByClass('tab-text', node)));
	assert.isNotNull(sv.getCloseboxFromEvent(createEventStubByClass('tab-close-button', node)));
	assert.isNull(sv.getCloseboxFromEvent(createEventStubFor(node)));
	assert.isNull(sv.getCloseboxFromEvent(createEventStubFor(gBrowser.mTabContainer)));
	assert.isNull(sv.getCloseboxFromEvent(createEventStubFor(gBrowser)));
	assert.isNull(sv.getCloseboxFromEvent(createEventStubByClass('tabs-alltabs-button', gBrowser.mTabContainer)));
	assert.isNull(sv.getCloseboxFromEvent(createEventStubByClass('close-button tabs-closebutton', gBrowser.mTabContainer)));
}

function test_isAccelKeyPressed()
{
	var event = createEventStubFor(tabs[0]);

	event.ctrlKey = true;
	if (navigator.platform.toLowerCase().indexOf('mac') < 0)
		assert.isTrue(sv.isAccelKeyPressed(event));
	else
		assert.isFalse(sv.isAccelKeyPressed(event));

	event.ctrlKey = false;
	event.metaKey = true;
	if (navigator.platform.toLowerCase().indexOf('mac') < 0)
		assert.isFalse(sv.isAccelKeyPressed(event));
	else
		assert.isTrue(sv.isAccelKeyPressed(event));
}

function test_getDomainFromURI()
{
	this.setPref('extensions.multipletab.useEffectiveTLD', true);
	assert.isNull(sv.getDomainFromURI());
	assert.isNull(sv.getDomainFromURI('about:'));
	assert.equals('example.com', sv.getDomainFromURI('http://www.example.com/'));

	this.setPref('extensions.multipletab.useEffectiveTLD', false);
	assert.equals('www.example.com', sv.getDomainFromURI('http://www.example.com/'));
}

function test_makeURIFromSpec()
{
	assert.isTrue(sv.makeURIFromSpec('http://www.example.com/') instanceof Ci.nsIURI);
	assert.isTrue(sv.makeURIFromSpec('about:') instanceof Ci.nsIURI);
	assert.isTrue(sv.makeURIFromSpec('file:///C:/Temp') instanceof Ci.nsIURI);
}

function test_getTabFromEvent()
{
	var node = tabs[0];
	assert.equals(node, sv.getTabFromEvent(createEventStubByClass('tab-icon-image', node)));
	assert.equals(node, sv.getTabFromEvent(createEventStubByClass('tab-extra-status', node)));
	assert.equals(node, sv.getTabFromEvent(createEventStubByClass('tab-icon', node)));
	assert.equals(node, sv.getTabFromEvent(createEventStubByClass('tab-text', node)));
	assert.equals(node, sv.getTabFromEvent(createEventStubByClass('tab-close-button', node)));
	assert.equals(node, sv.getTabFromEvent(createEventStubFor(node)));
	assert.isNull(sv.getTabFromEvent(createEventStubFor(gBrowser.mTabContainer)));
	assert.isNull(sv.getTabFromEvent(createEventStubFor(gBrowser)));
	assert.isNull(sv.getTabFromEvent(createEventStubByClass('tabs-alltabs-button', gBrowser.mTabContainer)));
	assert.isNull(sv.getTabFromEvent(createEventStubByClass('close-button tabs-closebutton', gBrowser.mTabContainer)));
}

function test_getTabBrowserFromChild()
{
	var node = tabs[0];
	assert.equals(gBrowser, sv.getTabBrowserFromChild(getChildByClass('tab-icon-image', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(getChildByClass('tab-extra-status', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(getChildByClass('tab-icon', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(getChildByClass('tab-text', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(getChildByClass('tab-close-button', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(node));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(gBrowser.mTabContainer));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(gBrowser));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(getChildByClass('tabs-alltabs-button', gBrowser.mTabContainer)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(getChildByClass('close-button tabs-closebutton', gBrowser.mTabContainer)));
	assert.isNull(sv.getTabBrowserFromChild(content.document.documentElement));
	assert.isNull(sv.getTabBrowserFromChild(gBrowser.parentNode));

	// backward compatibility
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(getChildByClass('tab-icon-image', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(getChildByClass('tab-extra-status', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(getChildByClass('tab-icon', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(getChildByClass('tab-text', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(getChildByClass('tab-close-button', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(node));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(gBrowser.mTabContainer));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(gBrowser));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(getChildByClass('tabs-alltabs-button', gBrowser.mTabContainer)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(getChildByClass('close-button tabs-closebutton', gBrowser.mTabContainer)));
	assert.isNull(sv.getTabBrowserFromChildren(content.document.documentElement));
	assert.isNull(sv.getTabBrowserFromChildren(gBrowser.parentNode));
}

function test_getTabs()
{
	var result = sv.getTabs(gBrowser);
	assert.isTrue(result instanceof XPathResult);
	assert.equals(4, result.snapshotLength);
	assert.equals(tabs[0], result.snapshotItem(0));
}

function test_getTabsArray()
{
	assert.equals(tabs, sv.getTabsArray(gBrowser));
}

function test_getNextTab()
{
	assert.equals(tabs[1], sv.getNextTab(tabs[0]));
	assert.equals(tabs[3], sv.getNextTab(tabs[2]));
	assert.isNull(sv.getNextTab(tabs[3]));
	assert.isNull(sv.getNextTab(gBrowser.mTabContainer));
}

function test_getPreviousTab()
{
	assert.equals(tabs[0], sv.getPreviousTab(tabs[1]));
	assert.equals(tabs[2], sv.getPreviousTab(tabs[3]));
	assert.isNull(sv.getPreviousTab(tabs[0]));
	assert.isNull(sv.getPreviousTab(gBrowser.mTabContainer));
}

function test_filterBlankTabs()
{
	assert.equals([tabs[1], tabs[2], tabs[3]], sv.filterBlankTabs(tabs));
}

test_formatURIsForClipboard.setUp = function() {
	yield Do(utils.addTab('data:text/html,<title>$1</title>hello'));
	tabs = [...gBrowser.mTabs];
	assert.equals(5, tabs.length);
};
function test_formatURIsForClipboard()
{
	var tab = tabs[3];
	var uri = tab.linkedBrowser.currentURI.spec;
	var title = tab.label;
	assert.equals(uri, sv.formatURIsForClipboard(tab));
	assert.equals(uri, sv.formatURIsForClipboard(tab, sv.kFORMAT_TYPE_DEFAULT));

	assert.equals(
		title+getLineFeed()+uri,
		sv.formatURIsForClipboard(tab, sv.kFORMAT_TYPE_MOZ_URL)
	);
	assert.equals(
		title+getLineFeed()+uri,
		sv.formatURIsForClipboard(tab, 0, '%TITLE%%EOL%%URL%')
	);

	assert.equals(
		'<a href="'+escapeForHTML(uri)+'">'+escapeForHTML(title)+'</a>',
		sv.formatURIsForClipboard(tab, sv.kFORMAT_TYPE_LINK)
	);
	assert.equals(
		'<a href="'+escapeForHTML(uri)+'">'+escapeForHTML(title)+'</a>',
		sv.formatURIsForClipboard(tab, 0, '<a href="%URL_HTML%">%TITLE_HTML%</a>')
	);
	assert.equals(
		'<a href="'+escapeForHTML(uri)+'">'+escapeForHTML(title)+'</a>',
		sv.formatURIsForClipboard(tab, 0, '<a href="%URL_HTMLIFIED%">%TITLE_HTMLIFIED%</a>')
	);

	tab = tabs[4];
	uri = tab.linkedBrowser.currentURI.spec;
	title = tab.label;
	assert.equals(
		title+getLineFeed()+uri,
		sv.formatURIsForClipboard(tab, 0, '%TITLE%%EOL%%URL%')
	);
}

function test_formatURIsForClipboard_tabs()
{
	var uris = tabs.map(function(aTab) {
			return aTab.linkedBrowser.currentURI.spec;
		}).join(getLineFeed())+getLineFeed();
	assert.equals(uris, sv.formatURIsForClipboard(tabs));
	assert.equals(uris, sv.formatURIsForClipboard(tabs, sv.kFORMAT_TYPE_DEFAULT));

	var mozURLs = tabs.map(function(aTab) {
			return aTab.label+getLineFeed()+aTab.linkedBrowser.currentURI.spec;
		}).join(getLineFeed())+getLineFeed();
	assert.equals(
		mozURLs,
		sv.formatURIsForClipboard(tabs, sv.kFORMAT_TYPE_MOZ_URL)
	);
	assert.equals(
		mozURLs,
		sv.formatURIsForClipboard(tabs, 0, '%TITLE%%EOL%%URL%')
	);

	var links = tabs.map(function(aTab) {
			return '<a href="'+escapeForHTML(aTab.linkedBrowser.currentURI.spec)+'">'+escapeForHTML(aTab.label)+'</a>';
		}).join(getLineFeed())+getLineFeed();
	assert.equals(
		links,
		sv.formatURIsForClipboard(tabs, sv.kFORMAT_TYPE_LINK)
	);
	assert.equals(
		links,
		sv.formatURIsForClipboard(tabs, 0, '<a href="%URL_HTML%">%TITLE_HTML%</a>')
	);
	assert.equals(
		links,
		sv.formatURIsForClipboard(tabs, 0, '<a href="%URL_HTMLIFIED%">%TITLE_HTMLIFIED%</a>')
	);
}

test_calculateDeltaForNewPosition.setUp = function() {
	yield Do(utils.addTab('about:blank'));
	yield Do(utils.addTab('about:blank'));
	yield Do(utils.addTab('about:blank'));
	yield Do(utils.addTab('about:blank'));
	tabs = [...gBrowser.mTabs];
	assert.equals(8, tabs.length);
};
function test_calculateDeltaForNewPosition()
{
	// [0], [1], [*2*], [3], [4], 5, 6, 7
	// => [0], [1], [3], [4], 5, 6, 7, [*2*]
	// => 5, 6, 7, [0], [1], [*2*], [3], [4]
	gBrowser.moveTabTo(tabs[2], 7);
	assert.equals(7, tabs[2]._tPos);
	assert.equals(
		[-1, -1, 0, 1],
		sv.calculateDeltaForNewPosition([tabs[0], tabs[1], tabs[3], tabs[4]], 2, 7)
	);

	// 0, 1, 2, [3], [4], [*5*], [6], [7]
	// => [*5*], 0, 1, 2, [3], [4], [6], [7]
	// => [3], [4], [*5*], [6], [7], 0, 1, 2
	tabs = [...gBrowser.mTabs];
	gBrowser.moveTabTo(tabs[5], 0);
	assert.equals(0, tabs[5]._tPos);
	assert.equals(
		[0, 0, 1, 2],
		sv.calculateDeltaForNewPosition([tabs[3], tabs[4], tabs[6], tabs[7]], 5, 0)
	);

	// [0], 1, [*2*], 3, [4], 5, [6], 7
	// => [0], 1, 3, [4], 5, [*2*], [6], 7
	// => 1, 3, 5, [0], [*2*], [4], [6], 7
	tabs = [...gBrowser.mTabs];
	gBrowser.moveTabTo(tabs[2], 5);
	assert.equals(5, tabs[2]._tPos);
	assert.equals(
		[-1, 0, 1],
		sv.calculateDeltaForNewPosition([tabs[0], tabs[4], tabs[6]], 2, 5)
	);

	// [0], 1, [2], 3, [*4*], 5, [6], 7
	// => [0], 1, [*4*], [2], 3, 5, [6], 7
	// => 1, [0], [2], [*4*], [6], 3, 5, 7
	tabs = [...gBrowser.mTabs];
	gBrowser.moveTabTo(tabs[4], 2);
	assert.equals(2, tabs[4]._tPos);
	assert.equals(
		[0, 0, 1],
		sv.calculateDeltaForNewPosition([tabs[0], tabs[2], tabs[6]], 4, 2)
	);
}

function test_isDraggingAllTabs()
{
	assert.isFalse(sv.isDraggingAllTabs(tabs[0]));
	tabs[0].setAttribute(sv.kSELECTED, true);
	tabs[1].setAttribute(sv.kSELECTED, true);
	tabs[2].setAttribute(sv.kSELECTED, true);
	tabs[3].setAttribute(sv.kSELECTED, true);
	assert.isTrue(sv.isDraggingAllTabs(tabs[0]));
	tabs[3].setAttribute(sv.kSELECTED, false);
	assert.isFalse(sv.isDraggingAllTabs(tabs[0]));
}

const SS = Cc['@mozilla.org/browser/sessionstore;1'].getService(Ci.nsISessionStore);;

function test_setBooleanAttributeToTab()
{
	var tab = tabs[0];
	var attr = 'test-attribute-'+parseInt(Math.random() * 65000);

	assert.isTrue(sv.setBooleanAttributeToTab(tab, attr, true));
	assert.equals('true', tab.getAttribute(attr));
	assert.equals('', SS.getTabValue(tab, attr));

	assert.isFalse(sv.setBooleanAttributeToTab(tab, attr, false));
	assert.equals('', tab.getAttribute(attr));
	assert.equals('', SS.getTabValue(tab, attr));
	assert.isFalse(tab.hasAttribute(attr));

	assert.isTrue(sv.setBooleanAttributeToTab(tab, attr, true, true));
	assert.equals('true', tab.getAttribute(attr));
	assert.equals('true', SS.getTabValue(tab, attr));

	assert.isFalse(sv.setBooleanAttributeToTab(tab, attr, false, true));
	assert.equals('', tab.getAttribute(attr));
	assert.equals('', SS.getTabValue(tab, attr));
	assert.isFalse(tab.hasAttribute(attr));
}

function test_toggleBooleanAttributeToTab()
{
	var tab = tabs[0];
	var attr = 'test-attribute-'+parseInt(Math.random() * 65000);

	assert.isFalse(tab.hasAttribute(attr));
	assert.isTrue(sv.toggleBooleanAttributeToTab(tab, attr));
	assert.equals('true', tab.getAttribute(attr));
	assert.equals('', SS.getTabValue(tab, attr));

	assert.isFalse(sv.toggleBooleanAttributeToTab(tab, attr));
	assert.equals('', tab.getAttribute(attr));
	assert.equals('', SS.getTabValue(tab, attr));
	assert.isFalse(tab.hasAttribute(attr));

	assert.isTrue(sv.toggleBooleanAttributeToTab(tab, attr, true));
	assert.equals('true', tab.getAttribute(attr));
	assert.equals('true', SS.getTabValue(tab, attr));

	assert.isFalse(sv.toggleBooleanAttributeToTab(tab, attr, true));
	assert.equals('', tab.getAttribute(attr));
	assert.equals('', SS.getTabValue(tab, attr));
	assert.isFalse(tab.hasAttribute(attr));
}
