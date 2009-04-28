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


