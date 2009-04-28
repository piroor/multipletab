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

test_duplicateTabs.setUp = function() {
	yield Do(utils.loadURI('about:blank?1'));
	yield Do(utils.loadURI('about:blank?2'));
	assert.isTrue(tabs[0].linkedBrowser.canGoBack);
};
function test_duplicateTabs()
{
	tabs[0].setAttribute(sv.kSELECTED, true);
	tabs[1].setAttribute(sv.kSELECTED, true);
	tabs[2].setAttribute(sv.kSELECTED, true);
	sv.duplicateTabs([tabs[0], tabs[1], tabs[2]]);

	yield 500;

	var resultTabs = Array.slice(gBrowser.mTabs);
	assert.equals(7, resultTabs.length);
	assert.equals(
		resultTabs[0].linkedBrowser.currentURI.spec,
		resultTabs[4].linkedBrowser.currentURI.spec
	);
	assert.equals(
		resultTabs[1].linkedBrowser.currentURI.spec,
		resultTabs[5].linkedBrowser.currentURI.spec
	);
	assert.equals(
		resultTabs[2].linkedBrowser.currentURI.spec,
		resultTabs[6].linkedBrowser.currentURI.spec
	);

	assert.isFalse(tabs[0].hasAttribute(sv.kSELECTED));
	assert.isFalse(tabs[1].hasAttribute(sv.kSELECTED));
	assert.isFalse(tabs[2].hasAttribute(sv.kSELECTED));
	assert.isFalse(tabs[3].hasAttribute(sv.kSELECTED));
	assert.equals('true', resultTabs[4].getAttribute(sv.kSELECTED));
	assert.equals('true', resultTabs[5].getAttribute(sv.kSELECTED));
	assert.equals('true', resultTabs[6].getAttribute(sv.kSELECTED));
	assert.isTrue(resultTabs[4].linkedBrowser.canGoBack);
	assert.equals(resultTabs[4], gBrowser.selectedTab);
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
	var info = {};
	var bundledTabs = sv.getBundledTabsOf(null, info);
	assert.equals([], bundledTabs);
	assert.isNull(info.sourceWindow);
	assert.isNull(info.sourceBrowser);

	info = {};
	bundledTabs = sv.getBundledTabsOf(tabs[0], info);
	assert.equals([], bundledTabs);
	assert.equals(win, info.sourceWindow);
	assert.equals(gBrowser, info.sourceBrowser);

	tabs[0].setAttribute(sv.kSELECTED, true);
	info = {};
	bundledTabs = sv.getBundledTabsOf(tabs[0], info);
	assert.equals([tabs[0]], bundledTabs);
	assert.equals(win, info.sourceWindow);
	assert.equals(gBrowser, info.sourceBrowser);

	tabs[1].setAttribute(sv.kSELECTED, true);
	tabs[2].setAttribute(sv.kSELECTED, true);
	info = {};
	bundledTabs = sv.getBundledTabsOf(tabs[0], info);
	assert.equals([tabs[0], tabs[1], tabs[2]], bundledTabs);
	assert.equals(win, info.sourceWindow);
	assert.equals(gBrowser, info.sourceBrowser);
}

function test_hasSelection()
{
	assert.isFalse(sv.hasSelection());
	assert.isFalse(sv.hasSelection(gBrowser));
	tabs[0].setAttribute(sv.kSELECTED, true);
	assert.isTrue(sv.hasSelection());
	assert.isTrue(sv.hasSelection(gBrowser));
	tabs[0].removeAttribute(sv.kSELECTED);
	assert.isFalse(sv.hasSelection());
	assert.isFalse(sv.hasSelection(gBrowser));
}

function test_isSelected()
{
	assert.isFalse(tabs[0].hasAttribute(sv.kSELECTED));
	assert.isFalse(sv.isSelected(tabs[0]));
	tabs[0].setAttribute(sv.kSELECTED, true);
	assert.isTrue(sv.isSelected(tabs[0]));
	tabs[0].removeAttribute(sv.kSELECTED);
	assert.isFalse(sv.isSelected(tabs[0]));
}

function test_setSelection()
{
	assert.isFalse(tabs[0].hasAttribute(sv.kSELECTED));
	sv.setSelection(tabs[0], true);
	assert.equals('true', tabs[0].getAttribute(sv.kSELECTED));
	sv.setSelection(tabs[0], false);
	assert.isFalse(tabs[0].hasAttribute(sv.kSELECTED));
}

function test_setReadyToClose()
{
	assert.isFalse(tabs[0].hasAttribute(sv.kREADY_TO_CLOSE));
	sv.setReadyToClose(tabs[0], true);
	assert.equals('true', tabs[0].getAttribute(sv.kREADY_TO_CLOSE));
	sv.setReadyToClose(tabs[0], false);
	assert.isFalse(tabs[0].hasAttribute(sv.kREADY_TO_CLOSE));
}

function test_toggleSelection()
{
	assert.isFalse(tabs[0].hasAttribute(sv.kSELECTED));
	sv.toggleSelection(tabs[0]);
	assert.equals('true', tabs[0].getAttribute(sv.kSELECTED));
	sv.toggleSelection(tabs[0]);
	assert.isFalse(tabs[0].hasAttribute(sv.kSELECTED));
}

function test_toggleReadyToClose()
{
	assert.isFalse(tabs[0].hasAttribute(sv.kREADY_TO_CLOSE));
	sv.toggleReadyToClose(tabs[0]);
	assert.equals('true', tabs[0].getAttribute(sv.kREADY_TO_CLOSE));
	sv.toggleReadyToClose(tabs[0]);
	assert.isFalse(tabs[0].hasAttribute(sv.kREADY_TO_CLOSE));
}

function test_clearSelection()
{
	tabs[0].setAttribute(sv.kSELECTED, true);
	tabs[1].setAttribute(sv.kSELECTED, true);
	tabs[2].setAttribute(sv.kSELECTED, true);
	sv.clearSelection();
	assert.isFalse(tabs[0].hasAttribute(sv.kSELECTED));
	assert.isFalse(tabs[1].hasAttribute(sv.kSELECTED));
	assert.isFalse(tabs[2].hasAttribute(sv.kSELECTED));

	tabs[0].setAttribute(sv.kSELECTED, true);
	tabs[1].setAttribute(sv.kSELECTED, true);
	tabs[2].setAttribute(sv.kSELECTED, true);
	sv.clearSelection(gBrowser);
	assert.isFalse(tabs[0].hasAttribute(sv.kSELECTED));
	assert.isFalse(tabs[1].hasAttribute(sv.kSELECTED));
	assert.isFalse(tabs[2].hasAttribute(sv.kSELECTED));
}
