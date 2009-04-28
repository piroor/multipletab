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


function test_getSelectedTabs()
{
	assert.equals([], sv.getSelectedTabs());
	tabs[0].setAttribute(sv.kSELECTED, true);
	assert.equals([tabs[0]], sv.getSelectedTabs());
	tabs[2].setAttribute(sv.kSELECTED, true);
	assert.equals([tabs[0], tabs[2]], sv.getSelectedTabs());
	tabs[0].setAttribute(sv.kSELECTED, false);
	tabs[2].setAttribute(sv.kSELECTED, false);
	assert.equals([], sv.getSelectedTabs());
	tabs[0].removeAttribute(sv.kSELECTED);
	tabs[2].removeAttribute(sv.kSELECTED);
	assert.equals([], sv.getSelectedTabs());
}

function test_getReadyToCloseTabs()
{
	assert.equals([], sv.getReadyToCloseTabs());
	tabs[0].setAttribute(sv.kREADY_TO_CLOSE, true);
	assert.equals([tabs[0]], sv.getReadyToCloseTabs());
	tabs[2].setAttribute(sv.kREADY_TO_CLOSE, true);
	assert.equals([tabs[0], tabs[2]], sv.getReadyToCloseTabs());
	tabs[0].setAttribute(sv.kREADY_TO_CLOSE, false);
	tabs[2].setAttribute(sv.kREADY_TO_CLOSE, false);
	assert.equals([], sv.getReadyToCloseTabs());
	tabs[0].removeAttribute(sv.kREADY_TO_CLOSE);
	tabs[2].removeAttribute(sv.kREADY_TO_CLOSE);
	assert.equals([], sv.getReadyToCloseTabs());
}

function test_getLeftTabsOf()
{
	assert.equals([], sv.getLeftTabsOf(tabs[0]));
	assert.equals([tabs[0]], sv.getLeftTabsOf(tabs[1]));
	assert.equals([tabs[0], tabs[1]], sv.getLeftTabsOf(tabs[2]));
	assert.equals([], sv.getLeftTabsOf(null));
}

function test_getRightTabsOf()
{
	assert.equals([], sv.getRightTabsOf(tabs[3]));
	assert.equals([tabs[3]], sv.getRightTabsOf(tabs[2]));
	assert.equals([tabs[2], tabs[3]], sv.getRightTabsOf(tabs[1]));
	assert.equals([], sv.getRightTabsOf(null));
}

test_getSimilarTabsOf.setUp = function() {
	yield Do(utils.addTab('http://www.example.com'));
	yield Do(utils.addTab('http://test.example.com/test1'));
	yield Do(utils.addTab('http://test.example.com/test2'));
	yield Do(utils.addTab('http://www.example.jp'));
	tabs = Array.slice(gBrowser.mTabs);
	assert.equals(8, tabs.length);
};
function test_getSimilarTabsOf()
{
	this.setPref('extensions.multipletab.useEffectiveTLD', true);
	assert.equals([], sv.getSimilarTabsOf());
	assert.equals([tabs[5], tabs[6]], sv.getSimilarTabsOf(tabs[4]));
	assert.equals([tabs[4], tabs[6]], sv.getSimilarTabsOf(tabs[5]));
	assert.equals([], sv.getSimilarTabsOf(tabs[7]));

	this.setPref('extensions.multipletab.useEffectiveTLD', false);
	assert.equals([], sv.getSimilarTabsOf(tabs[4]));
	assert.equals([tabs[6]], sv.getSimilarTabsOf(tabs[5]));
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
	assert.equals(gBrowser, sv.getTabBrowserFromChild(createEventStubByClass('tab-icon-image', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(createEventStubByClass('tab-extra-status', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(createEventStubByClass('tab-icon', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(createEventStubByClass('tab-text', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(createEventStubByClass('tab-close-button', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(createEventStubFor(node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(createEventStubFor(gBrowser.mTabContainer)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(createEventStubFor(gBrowser)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(createEventStubByClass('tabs-newtab-button', gBrowser.mTabContainer)));
	assert.equals(gBrowser, sv.getTabBrowserFromChild(createEventStubByClass('close-button tabs-closebutton', gBrowser.mTabContainer)));
	assert.isNull(sv.getTabBrowserFromChild(createEventStubFor(content.document.documentElement)));
	assert.isNull(sv.getTabBrowserFromChild(createEventStubFor(gBrowser.parentNode)));

	// backward compatibility
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(createEventStubByClass('tab-icon-image', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(createEventStubByClass('tab-extra-status', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(createEventStubByClass('tab-icon', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(createEventStubByClass('tab-text', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(createEventStubByClass('tab-close-button', node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(createEventStubFor(node)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(createEventStubFor(gBrowser.mTabContainer)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(createEventStubFor(gBrowser)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(createEventStubByClass('tabs-newtab-button', gBrowser.mTabContainer)));
	assert.equals(gBrowser, sv.getTabBrowserFromChildren(createEventStubByClass('close-button tabs-closebutton', gBrowser.mTabContainer)));
	assert.isNull(sv.getTabBrowserFromChildren(createEventStubFor(content.document.documentElement)));
	assert.isNull(sv.getTabBrowserFromChildren(createEventStubFor(gBrowser.parentNode)));
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


