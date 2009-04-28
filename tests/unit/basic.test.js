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
	assert.isFalse(sv.isEventFiredOnTabIcon(createEventStubByClass('tabs-newtab-button', gBrowser.mTabContainer)));
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
	assert.isTrue(sv.isEventFiredOnClickable(createEventStubByClass('tabs-newtab-button', gBrowser.mTabContainer)));
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
	assert.isNull(sv.getCloseboxFromEvent(createEventStubByClass('tabs-newtab-button', gBrowser.mTabContainer)));
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
	assert.isNull(sv.getTabFromEvent(createEventStubByClass('tabs-newtab-button', gBrowser.mTabContainer)));
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
	assert.equals(gBrowser, sv.getTabBrowserFromChild(getChildByClass('tabs-newtab-button', gBrowser.mTabContainer)));
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
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(getChildByClass('tabs-newtab-button', gBrowser.mTabContainer)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(getChildByClass('close-button tabs-closebutton', gBrowser.mTabContainer)));
	assert.isNull(sv.getTabBrowserFromChildren(content.document.documentElement));
	assert.isNull(sv.getTabBrowserFromChildren(gBrowser.parentNode));
}

function test_getTabs()
{
	var result = sv.getTabs(gBrowser);
	assert.isTrue(result instanceof Ci.nsIDOMXPathResult);
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

function test_formatURIStringForClipboard()
{
	var tab = tabs[3];
	var uri = tab.linkedBrowser.currentURI.spec;
	assert.equals(uri, sv.formatURIStringForClipboard(uri, tab));
	assert.equals(uri, sv.formatURIStringForClipboard(uri, tab, sv.kFORMAT_TYPE_DEFAULT));
	assert.equals(
		'テストケース & <sample>\r\n'+uri,
		sv.formatURIStringForClipboard(uri, tab, sv.kFORMAT_TYPE_MOZ_URL)
	);
	assert.equals(
		'<a href="'+uri.replace(/&/g, '&amp;')+'">テストケース &amp; &lt;sample&gt;</a>',
		sv.formatURIStringForClipboard(uri, tab, sv.kFORMAT_TYPE_LINK)
	);
}

function test_calculateDeltaForNewPosition()
{
}

function test_isDraggingAllTabs()
{
	tabs[0].setAttribute(sv.kSELECTED, true);
	tabs[1].setAttribute(sv.kSELECTED, true);
	tabs[2].setAttribute(sv.kSELECTED, true);
	tabs[3].setAttribute(sv.kSELECTED, true);
	assert.isTrue(sv.isDraggingAllTabs(tabs[0]));
	tabs[3].setAttribute(sv.kSELECTED, false);
	assert.isFalse(sv.isDraggingAllTabs(tabs[0]));
}

function test_setBooleanAttributeToTab()
{
	var tab = tabs[0];
	var attr = 'test-attribute-'+parseInt(Math.random() * 65000);
	assert.isTrue(sv.setBooleanAttributeToTab(tab, attr, true));
	assert.equals('true', tab.getAttribute(attr));
	assert.isFalse(sv.setBooleanAttributeToTab(tab, attr, false));
	assert.equals('', tab.getAttribute(attr));
	assert.isFalse(tab.hasAttribute(attr));
}

function test_toggleBooleanAttributeToTab()
{
	var tab = tabs[0];
	var attr = 'test-attribute-'+parseInt(Math.random() * 65000);
	assert.isFalse(tab.hasAttribute(attr));
	assert.isTrue(sv.toggleBooleanAttributeToTab(tab, attr));
	assert.equals('true', tab.getAttribute(attr));
	assert.isFalse(sv.toggleBooleanAttributeToTab(tab, attr));
	assert.equals('', tab.getAttribute(attr));
	assert.isFalse(tab.hasAttribute(attr));
}
