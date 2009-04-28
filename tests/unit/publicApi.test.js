utils.include('./common.inc.js');


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

function test_closeTabs()
{
}

function test_closeSimilarTabsOf()
{
}

function test_closeOtherTabs()
{
}

function test_reloadTabs()
{
}

function test_saveTabs()
{
}

function test_addBookmarkFor()
{
}

function test_duplicateTabs()
{
}

function test_splitWindowFromTabs()
{
	// splitWindowFrom (backward compatibility)
}

function test_copyURIsToClipboard()
{
}

function test_getBundledTabsOf()
{
}

function test_hasSelection()
{
}

function test_isSelected()
{
}

function test_setSelection()
{
}

function test_setReadyToClose()
{
}

function test_toggleSelection()
{
}

function test_toggleReadyToClose()
{
}

function test_clearSelection()
{
}
