var win;
var sv;
var tabs;

function setUp()
{
	utils.loadPrefs('../../defaults/preferences/multipletab.js');
	utils.setPref('browser.tabs.warnOnClose', false);

	yield utils.setUpTestWindow();
	win = utils.getTestWindow();
	sv = win.MultipleTabService;

	gBrowser.removeAllTabsBut(gBrowser.selectedTab);
	yield Do(utils.addTab('about:blank'));
	yield Do(utils.addTab('about:logo'));
	yield Do(utils.addTab('about:config'));
	yield Do(utils.addTab('../fixtures/test.html?query1=value1&query2=value2'));
	gBrowser.removeTab(gBrowser.selectedTab);
	tabs = Array.slice(gBrowser.mTabs);
	assert.equals(4, tabs.length);
}

function tearDown()
{
	win = null;
	tabs = null;
	utils.tearDownTestWindow();
}


function getChildByClass(aClassName, aParent)
{
	return win.document.getAnonymousElementByAttribute(aParent, 'class', aClassName);
}

function createEventStubByClass(aClassName, aParent)
{
	var node = getChildByClass(aClassName, aParent);
	assert.isNotNull(node, aClassName);
	var stub = createEventStubFor(aParent);
	stub.originalTarget = node;
	return stub;
}

function createEventStubFor(aNode)
{
	return {
		target         : aNode,
		originalTarget : aNode,
		type           : 'click',
		button         : 0,
		detail         : 1,
		altKey         : false,
		ctrlKey        : false,
		metaKey        : false,
		shiftKey       : false
	};
}

function getLineFeed()
{
	if (navigator.platform.toLowerCase().indexOf('win') > -1)
		return '\r\n';
	else
		return '\n';
}

function escapeForHTML(aString)
{
	return aString
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
}

