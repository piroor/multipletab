utils.include('./common.inc.js');

function test_contextMenuOverride()
{
	var popup = win.document.getAnonymousElementByAttribute(gBrowser, 'anonid', 'tabContextMenu');
	assert.isNotNull(popup);

	function assertItemInserted(aID)
	{
		var base = $(aID, win);
		var items = popup.getElementsByAttribute('oncommand', base.getAttribute('oncommand'));
		assert.isTrue(items.length);
	}

	assertItemInserted('multipletab-context-duplicate');
	assertItemInserted('multipletab-context-removeAll');
	assertItemInserted('multipletab-context-removeSimilar');
	assertItemInserted('multipletab-context-removeLeftTabs');
	assertItemInserted('multipletab-context-removeRightTabs');
	assertItemInserted('multipletab-context-clipboard');
	assertItemInserted('multipletab-context-clipboard:select');
	assertItemInserted('multipletab-context-clipboardAll');
	assertItemInserted('multipletab-context-clipboardAll:select');
	assertItemInserted('multipletab-context-saveTabs');
	assertItemInserted('multipletab-context-saveTabs:select');
}
