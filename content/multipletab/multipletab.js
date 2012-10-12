var MultipleTabService = { 
	PREFROOT : 'extensions.multipletab@piro.sakura.ne.jp',

	tabDragMode : -1,
	TAB_DRAG_MODE_DEFAULT : 0,
	TAB_DRAG_MODE_SELECT  : 1,
	TAB_DRAG_MODE_SWITCH  : 2,

	tabAccelClickMode : -1,
	tabShiftClickMode : -1,
	TAB_CLICK_MODE_DEFAULT : 0,
	TAB_CLICK_MODE_SELECT  : 1,
	TAB_CLICK_MODE_CLOSE   : 2,

	kSELECTION_STYLE : 'multipletab-selection-style',
	kSELECTED        : 'multiselected',
	kSELECTED_OLD    : 'multipletab-selected',
	kSELECTED_DUPLICATING : 'multipletab-selected-duplicating',
	kREADY_TO_CLOSE  : 'multipletab-ready-to-close',
	kIN_UNDETERMINED_RANGE : 'multipletab-in-undefermined-range',
	kINSERT_AFTER    : 'multipletab-insertafter',
	kINSERT_BEFORE   : 'multipletab-insertbefore',
	kAVAILABLE       : 'multipletab-available',
	kENABLED         : 'multipletab-enabled',

	kSELECTION_MENU        : 'multipletab-selection-menu',
	kCONTEXT_MENU_TEMPLATE : 'multipletab-tabcontext-menu-template',

	kCUSTOM_TYPE_OFFSET    : 1000,
	formats          : [],
	formatsTimeStamp : -1,

	selectableItems : [
		{ name : 'clipboard',
		  key  : 'extensions.multipletab.clipboard.formatType' },
		{ name : 'clipboardAll',
		  key  : 'extensions.multipletab.clipboard.formatType' },
		{ name : 'saveTabs',
		  key  : 'extensions.multipletab.saveTabs.saveType' }
	],

	lineFeed : '\r\n',

	implicitlySelect : true,
	selectionModified : false,
	selectionChanging : false,

	/* event types */
	kEVENT_TYPE_TAB_DUPLICATE   : 'nsDOMMultipleTabHandler:TabDuplicate',
	kEVENT_TYPE_WINDOW_MOVE     : 'nsDOMMultipleTabHandler:TabWindowMove',
	kEVENT_TYPE_TABS_CLOSING    : 'nsDOMMultipleTabHandlerTabsClosing',
	kEVENT_TYPE_TABS_CLOSED     : 'nsDOMMultipleTabHandlerTabsClosed',
	kEVENT_TYPE_TABS_DRAG_START : 'nsDOMMultipleTabHandler:TabsDragStart',
	
/* Utilities */ 
	
	NSResolver : { 
		lookupNamespaceURI : function MTS_lookupNamespaceURI(aPrefix)
		{
			switch (aPrefix)
			{
				case 'xul':
					return 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
				case 'html':
				case 'xhtml':
					return 'http://www.w3.org/1999/xhtml';
				case 'xlink':
					return 'http://www.w3.org/1999/xlink';
				default:
					return '';
			}
		}
	},
	evaluateXPath : function MTS_evaluateXPath(aExpression, aContext, aType)
	{
		if (!aType) aType = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
		try {
			var doc = aContext.ownerDocument || aContext || document;
			var xpathResult = doc.evaluate(
					aExpression,
					aContext || document,
					this.NSResolver,
					aType,
					null
				);
		}
		catch(e) {
			return {
				singleNodeValue : null,
				snapshotLength  : 0,
				snapshotItem    : function MTS_snapshotItem() {
					return null
				}
			};
		}
		return xpathResult;
	},
	
	getArrayFromXPathResult : function MTS_getArrayFromXPathResult(aXPathResult) 
	{
		if (!(aXPathResult instanceof Components.interfaces.nsIDOMXPathResult)) {
			aXPathResult = this.evaluateXPath.apply(this, arguments);
		}
		var max = aXPathResult.snapshotLength;
		var array = new Array(max);
		if (!max) return array;

		for (var i = 0; i < max; i++)
		{
			array[i] = aXPathResult.snapshotItem(i);
		}

		return array;
	},
  
	evalInSandbox : function MTS_evalInSandbox(aCode, aOwner) 
	{
		try {
			var sandbox = new Components.utils.Sandbox(aOwner || 'about:blank');
			return Components.utils.evalInSandbox(aCode, sandbox);
		}
		catch(e) {
		}
		return void(0);
	},
 
	get autoScroll() { return this.namespace.autoScroll; }, 
 
	get isToolbarCustomizing() 
	{
		var toolbox = window.gToolbox || window.gNavToolbox;
		return toolbox && toolbox.customizing;
	},
 
	// called with target(nsIDOMEventTarget), document(nsIDOMDocument), type(string) and data(object) 
	fireDataContainerEvent : function()
	{
		var target, document, type, data, canBubble, cancellable;
		for (let i = 0, maxi = arguments.length; i < maxi; i++)
		{
			let arg = arguments[i];
			if (typeof arg == 'boolean') {
				if (canBubble === void(0))
					canBubble = arg;
				else
					cancellable = arg;
			}
			else if (typeof arg == 'string')
				type = arg;
			else if (arg instanceof Ci.nsIDOMDocument)
				document = arg;
			else if (arg instanceof Ci.nsIDOMEventTarget)
				target = arg;
			else
				data = arg;
		}
		if (!target)
			target = document;
		if (!document)
			document = target.ownerDocument || target;

		var event = document.createEvent('DataContainerEvent');
		event.initEvent(type, canBubble, cancellable);
		var properties = Object.keys(data);
		for (let i = 0, maxi = properties.length; i < maxi; i++)
		{
			let property = properties[i];
			let value = data[property];
			event.setData(property, value);
			event[property] = value; // for backward compatibility
		}

		return target.dispatchEvent(event);
	},
 
// XPConnect 
	
	get SessionStore() { 
		if (!this._SessionStore) {
			this._SessionStore = Components.classes['@mozilla.org/browser/sessionstore;1'].getService(Components.interfaces.nsISessionStore);
		}
		return this._SessionStore;
	},
	_SessionStore : null,
 
	get IOService() 
	{
		if (!this._IOService) {
			this._IOService = Services.io;
		}
		return this._IOService;
	},
	_IOService : null,
 
	get PromptService() 
	{
		if (!this._PromptService) {
			this._PromptService = Services.prompt;
		}
		return this._PromptService;
	},
	_PromptService : null,
 
	get EffectiveTLD() 
	{
		if (!this._EffectiveTLD) {
			this._EffectiveTLD = Services.eTLD;
		}
		return this._EffectiveTLD;
	},
	_EffectiveTLD : null,
 
	get XULAppInfo()
	{
		if (!this._XULAppInfo) {
			this._XULAppInfo = Services.appinfo;
		}
		return this._XULAppInfo;
	},
	_XULAppInfo : null,
  
	get allowMoveMultipleTabs() 
	{
		return this.getPref('extensions.multipletab.tabdrag.moveMultipleTabs');
	},
 
	get browser() 
	{
		return gBrowser;
	},
 
	get bundle() { 
		if (!this._bundle) {
			this._bundle = document.getElementById('multipletab-bundle');
		}
		return this._bundle;
	},
	_bundle : null,
 
	get tabbrowserBundle() { 
		if (!this._tabbrowserBundle) {
			this._tabbrowserBundle = document.getElementById('multipletab-tabbrowserBundle');
		}
		return this._tabbrowserBundle;
	},
	_tabbrowserBundle : null,
 
	isVerticalTabBar : function(aTabBrowser)
	{
		aTabBrowser = this.getTabBrowserFromChild(aTabBrowser) || this.browser
		var box = aTabBrowser.mTabContainer.mTabstrip || aTabBrowser.mTabContainer ;
		return ((box.getAttribute('orient') || window.getComputedStyle(box, '').getPropertyValue('-moz-box-orient')) == 'vertical');
	},
 
// tabs 
	
	warnAboutClosingTabs : function MTS_warnAboutClosingTabs(aTabsCount) 
	{
		var warnPref = this.getPref('extensions.multipletab.warnOnCloseMultipleTabs');
		if (
			aTabsCount <= 1 ||
			warnPref == 0 ||
			(warnPref == -1 && !this.getPref('browser.tabs.warnOnClose'))
			)
			return true;
		var checked = { value: true };
		window.focus();
		var shouldClose = this.PromptService.confirmEx(window,
				this.tabbrowserBundle.getString('tabs.closeWarningTitle'),
				this.tabbrowserBundle.getFormattedString('tabs.closeWarningMultipleTabs', [aTabsCount]),
				(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_0) +
				(this.PromptService.BUTTON_TITLE_CANCEL * this.PromptService.BUTTON_POS_1),
				this.tabbrowserBundle.getString('tabs.closeButtonMultiple'),
				null, null,
				this.tabbrowserBundle.getString('tabs.closeWarningPromptMe'),
				checked
			) == 0;
		if (shouldClose && !checked.value) {
			if (warnPref == -1)
				this.setPref('browser.tabs.warnOnClose', false);
			else
				this.setPref('extensions.multipletab.warnOnCloseMultipleTabs', 0);
		}
		return shouldClose;
	},
 
	getIndexesFromTabs : function MTS_getIndexesFromTabs(aTabs) 
	{
		return Array.slice(aTabs)
				.map(function(aTab) {
					return aTab._tPos;
				})
				.sort();
	},
 
	sortTabs : function MTS_sortTabs(aTabs) 
	{
		return Array.slice(aTabs)
				.sort(function(aA, aB) {
					return aA._tPos - aB._tPos;
				});
	},
 
	getSelectedTabs : function MTS_getSelectedTabs(aSource) 
	{
		var dt;
		if (
			!aSource ||
			!(aSource instanceof Components.interfaces.nsIDOMEvent) ||
			!(dt = aSource.dataTransfer)
			)
			return this.getArrayFromXPathResult(
					'descendant::xul:tab[@'+this.kSELECTED+'="true" and not(@hidden="true")]',
					(aSource || this.browser).mTabContainer
				);

		return window['piro.sakura.ne.jp'].tabsDragUtils.getDraggedTabs(aSource);
	},
 
	getLastManuallySelectedTab : function MTS_getLastManuallySelectedTab(aTabBrowser) 
	{
		var b = aTabBrowser || this.browser;
		var selectedTabs = this.getSelectedTabs(b);
		if (!selectedTabs.length && this.implicitlySelect)
			return b.selectedTab;

		return this.lastManuallySelectedTab;
	},
 
	getReadyToCloseTabs : function MTS_getReadyToCloseTabs(aTabBrowser) 
	{
		return this.getArrayFromXPathResult(
				'descendant::xul:tab[@'+this.kREADY_TO_CLOSE+'="true" and not(@hidden="true")]',
				(aTabBrowser || this.browser).mTabContainer
			);
	},
 
	getLeftTabsOf : function MTS_getLeftTabsOf(aTab, aExcludePinnedTabs) 
	{
		var conditions = [
				'not(@hidden="true")'
			];
		if (aExcludePinnedTabs)
			conditions.push('not(@pinned="true")');
		return this.getArrayFromXPathResult(
				'preceding-sibling::xul:tab['+conditions.join(' and ')+']',
				aTab
			);
	},
 
	getRightTabsOf : function MTS_getRightTabsOf(aTab, aExcludePinnedTabs) 
	{
		var conditions = [
				'not(@hidden="true")'
			];
		if (aExcludePinnedTabs)
			conditions.push('not(@pinned="true")');
		return this.getArrayFromXPathResult(
				'following-sibling::xul:tab['+conditions.join(' and ')+']',
				aTab
			);
	},
 
	getSimilarTabsOf : function MTS_getSimilarTabsOf(aCurrentTab, aTabs) 
	{
		var resultTabs = [];
		if (!aCurrentTab) return resultTabs;

		if (!aTabs)
			aTabs = this.getTabsArray(this.getTabBrowserFromChild(aCurrentTab));

		try {
			var currentDomain = this.getDomainFromURI(this.getCurrentURIOfTab(aCurrentTab));
		}
		catch(e) {
			return resultTabs;
		}

		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			if (tab == aCurrentTab) continue;
			if (this.getDomainFromURI(this.getCurrentURIOfTab(tab)) == currentDomain)
				resultTabs.push(tab);
		}
		return resultTabs;
	},
	getDomainFromURI : function MTS_getDomainFromURI(aURI)
	{
		if (!aURI) return null;

		var str = aURI;
		if (aURI instanceof Ci.nsIURI)
			str = aURI.spec;
		else
			aURI = this.makeURIFromSpec(aURI);

		str = getShortcutOrURI(str);

		var userHomePart = this.getPref('extensions.multipletab.checkUserHost') ?
							str.match(/^\w+:\/\/[^\/]+(\/~[^\/]+)\//) :
							'' ;
		if (userHomePart) userHomePart = userHomePart[1];

		if (this.getPref('extensions.multipletab.useEffectiveTLD') && this.EffectiveTLD) {
			try {
				let domain = this.EffectiveTLD.getBaseDomain(aURI, 0);
				if (domain) return domain + userHomePart;
			}
			catch(e) {
			}
		}

		var domainMatchResult = str.match(/^\w+:(?:\/\/)?([^:\/]+)/);
		return domainMatchResult ?
				domainMatchResult[1] + userHomePart :
				null ;
	},
	makeURIFromSpec : function MTS_makeURIFromSpec(aURI)
	{
		var newURI;
		aURI = aURI || '';
		if (aURI && String(aURI).indexOf('file:') == 0) {
			var fileHandler = this.IOService
						.getProtocolHandler('file')
						.QueryInterface(Components.interfaces.nsIFileProtocolHandler);
			var tempLocalFile = fileHandler.getFileFromURLSpec(aURI);
			newURI = this.IOService.newFileURI(tempLocalFile);
		}
		else {
			newURI = this.IOService.newURI(aURI, null, null);
		}
		return newURI;
	},
 
	getTabFromEvent : function MTS_getTabFromEvent(aEvent, aReallyOnTab) 
	{
		var tab = this.evaluateXPath(
				'ancestor-or-self::xul:tab',
				aEvent.originalTarget || aEvent.target,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		if (tab || aReallyOnTab) return tab;

		var b = this.getTabBrowserFromChild(aEvent.originalTarget);
		if (b &&
			'treeStyleTab' in b &&
			'getTabFromTabbarEvent' in b.treeStyleTab) { // Tree Style Tab
			return b.treeStyleTab.getTabFromTabbarEvent(aEvent);
		}
		return null;
	},
 
	getTabFromChild : function MTS_getTabFromChild(aNode) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:tab',
				aNode,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getTabBrowserFromChild : function MTS_getTabBrowserFromChild(aTabBrowserChild) 
	{
		if (!aTabBrowserChild)
			return null;

		if (aTabBrowserChild.localName == 'tabbrowser') // itself
			return aTabBrowserChild;

		if (aTabBrowserChild.tabbrowser) // tabs, Firefox 4.0 or later
			return aTabBrowserChild.tabbrowser;

		if (aTabBrowserChild.id == 'TabsToolbar') // tabs toolbar, Firefox 4.0 or later
			return aTabBrowserChild.getElementsByTagName('tabs')[0].tabbrowser;

		// tab context menu on Firefox 4.0
		var popup = this.evaluateXPath(
				'ancestor-or-self::xul:menupopup[@id="tabContextMenu"]',
				aTabBrowserChild,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		if (popup && 'TabContextMenu' in window)
			return this.getTabBrowserFromChild(TabContextMenu.contextTab);

		var b = this.evaluateXPath(
				'ancestor-or-self::xul:tabbrowser | '+
				'ancestor-or-self::xul:tabs[@tabbrowser]',
				aTabBrowserChild,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		return (b && b.tabbrowser) || b;
	},
 
	getTabs : function MTS_getTabs(aTabBrowser) 
	{
		return this.evaluateXPath(
				'descendant::xul:tab[not(@hidden="true")]',
				aTabBrowser.mTabContainer
			);
	},
 
	getTabsArray : function MTS_getTabsArray(aTabBrowser) 
	{
		return this.getArrayFromXPathResult(this.getTabs(aTabBrowser));
	},
 
	getTabAt : function MTS_getTabAt(aIndex, aTabBrowser) 
	{
		if (aIndex < 0) return null;
		return this.evaluateXPath(
				'descendant::xul:tab['+(aIndex+1)+']',
				aTabBrowser.mTabContainer,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getNextTab : function MTS_getNextTab(aTab) 
	{
		return this.evaluateXPath(
				'following-sibling::xul:tab[not(@hidden="true")][1]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getPreviousTab : function MTS_getPreviousTab(aTab) 
	{
		return this.evaluateXPath(
				'preceding-sibling::xul:tab[not(@hidden="true")][1]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getTabsBetween : function MTS_getTabsBetween(aBase, aAnchor)
	{
		if (
			!aBase || !aBase.parentNode ||
			!aAnchor || !aAnchor.parentNode ||
			aBase == aAnchor ||
			aBase.parentNode != aAnchor.parentNode
			)
			return [];

		let firstTab = aBase._tPos < aAnchor._tPos ? aBase : aAnchor ;
		let lastTab = aBase._tPos < aAnchor._tPos ? aAnchor : aBase ;
		let browser = this.getTabBrowserFromChild(firstTab) || this.browser;
		return this.getTabsArray(browser)
				.filter(function(aTab) {
					return (
						aTab._tPos > firstTab._tPos &&
						aTab._tPos < lastTab._tPos
					);
				}, this);
	},
	
	// old method (for backward compatibility) 
	getTabBrowserFromChildren : function MTS_getTabBrowserFromChildren(aTab)
	{
		return this.getTabBrowserFromChild(aTab);
	},
  
	filterBlankTabs : function MTS_filterBlankTabs(aTabs) 
	{
		return aTabs.filter(function(aTab) {
				var uri = this.getCurrentURIOfTab(aTab).spec;
				return (window.isBlankPageURL ? !isBlankPageURL(uri) : (uri != 'about:blank')) ||
						// for BarTap ( https://addons.mozilla.org/firefox/addon/67651 )
						aTab.getAttribute('ontap') == 'true';
			}, this);
	},
 
	makeTabBlank : function MTS_makeTabBlank(aTab) 
	{
		var b = aTab.linkedBrowser;
		try {
			b.stop();
			if (b.sessionHistory)
				b.sessionHistory.PurgeHistory(b.sessionHistory.count);
		}
		catch(e) {
			dump(e+'\n');
		}
		if (b.contentWindow && b.contentWindow.location)
			b.contentWindow.location.replace('about:blank');

		delete aTab.linkedBrowser.__SS_data;
		delete aTab.__SS_extdata;
	},
 
	irrevocableRemoveTab : function MTS_irrevocableRemoveTab(aTab, aTabBrowser) 
	{
		// nsSessionStore.js doesn't save the tab to the undo cache
		// if the tab is completely blank.
		this.makeTabBlank(aTab);

		// override session data to prevent undo
		aTab.linkedBrowser.__SS_data = {
			entries : [],
			_tabStillLoading : true
		};

		(aTabBrowser || this.getTabBrowserFromChild(aTab))
			.removeTab(aTab, { animate : true });
	},
 
	ensureLoaded : function MTS_ensureLoaded(aTab) 
	{
		// for BarTap ( https://addons.mozilla.org/firefox/addon/67651 )
		if (
			aTab.getAttribute('ontap') == 'true' &&
			'BarTap' in window &&
			'loadTabContents' in BarTap
			) {
			BarTap.loadTabContents(aTab);
			return true;
		}
		return false;
	},
 
 	getCurrentURIOfTab : function MTS_getCurrentURIOfTab(aTab) 
	{
		var uri = window['piro.sakura.ne.jp'].tabsDragUtils.getCurrentURIOfTab(aTab);
		return this.makeURIFromSpec(uri);
	},
  
// bundled tabs 
	
	getBundledTabsOf : function MTS_getBundledTabsOf(aTab, aInfo) 
	{
		if (!aInfo) aInfo = {};
		aInfo.sourceWindow = null;
		aInfo.sourceBrowser = null;
		var tabs = [];

		var w, b;
		if (
			!aTab ||
			aTab.localName != 'tab' ||
			!(w = aTab.ownerDocument.defaultView) ||
			!('MultipleTabService' in w) ||
			!(b = w.MultipleTabService.getTabBrowserFromChild(aTab))
			)
			return tabs;

		aInfo.sourceWindow = w;
		aInfo.sourceBrowser = b;
		return w.MultipleTabService.getSelectedTabs(b);
	},
 
	rearrangeBundledTabsOf : function MTS_rearrangeBundledTabsOf() 
	{
		var baseTab,
			oldBasePosition = -1,
			tabs;
		for (let i = 0, maxi = arguments.length; i < maxi; i++)
		{
			let arg = arguments[i];
			if (arg instanceof Components.interfaces.nsIDOMNode)
				baseTab = arg;
			else if (typeof arg == 'number')
				oldBasePosition = arg;
			else if (typeof arg == 'object')
				tabs = arg;
		}

		var b       = this.getTabBrowserFromChild(baseTab);
		var allTabs = this.getTabsArray(b);
		if (!tabs || !tabs.length)
			tabs = this.getSelectedTabs(b);

		var otherTabs = tabs.filter(function(aTab) {
				return aTab != baseTab;
			});

		// step 1: calculate old positions of all tabs
		var oldTabs = allTabs.slice(0);
		if (oldBasePosition < 0) {
			let positionInTabs = tabs.indexOf(baseTab);
			if (positionInTabs < 0 || !tabs.length)
				throw 'original positions of tabs cannot be calculated.';

			oldTabs.splice(baseTab._tPos, 1);
			oldTabs.splice.apply(oldTabs, [oldTabs.indexOf(otherTabs[0]), otherTabs.length].concat(tabs));
		}
		else {
			oldTabs.splice(oldBasePosition, 0, oldTabs.splice(baseTab._tPos, 1)[0]);
		}

		// step 2: extract tabs which should be moved
		var movedTabs = oldTabs.filter(function(aTab) {
					return otherTabs.indexOf(aTab) > -1 || aTab == baseTab;
				});

		// step 3: simulate rearranging
		var rearranged = allTabs.filter(function(aTab) {
					return otherTabs.indexOf(aTab) < 0;
				});
		rearranged.splice.apply(rearranged, [rearranged.indexOf(baseTab), 1].concat(movedTabs));

		// step 4: rearrange target tabs by the result of simulation
		b.movingSelectedTabs = true;
		for (let i = 0, maxi = rearranged.length; i < maxi; i++)
		{
			let tab = rearranged[i];
			let newPosition = i;

			if (otherTabs.indexOf(tab) < 0) continue;

			let previousTab = newPosition > 0 ? rearranged[newPosition-1] : null ;
			if (previousTab)
				newPosition = previousTab._tPos + 1;
			if (newPosition > tab._tPos)
				newPosition--;
			if (tab._tPos != newPosition)
				b.moveTabTo(tab, newPosition);
		}
		b.movingSelectedTabs = false;
	},
 
	moveTabsByIndex : function MTS_moveTabsByIndex(aTabBrowser, aOldPositions, aNewPositions) 
	{
		// step 1: calculate new positions of all tabs
		var restOldPositions = [];
		var restNewPositions = [];
		var tabs = this.getTabsArray(aTabBrowser);
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			let tab = tabs[i];
			if (aOldPositions.indexOf(i) < 0)
				restOldPositions.push(i);
			if (aNewPositions.indexOf(i) < 0)
				restNewPositions.push(i);
		}

		// step 2: simulate rearranging
		var rearranged = tabs.map(function(aTab, aOldPosition) {
				var index = aNewPositions.indexOf(aOldPosition);
				return tabs[(index > -1) ?
						aOldPositions[index] :
						restOldPositions[restNewPositions.indexOf(aOldPosition)] ];
			});

		// step 3: rearrange target tabs by the result of simulation
		aTabBrowser.movingSelectedTabs = true;
		var allOldPositions = rearranged.map(function(aTab) {
			return aTab._tPos;
			});
		for (let i = 0, maxi = rearranged.length; i < maxi; i++)
		{
			let tab = rearranged[i];
			let newPosition = i;

			let index = aOldPositions.indexOf(allOldPositions[aNewPosition]);
			if (index < 0) continue; // it's not a target!
			newPosition = newPosition[index ];
			let previousTab = newPosition > 0 ? rearranged[newPosition-1] : null ;
			if (previousTab)
				newPosition = previousTab._tPos + 1;
			if (newPosition > tab._tPos)
				newPosition--;
			if (tab._tPos != newPosition)
				aTabBrowser.moveTabTo(tab, newPosition);
		}
		aTabBrowser.movingSelectedTabs = false;
	},
	
	getOriginalPositions : function MTS_getOriginalPositions(aTabs, aBaseTab, aOldBasePosition) 
	{
		var newBasePosition = aBaseTab._tPos;
		return aTabs.map(function(aTab) {
				if (aTab == aBaseTab)
					return aOldBasePosition;

				var position = aTab._tPos;
				if (position <= aOldBasePosition && position > newBasePosition)
					position--;
				else if (position >= aOldBasePosition && position < newBasePosition)
					position++;

				return position;
			})
			.sort();
	},
   
// events 
	
	isEventFiredOnTabIcon : function MTS_isEventFiredOnTabIcon(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ",@class," "), " tab-icon ")]',
				aEvent.originalTarget || aEvent.target,
				XPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	isEventFiredOnClickable : function MTS_isEventFiredOnClickable(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(" button toolbarbutton scrollbar popup menupopup tooltip ", concat(" ", local-name(), " "))]',
				aEvent.originalTarget || aEvent.target,
				XPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	isEventFiredOnCloseboxArea : function MTS_isEventFiredOnCloseboxArea(aEvent)
	{
		var tab = this.getTabFromEvent(aEvent);
		if (!tab)
			return false;

		var closebox = this.getCloseboxFromTab(tab);
		if (!closebox)
			return false;

		var box = closebox.boxObject;
		return (this.isVerticalTabBar(tab)) ?
			(aEvent.screenX >= box.screenX && aEvent.screenX <= box.screenX + box.width - 1 ) :
			(aEvent.screenY >= box.screenY && aEvent.screenY <= box.screenY + box.height - 1 ) ;
	},
 
	isOnElement : function MTS_isOnElement(aX, aY, aElement)
	{
		if (!aElement)
			return false;
		var box = aElement.boxObject;
		return (
			aX >= box.screenX && aX <= box.screenX + box.width - 1 &&
			aY >= box.screenY && aY <= box.screenY + box.height - 1
		);
	},
 
	getCloseboxFromEvent : function MTS_getCloseboxFromEvent(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ",@class," "), " tab-close-button ")]',
				aEvent.originalTarget || aEvent.target,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getCloseboxFromTab : function MTS_getCloseboxFromTab(aTab)
	{
		var finder = function(aNode) {
				if (aNode.localName == 'toolbarbutton' &&
					aNode.className.indexOf('tab-close-button') > -1)
					return aNode;

				var nodes = document.getAnonymousNodes(aNode) || aNode.childNodes;
				if (nodes) {
					for (let i = 0, maxi = nodes.length; i < maxi; i++)
					{
						let closebox = arguments.callee(nodes[i]);
						if (closebox)
							return closebox;
					}
				}
				return null;
			};
		return finder(aTab);
	},
 
	isAccelKeyPressed : function MTS_isAccelKeyPressed(aEvent) 
	{
		return this.XULAppInfo.OS == 'Darwin' ? aEvent.metaKey : aEvent.ctrlKey ;
	},
  
// fire custom events 
	
	fireDuplicatedEvent : function MTS_fireDuplicatedEvent(aNewTab, aSourceTab, aSourceEvent) 
	{
		var data = {
				sourceTab : aSourceTab,
				mayBeMove : aSourceEvent && !this.isAccelKeyPressed(aSourceEvent)
			};
		this.fireDataContainerEvent(this.kEVENT_TYPE_TAB_DUPLICATE, aNewTab, true, false, data);
		// for backward compatibility
		this.fireDataContainerEvent(this.kEVENT_TYPE_TAB_DUPLICATE.replace(/^nsDOM/, ''), aNewTab, true, false, data);
	},
 
	fireWindowMoveEvent : function MTS_fireWindowMoveEvent(aNewTab, aSourceTab) 
	{
		var data = {
				sourceTab : aSourceTab
			};
		this.fireDataContainerEvent(this.kEVENT_TYPE_WINDOW_MOVE, aNewTab, true, false, data);
		// for backward compatibility
		this.fireDataContainerEvent(this.kEVENT_TYPE_WINDOW_MOVE.replace(/^nsDOM/, ''), aNewTab, true, false, data);
	},
 
	fireTabsClosingEvent : function MTS_fireTabsClosingEvent(aTabs) 
	{
		if (!aTabs || !aTabs.length) return false;
		var b = this.getTabBrowserFromChild(aTabs[0]);
		var data = {
				tabs  : aTabs,
				count : aTabs.length
			};

		var canClose = (
			/* PUBLIC API */
			this.fireDataContainerEvent(this.kEVENT_TYPE_TABS_CLOSING, b, true, true, data) &&
			// for backward compatibility
			this.fireDataContainerEvent(this.kEVENT_TYPE_TABS_CLOSING.replace(/^nsDOM/, ''), b, true, true, data)
		);
		return canClose;
	},
 
	fireTabsClosedEvent : function MTS_fireTabsClosedEvent(aTabBrowser, aTabs) 
	{
		if (!aTabs || !aTabs.length) return false;
		aTabs = aTabs.filter(function(aTab) { return !aTab.parentNode; });
		var data = {
				tabs  : aTabs,
				count : aTabs.length
			};

		/* PUBLIC API */
		this.fireDataContainerEvent(this.kEVENT_TYPE_TABS_CLOSED, aTabBrowser, true, false, data);
		// for backward compatibility
		this.fireDataContainerEvent(this.kEVENT_TYPE_TABS_CLOSED.replace(/^nsDOM/, ''), aTabBrowser, true, false, data);
	},
  

  
/* Initializing */ 
	
	init : function MTS_init() 
	{
		if (!('gBrowser' in window)) return;

		this.applyPlatformDefaultPrefs();

		window.addEventListener('mouseup', this, true);

		window.removeEventListener('load', this, false);
		window.addEventListener('unload', this, false);
		window.addEventListener('tabviewshown', this, false);
		window.addEventListener('beforecustomization', this, true);
		window.addEventListener('aftercustomization', this, false);

		window.addEventListener('UIOperationHistoryPreUndo:TabbarOperations', this, false);
		window.addEventListener('UIOperationHistoryUndo:TabbarOperations', this, false);
		window.addEventListener('UIOperationHistoryRedo:TabbarOperations', this, false);
		window.addEventListener('UIOperationHistoryPostRedo:TabbarOperations', this, false);

		this.migratePrefs();
		this.addPrefListener(this);
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.tabdrag.mode');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.tabclick.accel.mode');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.tabclick.shift.mode');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.selectionStyle');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.implicitlySelectCurrentTab');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.clipboard.linefeed');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.clipboard.formats');

		if ('internalSave' in window) {
			eval('window.internalSave = '+window.internalSave.toSource().replace(
				'var useSaveDocument =',
				'if (aChosenData && "saveAsType" in aChosenData) {' +
				'  saveAsType = aChosenData.saveAsType;' +
				'  saveMode = SAVEMODE_FILEONLY | SAVEMODE_COMPLETE_TEXT;' +
				'}' +
				'$&'
			).replace(
				/(targetContentType: )(saveAsType == kSaveAsType_Text)/,
				'$1 (!aChosenData || "saveAsType" in aChosenData) && $2'
			));
		}

		let ids = [
				'tm-freezeTab\tmultipletab-selection-freezeTabs',
				'tm-protectTab\tmultipletab-selection-protectTabs',
				'tm-lockTab\tmultipletab-selection-lockTabs'
			];
		for (let i = 0, maxi = ids.length; i < maxi; i++)
		{
			let pair = ids[i].split('\t');
			let source = document.getElementById(pair[0]);
			let target = document.getElementById(pair[1]);
			if (source)
				target.setAttribute('label', source.getAttribute('label'));
		}

		this.initTabBrowser(gBrowser);

		this.overrideExtensionsOnInit(); // hacks.js

		window.setTimeout(function(aSelf) { aSelf.delayedInit(); }, 0, this);

		this.initialized = true;
	},
	
	preInit : function MTS_preInit() 
	{
		window.removeEventListener('DOMContentLoaded', this, false);

		var b = document.getElementById('content');
		if (b && 'swapBrowsersAndCloseOther' in b) {
			if ('gBrowserInit' in window && 'onLoad' in gBrowserInit) { // Firefox 16 and later (after https://bugzilla.mozilla.org/show_bug.cgi?id=731926 )
				eval('gBrowserInit.onLoad = '+gBrowserInit.onLoad.toSource().replace(
					'gBrowser.swapBrowsersAndCloseOther(gBrowser.selectedTab, uriToLoad);',
					'if (!MultipleTabService.tearOffSelectedTabsFromRemote()) { $& }'
				));
			}
			else if ('BrowserStartup' in window) { // legacy code for Firefox 15 and older
				eval('window.BrowserStartup = '+window.BrowserStartup.toSource().replace(
					'gBrowser.swapBrowsersAndCloseOther(gBrowser.selectedTab, uriToLoad);',
					'if (!MultipleTabService.tearOffSelectedTabsFromRemote()) { $& }'
				));
			}
		}

		this.overrideExtensionsOnPreInit(); // hacks.js
	},
 
	delayedInit : function MTS_delayedInit() 
	{
		this.overrideExtensionsOnDelayedInit(); // hacks.js
	},
 
	applyPlatformDefaultPrefs : function MTS_applyPlatformDefaultPrefs() 
	{
		var OS = this.XULAppInfo.OS;
		var processed = {};
		var originalKeys = this.getDescendant('extensions.multipletab.platform.'+OS);
		for (let i = 0, maxi = originalKeys.length; i < maxi; i++)
		{
			let originalKey = originalKeys[i];
			let key = originalKey.replace('platform.'+OS+'.', '');
			this.setDefaultPref(key, this.getPref(originalKey));
			processed[key] = true;
		}
		originalKeys = this.getDescendant('extensions.multipletab.platform.default');
		for (let i = 0, maxi = originalKeys.length; i < maxi; i++)
		{
			let originalKey = originalKeys[i];
			let key = originalKey.replace('platform.default.', '');
			if (!(key in processed))
				this.setDefaultPref(key, this.getPref(originalKey));
		}
	},
 
	kPREF_VERSION : 1,
	migratePrefs : function MTS_migratePrefs() 
	{
		switch (this.getPref('extensions.multipletab.prefsVersion') || 0)
		{
			case 0:
				var clickModeValue = this.getPref('extensions.multipletab.tabclick.mode');
				if (clickModeValue !== null) {
					this.setPref('extensions.multipletab.tabclick.accel.mode', clickModeValue);
				}
				this.clearPref('extensions.multipletab.tabclick.mode');
			default:
				break;
		}
		this.setPref('extensions.multipletab.prefsVersion', this.kPREF_VERSION);
	},
 
	initTabBrowser : function MTS_initTabBrowser(aTabBrowser) 
	{
		this.initTabbar(aTabBrowser);

		eval('aTabBrowser.duplicateTab = '+aTabBrowser.duplicateTab.toSource().replace(
			')',
			', aSourceEvent)'
		).replace(
			'{',
			'{ return MultipleTabService.onDuplicateTab(function() {'
		).replace(
			/(\}\)?)$/,
			'  },' +
			'  this,' +
			'  aTab,' +
			'  aSourceEvent' +
			');' +
			'$1'
		));

		if ('swapBrowsersAndCloseOther' in aTabBrowser) {
			aTabBrowser.__multipletab__canDoWindowMove = true;
		}
		else {
			aTabBrowser.__multipletab__canDoWindowMove = false;
		}

		window['piro.sakura.ne.jp'].tabsDragUtils.initTabBrowser(aTabBrowser);

		this.initTabBrowserContextMenu(aTabBrowser);

		var tabs = this.getTabsArray(aTabBrowser);
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.initTab(tabs[i]);
		}
	},
	
	initTabbar : function MTS_initTabbar(aTabBrowser) 
	{
		var tabContainer = aTabBrowser.mTabContainer;
		tabContainer.addEventListener('TabSelect', this, true);
		tabContainer.addEventListener('TabOpen',   this, true);
		tabContainer.addEventListener('TabClose',  this, true);
		tabContainer.addEventListener('TabMove',   this, true);
		tabContainer.addEventListener(this.kEVENT_TYPE_TAB_DUPLICATE, this, true);
		tabContainer.addEventListener(this.kEVENT_TYPE_WINDOW_MOVE,   this, true);

		// attach listener to a higher level element, to handle events before other listeners handle them.
		var strip = tabContainer.parentNode;
		strip.addEventListener('dragstart', this, true);
		strip.addEventListener('dragend',   this, true);
		strip.addEventListener('mousedown', this, true);
	},
 
	initTabBrowserContextMenu : function MTS_initTabBrowserContextMenu(aTabBrowser) 
	{
		var suffix = '-tabbrowser-'+(aTabBrowser.id || 'instance-'+parseInt(Math.random() * 65000));
		var tabContextMenu = aTabBrowser.tabContextMenu ||
							document.getAnonymousElementByAttribute(aTabBrowser, 'anonid', 'tabContextMenu');
		var template = document.getElementById(this.kCONTEXT_MENU_TEMPLATE);
		var items = this.getArrayFromXPathResult('child::*[starts-with(@id, "multipletab-context-")]', template)
					.concat(this.getArrayFromXPathResult('child::*[not(@id) or not(starts-with(@id, "multipletab-context-"))]', template))
		for (let i = 0, maxi = items.length; i < maxi; i++)
		{
			let item = items[i].cloneNode(true);
			if (item.getAttribute('id'))
				item.setAttribute('id', item.getAttribute('id')+suffix);

			let refNode = void(0);

			let insertAfter = item.getAttribute(this.kINSERT_AFTER);
			if (insertAfter) {
				try {
					if (/^\s*xpath:/i.test(insertAfter)) {
						refNode = this.evaluateXPath(
								insertAfter.replace(/^\s*xpath:\s*/i, ''),
								tabContextMenu,
								XPathResult.FIRST_ORDERED_NODE_TYPE
							).singleNodeValue;
						if (refNode) refNode = refNode.nextSibling;
					}
					else {
						eval('refNode = ('+insertAfter+').nextSibling');
					}
				}
				catch(e) {
				}
			}

			let insertBefore = item.getAttribute(this.kINSERT_BEFORE);
			if (refNode === void(0) && insertBefore) {
				try {
					if (/^\s*xpath:/i.test(insertBefore)) {
						refNode = this.evaluateXPath(
								insertBefore.replace(/^\s*xpath:\s*/i, ''),
								tabContextMenu,
								XPathResult.FIRST_ORDERED_NODE_TYPE
							).singleNodeValue;
					}
					else {
						eval('refNode = '+insertBefore);
					}
				}
				catch(e) {
				}
			}

			tabContextMenu.insertBefore(item, refNode || null);
		}

		tabContextMenu.addEventListener('popupshowing', this, false);
	},
  
	initTab : function MTS_initTab(aTab) 
	{
	},
 
	startListenWhileDragging : function MTS_startListenWhileDragging(aTab) 
	{
		if (this._listeningTabbar)
			return;

		var b = this.getTabBrowserFromChild(aTab);
		var tabContainer = b.mTabContainer;
		var strip = tabContainer.parentNode;
		this._listeningTabbar = strip;

		window.addEventListener('keypress', this, true);

		strip.addEventListener('mouseover', this, true);
		strip.addEventListener('mouseout',  this, true);
	},
	_listeningTabbar : null,

  
	destroy : function MTS_destroy() 
	{
		this.destroyTabBrowser(gBrowser);
		window.addEventListener('mouseup', this, true);

		window.removeEventListener('unload', this, false);
		window.removeEventListener('tabviewshown', this, false);
		window.removeEventListener('beforecustomization', this, true);
		window.removeEventListener('aftercustomization', this, false);
		window.removeEventListener('UIOperationHistoryPreUndo:TabbarOperations', this, false);
		window.removeEventListener('UIOperationHistoryUndo:TabbarOperations', this, false);
		window.removeEventListener('UIOperationHistoryRedo:TabbarOperations', this, false);
		window.removeEventListener('UIOperationHistoryPostRedo:TabbarOperations', this, false);

		this.endListenWhileDragging();

		this.removePrefListener(this);

		var tabs = this.getTabsArray(gBrowser);
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.destroyTab(tabs[i]);
		}
	},
	
	destroyTabBrowser : function MTS_destroyTabBrowser(aTabBrowser) 
	{
		this.destroyTabbar(aTabBrowser);

		var tabContextMenu = aTabBrowser.tabContextMenu ||
							document.getAnonymousElementByAttribute(aTabBrowser, 'anonid', 'tabContextMenu');
		tabContextMenu.removeEventListener('popupshowing', this, false);

		window['piro.sakura.ne.jp'].tabsDragUtils.destroyTabBrowser(aTabBrowser);
	},
 
	destroyTabbar : function MTS_destroyTabbar(aTabBrowser) 
	{
		var tabContainer = aTabBrowser.mTabContainer;
		tabContainer.removeEventListener('TabSelect', this, true);
		tabContainer.removeEventListener('TabOpen',   this, true);
		tabContainer.removeEventListener('TabClose',  this, true);
		tabContainer.removeEventListener('TabMove',   this, true);
		tabContainer.removeEventListener(this.kEVENT_TYPE_TAB_DUPLICATE, this, true);
		tabContainer.removeEventListener(this.kEVENT_TYPE_WINDOW_MOVE,   this, true);

		var strip = tabContainer.parentNode;
		strip.removeEventListener('dragstart', this, true);
		strip.removeEventListener('dragend',   this, true);
		strip.removeEventListener('mousedown', this, true);
	},
 
	destroyTab : function MTS_destroyTab(aTab) 
	{
		this.setSelection(aTab, false);
		if (!this.hasSelection())
			this.selectionModified = false;

		if (this.lastManuallySelectedTab == aTab)
			this.lastManuallySelectedTab = null;
	},
 
	endListenWhileDragging : function endListenWhileDragging() 
	{
		if (!this._listeningTabbar)
			return;

		window.removeEventListener('keypress', this, true);

		var strip = this._listeningTabbar;
		strip.removeEventListener('mouseover', this, true);
		strip.removeEventListener('mouseout',  this, true);

		this._listeningTabbar = null;
	},
   
/* Event Handling */ 
	
	handleEvent : function MTS_handleEvent(aEvent) 
	{
		var b;
		switch (aEvent.type)
		{
			case 'mousedown':
				this.lastMouseDownX = aEvent.screenX;
				this.lastMouseDownY = aEvent.screenY;
				this.onTabClick(aEvent);
				break;

			case 'dragstart':
				return this.onTabDragStart(aEvent);

			case 'mouseup':
				return this.onTabDragEnd(aEvent);

			case 'mouseover':
				return this.onTabDragOver(aEvent);

			case 'mouseout':
				return this.onTabDragExit(aEvent);

			case 'dragend':
				return this.onTabbarDragEnd(aEvent);

			// restart timer after the clicked tab was completely selected.
			case 'TabSelect':
				if (this.lastMouseDownEvent) {
					let event = this.lastMouseDownEvent;
					this.cancelDelayedDragStart();
					this.delayedDragStartTimer = window.setTimeout(function(aSelf) {
						aSelf.startDelayedDragStartTimer(event);
					}, 0, this);
				}
				return;

			case 'TabOpen':
				return this.onTabAdded(aEvent);

			case 'TabClose':
				return this.destroyTab(aEvent.originalTarget);

			case 'TabMove':
				b = this.getTabBrowserFromChild(aEvent.currentTarget);
				if (
					this.isSelected(aEvent.originalTarget) &&
					this.allowMoveMultipleTabs &&
					!b.movingSelectedTabs &&
					(!('UndoTabService' in window) || UndoTabService.isUndoable())
					)
					this.moveBundledTabsOf(aEvent.originalTarget, aEvent);
				break;

			case this.kEVENT_TYPE_TAB_DUPLICATE:
				b = this.getTabBrowserFromChild(aEvent.currentTarget);
				if (
					this.isSelected(aEvent.getData('sourceTab')) &&
					this.allowMoveMultipleTabs &&
					!b.duplicatingSelectedTabs &&
					(!('UndoTabService' in window) || UndoTabService.isUndoable())
					)
					this.duplicateBundledTabsOf(aEvent.originalTarget, aEvent.getData('sourceTab'), aEvent.getData('mayBeMove'));
				break;

			case this.kEVENT_TYPE_WINDOW_MOVE:
				b = this.getTabBrowserFromChild(aEvent.currentTarget);
				if (
					this.isSelected(aEvent.getData('sourceTab')) &&
					this.allowMoveMultipleTabs &&
					!b.duplicatingSelectedTabs &&
					(!('UndoTabService' in window) || UndoTabService.isUndoable())
					)
					this.importBundledTabsOf(aEvent.originalTarget, aEvent.getData('sourceTab'));
				break;

			case 'DOMContentLoaded':
				return this.preInit();

			case 'load':
				return this.init();

			case 'unload':
				return this.destroy();

			case 'tabviewshown':
				return this.clearSelection();

			// toolbar customizing on Firefox 4 or later
			case 'beforecustomization':
				this.toolbarCustomizing = true;
				return this.destroyTabbar(gBrowser);
			case 'aftercustomization':
				// Ignore it, because 'aftercustomization' fired not
				// following to 'beforecustomization' is invalid.
				// Personal Titlebar addon (or others) fires a fake
				// event on its startup process.
				if (!this.toolbarCustomizing) return;
				this.toolbarCustomizing = false;
				return this.initTabbar(gBrowser);

			case 'popupshowing':
				if (
					aEvent.target.id != this.kSELECTION_MENU &&
					this.hasSelection()
					) {
					this.showSelectionPopup({
						screenX : this.lastMouseDownX,
						screenY : this.lastMouseDownY,
						sourceEvent : aEvent
					});
					aEvent.preventDefault();
					aEvent.stopPropagation();
					return false;
				}
				this.enableMenuItems(aEvent.target);
				this.showHideMenuItems(aEvent.target);
				this.updateMenuItems(aEvent.target);
				break;

			case 'keypress':
				return this.onESCKeyPress(aEvent);


			case 'UIOperationHistoryPreUndo:TabbarOperations':
				switch (aEvent.entry.name)
				{
					case 'multipletab-tearOffTabs-our':
					case 'multipletab-tearOffTabs-remote':
						return this.onPreUndoTearOffTabsToNewWindow(aEvent);
				}
				break;

			case 'UIOperationHistoryUndo:TabbarOperations':
				switch (aEvent.entry.name)
				{
					case 'multipletab-duplicateTabs':
					case 'multipletab-closeTabs':
						this.restoreTabFocus(aEvent.entry.data, aEvent.entry.data.oldSelected);
						return;
					case 'multipletab-importBundledTabs-target':
					case 'multipletab-importBundledTabs-source':
					case 'multipletab-duplicateBundledTabs-source':
					case 'multipletab-duplicateBundledTabs-target':
						this.restoreTabPositions(aEvent.entry.data.source);
						return;
					case 'multipletab-tearOffTabs-our':
					case 'multipletab-tearOffTabs-remote':
						return this.onUndoTearOffTabsToNewWindow(aEvent);
				}
				break;

			case 'UIOperationHistoryRedo:TabbarOperations':
				switch (aEvent.entry.name)
				{
					case 'multipletab-tearOffTabs-our':
					case 'multipletab-tearOffTabs-remote':
						return this.onRedoTearOffTabsToNewWindow(aEvent);
				}
				break;

			case 'UIOperationHistoryPostRedo:TabbarOperations':
				switch (aEvent.entry.name)
				{
					case 'multipletab-duplicateTabs':
					case 'multipletab-closeTabs':
						this.restoreTabFocus(aEvent.entry.data, aEvent.entry.data.newSelected);
						return;
					case 'multipletab-importBundledTabs-target':
					case 'multipletab-importBundledTabs-source':
					case 'multipletab-duplicateBundledTabs-source':
					case 'multipletab-duplicateBundledTabs-target':
						this.restoreTabPositions(aEvent.entry.data.target);
						return;
					case 'multipletab-tearOffTabs-our':
					case 'multipletab-tearOffTabs-remote':
						return this.onPostRedoTearOffTabsToNewWindow(aEvent);
				}
				break;
		}
	},
	restoreTabFocus : function MTS_restoreSelectedTab(aData, aSelected)
	{
		if (!aData || !aSelected)
			return;

		var target = UndoTabService.getTabOpetarionTargetsBy(aData);
		if (!target.browser)
			return;

		var selected = UndoTabService.getTargetById(aSelected, target.browser.mTabContainer);
		if (selected)
			target.browser.selectedTab = selected;
	},
	restoreTabPositions : function MTS_restoreTabPositions(aData)
	{
		if (!aData)
			return;

		var target = UndoTabService.getTabOpetarionTargetsBy(aData);
		if (!target.browser || (target.tabs.length != aData.positions.length))
			return;

		this.moveTabsByIndex(
			target.browser,
			target.tabs.map(function(aTab) {
				return aTab._tPos;
			}),
			aData.positions
		);
	},
 
	onTabClick : function MTS_onTabClick(aEvent) 
	{
		if (aEvent.button != 0) return;

		var tab = this.getTabFromEvent(aEvent);
		if (tab) {
			let b = this.getTabBrowserFromChild(tab);
			if (aEvent.shiftKey) {
				if (this.tabShiftClickMode != this.TAB_CLICK_MODE_SELECT)
					return;

				let tabs = b.mTabContainer.childNodes;
				let lastManuallySelectedTab = this.getLastManuallySelectedTab(b);
				if (lastManuallySelectedTab) {
					/**
					 * If it is detected from tabbrowser.selectedTab,
					 * we have to save it as the manually selected tab.
					 */
					this.lastManuallySelectedTab = lastManuallySelectedTab;
					let inSelection = false;
					let clickedTab = tab;
					let tabs = this.getTabsArray(b);
					for (let i = 0, maxi = tabs.length; i < maxi; i++)
					{
						let tab = tabs[i];
						if (tab.getAttribute('hidden') == 'true' ||
							tab.getAttribute('collapsed') == 'true')
							continue;

						if (tab == lastManuallySelectedTab ||
							tab == clickedTab) {
							inSelection = !inSelection;
							this.setSelection(tab, true);
						}
						else {
							this.setSelection(tab, inSelection);
						}
					}
				}
				else {
					this.setSelection(tab, true);
					this.lastManuallySelectedTab = tab;
				}

				this.selectionChanging = true;

				aEvent.preventDefault();
				aEvent.stopPropagation();
				return;
			}
			else if (this.isAccelKeyPressed(aEvent)) {
				switch (this.tabAccelClickMode)
				{
					case this.TAB_CLICK_MODE_DEFAULT:
						return;

					case this.TAB_CLICK_MODE_SELECT:
						break;

					default:
					case this.TAB_CLICK_MODE_CLOSE:
						return b.removeTab(tab, { animate : true, byMouse : true });
				}

				let shouldSelectCurrentTab = (
						this.implicitlySelect &&
						!this.selectionModified &&
						!this.hasSelection()
					);

				this.toggleSelection(tab);

				if (shouldSelectCurrentTab)
					this.setSelection(b.selectedTab, true);

				if (this.isSelected(tab))
					this.lastManuallySelectedTab = tab;

				this.selectionChanging = true;

				aEvent.preventDefault();
				aEvent.stopPropagation();
				return;
			}
			else if (this.tabDragMode != this.TAB_DRAG_MODE_DEFAULT) {
				this.startDelayedDragStartTimer(aEvent);
			}
		}
		if (this.selectionModified && !this.hasSelection())
			this.selectionModified = false;

		if (
			(!tab && !this.isEventFiredOnClickable(aEvent)) ||
			(tab && !this.isSelected(tab)) ||
			!this.allowMoveMultipleTabs
			)
			this.clearSelection();
	},
	
	startDelayedDragStartTimer : function MTS_startDelayedDragStartTimer(aEvent) 
	{
		var tab = this.getTabFromEvent(aEvent);
		var delay = (
				tab &&
				(
					tab.mOverCloseButton ||
					tab.tmp_mOverCloseButton // Tab Mix Plus
				)
			) ? this.getPref('extensions.multipletab.tabdrag.close.delay') :
				this.getPref('extensions.multipletab.tabdrag.delay') ;
		if (delay > 0) {
			let unprocessedEvent = this.lastMouseDownEvent;
			this.cancelDelayedDragStart();
			this.lastMouseDown = Date.now();
			this.lastMouseDownEvent = aEvent || unprocessedEvent;
			this.delayedDragStartTimer = window.setTimeout(function(aSelf) {
				var event = aSelf.lastMouseDownEvent;
				aSelf.clearSelection();
				aSelf.tabDragging = false; // cancel "dragging" before we start to drag it really.
				aSelf.delayedDragStartReady = true;
				aSelf.onTabDragStart(event, true);
			}, delay, this);
		}
	},
	cancelDelayedDragStart : function MTS_cancelDelayedDragStart()
	{
		if (this.delayedDragStartTimer) {
			window.clearTimeout(this.delayedDragStartTimer);
			this.delayedDragStartTimer = null;
		}
		this.lastMouseDownEvent = null;
	},
	delayedDragStartTimer : null,
	lastMouseDownEvent : null,
  
	onTabDragStart : function MTS_onTabDragStart(aEvent, aIsTimeout) 
	{
		this.cancelDelayedDragStart();
		this.clearUndeterminedRange();

		if (this.isToolbarCustomizing)
			return false;

		var tab = this.getTabFromEvent(aEvent);
		if (!tab) {
			this.lastMouseOverTab = this.lastMouseOverTarget = null;
			// do nothing
			return false;
		}

		if (
			this.isEventFiredOnTabIcon(aEvent) ||
			this.tabDragMode == this.TAB_DRAG_MODE_DEFAULT
			) {
			// drag tabs
			return this.startTabsDrag(aEvent);
		}
		else if (
			(
				tab.mOverCloseButton ||
				tab.tmp_mOverCloseButton // Tab Mix Plus
			) &&
			this.isOnElement(this.lastMouseDownX, this.lastMouseDownY, this.getCloseboxFromTab(tab))
			) {
			let delay = this.getPref('extensions.multipletab.tabdrag.close.delay');
			if (
				delay > 0 &&
				(Date.now() - this.lastMouseDown < delay) &&
				!aIsTimeout
				) {
				// drag tabs
				return this.startTabsDrag(aEvent);
			}
			this.tabCloseboxDragging = true;
			this.lastMouseOverTarget = this.getCloseboxFromEvent(aEvent);
			this.lastMouseOverTab = tab;
			this.clearSelectionSub(this.getSelectedTabs(this.getTabBrowserFromChild(tab)), this.kSELECTED);
			this.setReadyToClose(tab, true);
			this.addTabInUndeterminedRange(tab);
			this.startListenWhileDragging(tab);
		}
		else {
			let delay = this.getPref('extensions.multipletab.tabdrag.delay');
			if (
				delay > 0 &&
				(Date.now() - this.lastMouseDown < delay) &&
				!aIsTimeout
				) {
				// drag tabs
				return this.startTabsDrag(aEvent);
			}
			this.tabDragging = true;
			this.delayedDragStartReady = false;
			this.lastMouseOverTab = this.lastMouseOverTarget = tab;
			if (this.tabDragMode == this.TAB_DRAG_MODE_SELECT) {
				this.setSelection(tab, true);
				this.addTabInUndeterminedRange(tab);
			}
			this.startListenWhileDragging(tab);
		}

		aEvent.preventDefault();
		aEvent.stopPropagation();
		return true;
	},
	tabDragging         : false,
	tabCloseboxDragging : false,
	lastMouseDown       : 0,
	firstMouseOverTarget : null,
	set lastMouseOverTarget(aTarget)
	{
		this._lastMouseOverTarget = aTarget;
		if (aTarget) {
			if (!this.firstMouseOverTarget)
				this.firstMouseOverTarget = aTarget;
		}
		else {
			this.firstMouseOverTarget = null;
		}
		return aTarget;
	},
	get lastMouseOverTarget()
	{
		return this._lastMouseOverTarget;
	},
	_lastMouseOverTarget : null,
	set lastMouseOverTab(aTarget)
	{
		this._lastMouseOverTab = aTarget;
		if (aTarget) {
			if (!this.firstMouseOverTab)
				this.firstMouseOverTab = aTarget;
		}
		else {
			this.firstMouseOverTab = null;
		}
		return aTarget;
	},
	get lastMouseOverTab()
	{
		return this._lastMouseOverTab;
	},
	_lastMouseOverTab : null,
	firstMouseOverTab : null,
 
	startTabsDrag : function MTS_startTabsDrag(aEvent) 
	{
		var movingTabs = this.getSelectedTabs();
		if (!movingTabs.length)
			return false;

		/* PUBLIC API */
		/* any addon can cancel Multiple Tab Handler's handling of tab draggings */
		var event = aEvent.originalTarget.ownerDocument.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_TABS_DRAG_START, true, true);
		var canDrag = aEvent.originalTarget.dispatchEvent(event);
		// for backward compatibility
		event = aEvent.originalTarget.ownerDocument.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_TABS_DRAG_START.replace(/^nsDOM/, ''), true, true);
		canDrag = canDrag && aEvent.originalTarget.dispatchEvent(event);
		if (!canDrag)
			return false;

		// for animation effect, we must collect selected tabs at first.
		if (window['piro.sakura.ne.jp'].tabsDragUtils.shouldAnimateDragggedTabs(aEvent)) {
			let focusedTab = this.getTabBrowserFromChild(movingTabs[0]).selectedTab;
			this.rearrangeBundledTabsOf(focusedTab, focusedTab._tPos, movingTabs);
		}

		window['piro.sakura.ne.jp'].tabsDragUtils.startTabsDrag(aEvent, movingTabs);
		return true;
	},
 
	onTabDragEnd : function MTS_onTabDragEnd(aEvent) 
	{
		this.cancelDelayedDragStart();
		this.clearUndeterminedRange();
		this.lastMouseOverTab = this.lastMouseOverTarget = null;
		this.endListenWhileDragging();

		if (this.isToolbarCustomizing)
			return;

		if (this.tabCloseboxDragging) {
			this.tabCloseboxDragging = false;
			this.closeTabs(this.getReadyToCloseTabs());
			this.clearSelection();
		}
		else if (this.delayedDragStartReady) {
			if (this.tabDragMode == this.TAB_DRAG_MODE_SELECT)
				this.clearSelection();
		}
		else if (this.tabDragging) {
			this.tabDragging = false;
			if (this.hasSelection()) {
				if (this.getPref('extensions.multipletab.tabdrag.autopopup'))
					this.showSelectionPopup(aEvent, this.getPref('extensions.multipletab.tabdrag.autoclear'));
			}
			else {
				this.clearSelection();
			}
		}
		else if (
			!this.selectionChanging &&
			this.getTabFromEvent(aEvent) &&
			aEvent.button == 0
			) {
			this.clearSelection();
		}
		this.delayedDragStartReady = false;
		this.selectionChanging = false;
	},
 
	onTabDragOver : function MTS_onTabDragOver(aEvent) 
	{
		if (
			!(
				this.tabDragging ||
				this.tabCloseboxDragging
			) ||
			this.isToolbarCustomizing
			)
			return;

		if (this.tabDragging || this.tabCloseboxDragging) {
			this.processAutoScroll(aEvent);
		}

		if (this.tabDragging) {
			this.cancelDelayedDragExit();

			let tab = this.getTabFromEvent(aEvent, true);
			if (tab == this.lastMouseOverTarget)
				return;

			if (tab) {
				switch(this.tabDragMode)
				{
					case this.TAB_DRAG_MODE_SELECT:
						this.toggleSelectionBetween({
							current : tab,
							last    : this.lastMouseOverTarget
						});
						break;

					case this.TAB_DRAG_MODE_SWITCH:
						var b = this.getTabBrowserFromChild(tab);
						b.selectedTab = tab;
						break;

					default:
						break;
				}
			}
			this.lastMouseOverTab = this.lastMouseOverTarget = tab;
		}
		else if (this.tabCloseboxDragging) {
			if (aEvent.originalTarget == this.lastMouseOverTarget)
				return;

			if (
				!this.isVerticalTabBar(aEvent.originalTarget) ||
				this.isEventFiredOnCloseboxArea(aEvent)
				)
				this.cancelDelayedDragExit();

			if (this.getCloseboxFromEvent(aEvent)) {
				let tab = this.getTabFromEvent(aEvent, true);
				this.toggleReadyToCloseBetween({
					current : tab,
					last    : this.lastMouseOverTab
				});
				this.lastMouseOverTab = tab;
			}
			this.lastMouseOverTarget = aEvent.originalTarget;
		}
	},
	processAutoScroll : function MTS_processAutoScroll(aEvent)
	{
		var b = this.getTabBrowserFromChild(aEvent.originalTarget) || this.browser;
		var arrowscrollbox = b.mTabContainer.mTabstrip;
		if (aEvent.originalTarget == document.getAnonymousElementByAttribute(arrowscrollbox, 'class', 'scrollbutton-up')) {
			arrowscrollbox._startScroll(-1);
		}
		else if (aEvent.originalTarget == document.getAnonymousElementByAttribute(arrowscrollbox, 'class', 'scrollbutton-down')) {
			arrowscrollbox._startScroll(1);
		}
		else {
			this.autoScroll.processAutoScroll(aEvent);
		}
	},
	toggleBetween : function MTS_toggleBetween(aTargets)
	{
		if (aTargets.first) {
			// At first, toggle state to reset all existing items in the undetermined selection.
			let tabs = this.getTabsInUndeterminedRange(aTargets.current);
			for (let i = 0, maxi = tabs.length; i < maxi; i++)
			{
				let tab = tabs[i];
				if (!this.isCollapsed(tab))
					aTargets.task(tab);
			}
			this.clearUndeterminedRange();

			let undeterminedRangeTabs = [aTargets.current];
			if (aTargets.first && aTargets.first != aTargets.current)
				undeterminedRangeTabs.push(aTargets.first);

			undeterminedRangeTabs = undeterminedRangeTabs.concat(this.getTabsBetween(aTargets.first, aTargets.current));
			for (let i = 0, maxi = undeterminedRangeTabs.length; i < maxi; i++)
			{
				let tab = undeterminedRangeTabs[i];
				if (!this.isCollapsed(tab))
					aTargets.task(tab);
				this.addTabInUndeterminedRange(tab);
			}
		}
		else {
			this.addTabInUndeterminedRange(aTargets.current);
			aTargets.task(aTargets.current);
		}
	},
	toggleSelectionBetween : function MTS_toggleSelectionBetween(aTargets)
	{
		var self = this;
		aTargets.task = function(aTab) {
			self.toggleSelection(aTab);
		};
		aTargets.first = this.firstMouseOverTarget;
		this.toggleBetween(aTargets);
	},
	toggleReadyToCloseBetween : function MTS_toggleReadyToCloseBetween(aTargets)
	{
		var self = this;
		aTargets.task = function(aTab) {
			self.toggleReadyToClose(aTab);
		};
		aTargets.first = this.firstMouseOverTab;
		this.toggleBetween(aTargets);
	},
 
	onTabDragExit : function MTS_onTabDragExit(aEvent) 
	{
		this.cancelDelayedDragExit();

		this._dragExitTimer = window.setTimeout(function(aSelf) {
			aSelf.lastMouseOverTab = aSelf.lastMouseOverTarget = null;
			aSelf.clearUndeterminedRange();
		}, 10, this);
	},
	cancelDelayedDragExit : function MTS_cancelDelayedDragExit()
	{
		if (this._dragExitTimer) {
			window.clearTimeout(this._dragExitTimer);
			this._dragExitTimer = null;
		}
	},
	_dragExitTimer : null,
 
	onTabbarDragEnd : function MTS_onTabbarDragEnd(aEvent) 
	{
		var dt = aEvent.dataTransfer;
		if (
			dt.mozUserCancelled ||
			dt.dropEffect != 'none'
			)
			return;

		var draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
		if (this.isDraggingAllTabs(draggedTab))
			aEvent.stopPropagation();
	},
 
	onTabAdded : function MTS_onTabAdded(aEvent) 
	{
		var tab = aEvent.originalTarget;
		this.initTab(tab);

		var session = Components
						.classes['@mozilla.org/widget/dragservice;1']
						.getService(Components.interfaces.nsIDragService)
						.getCurrentSession();
		var draggedTab = session && session.sourceNode ?
							this.getTabFromChild(session.sourceNode) :
							null ;
		if (draggedTab &&
			this.getTabBrowserFromChild(draggedTab) != this.getTabBrowserFromChild(tab)) {
			// this maybe a moving of tab from another window
			this.fireWindowMoveEvent(tab, draggedTab);
		}
	},
 
	// for drag and drop of selected tabs
	onDuplicateTab : function MTS_onDuplicateTab(aTask, aTabBrowser, aTab, aSourceEvent) 
	{
		if (
			!this.isSelected(aTab) ||
			!this.allowMoveMultipleTabs &&
			('UndoTabService' in window && UndoTabService.isUndoable())
			)
			return aTask.call(aTabBrowser);

		var b = this.getTabBrowserFromChild(aTab);
		if (b.duplicatingSelectedTabs)
			return aTask.call(aTabBrowser);

		var tabs = this.getBundledTabsOf(aTab);
		if (tabs.length <= 1)
			return aTask.call(aTabBrowser);

		var newTab;
		if ('UndoTabService' in window && UndoTabService.isUndoable()) {
			var self = this;
			UndoTabService.doOperation(
				function(aInfo) {
					newTab = aTask.call(aTabBrowser);
					self.fireDuplicatedEvent(newTab, aTab, aSourceEvent);
				},
				{
					name  : 'multipletab-duplicateTab',
					label : this.bundle.getFormattedString('undo_duplicateTabs_label', [tabs.length])
				}
			);
		}
		else {
			newTab = aTask.call(aTabBrowser);
			this.fireDuplicatedEvent(newTab, aTab, aSourceEvent);
		}
		return newTab;
	},
 
	onESCKeyPress : function MTS_onESCKeyPress(aEvent) 
	{
		if (aEvent.keyCode != aEvent.DOM_VK_ESCAPE)
			return;

		this.endListenWhileDragging();
		this.clearSelection();
		this.onTabDragEnd(aEvent);
	},
  
/* Popup */ 
	
	get tabSelectionPopup() { 
		if (!this._tabSelectionPopup) {
			this._tabSelectionPopup = document.getElementById(this.kSELECTION_MENU);
		}
		return this._tabSelectionPopup;
	},
	_tabSelectionPopup : null,
 
	showSelectionPopup : function MTS_showSelectionPopup(aEvent, aAutoClearSelection) 
	{
		var event = aEvent.sourceEvent || aEvent ;
		var popup = this.tabSelectionPopup;
		popup.hidePopup();
		popup.autoClearSelection = aAutoClearSelection;
		popup.openPopupAtScreen(
			aEvent.screenX,
			aEvent.screenY,
			true,
			event
		);
	},
 
	updateMenuItems : function MTS_updateMenuItems(aPopup) 
	{
		if (aPopup == this.tabSelectionPopup) {
			var lockedItem = document.getElementById('multipletab-selection-lockTabs');
			var protectItem = document.getElementById('multipletab-selection-protectTabs');
			var freezeItem = document.getElementById('multipletab-selection-freezeTabs');
			var tabs = this.getSelectedTabs();

			var locked = (lockedItem.getAttribute('hidden') == 'true') ?
						false :
						tabs.every(this._isTabLocked) ;
			var protected = (protectItem.getAttribute('hidden') == 'true') ?
						false :
						tabs.every(this._isTabProtected) ;
			var freezed = (freezeItem.getAttribute('hidden') == 'true') ?
						false :
						tabs.every(this._isTabFreezed) ;

			if (locked)
				lockedItem.setAttribute('checked', true);
			else
				lockedItem.removeAttribute('checked');

			if (protected)
				protectItem.setAttribute('checked', true);
			else
				protectItem.removeAttribute('checked');

			if (freezed)
				freezeItem.setAttribute('checked', true);
			else
				freezeItem.removeAttribute('checked');

			this.updateGroupsPopup(document.getElementById('multipletab-selection-moveToGroup-popup'));
		}
	},
 
	enableMenuItems : function MTS_enableMenuItems(aPopup) 
	{
		var tab = this.browser.mContextTab || this.browser.selectedTab;

		try {
			var removeLeft = document.evaluate(
					'descendant::xul:menuitem[starts-with(@id, "multipletab-context-removeLeftTabs")]',
					aPopup,
					this.NSResolver,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				).singleNodeValue;
			if (removeLeft) {
				if (this.getPreviousTab(tab))
					removeLeft.removeAttribute('disabled');
				else
					removeLeft.setAttribute('disabled', true);
			}
		}
		catch(e) {
		}

		try {
			var removeRight = document.evaluate(
					'descendant::xul:menuitem[starts-with(@id, "multipletab-context-removeRightTabs")]',
					aPopup,
					this.NSResolver,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				).singleNodeValue;
			if (removeRight) {
				if (this.getNextTab(tab))
					removeRight.removeAttribute('disabled');
				else
					removeRight.setAttribute('disabled', true);
			}
		}
		catch(e) {
		}
	},
 
	showHideMenuItems : function MTS_showHideMenuItems(aPopup) 
	{
		var b          = this.getTabBrowserFromChild(aPopup) || this.browser;
		var isVertical = this.isVerticalTabBar(b);

		var selectableItemsRegExp = new RegExp(
				'^(multipletab-(?:context|selection)-('+
				this.selectableItems.map(function(aItem) {
					return aItem.name;
				}).join('|')+
				'))(:select)?$'
			);

		var selectType = {};
		for (let i = 0, maxi = this.selectableItems.length; i < maxi; i++)
		{
			let item = this.selectableItems[i];
			selectType[item.name] = this.getPref(item.key) < 0;
		}

		var selectedTabs = this.getSelectedTabs(b);
		var tabbrowser = b;
		var tabs = this.getTabsArray(b);
		var nodes = aPopup.childNodes;
		for (let i = 0, maxi = nodes.length; i < maxi; i++)
		{
			let node = nodes[i];
			let label;
			if (
				(isVertical && (label = node.getAttribute('label-vertical'))) ||
				(!isVertical && (label = node.getAttribute('label-horizontal')))
				)
				node.setAttribute('label', label);

			let key = node.getAttribute('id').replace(/-tabbrowser-.*$/, '');
			let pref;
			if (selectableItemsRegExp.test(key)) {
				key  = RegExp.$1
				pref = this.getPref('extensions.multipletab.show.'+key) &&
						(Boolean(RegExp.$3) == selectType[RegExp.$2]);
			}
			else {
				pref = this.getPref('extensions.multipletab.show.'+key);
			}

			let available = node.getAttribute(this.kAVAILABLE);
			if (available) {
				/* tabbrowser
				   tabs
				   selectedTabs */
				eval('available = ('+available+')');
				if (pref) pref = !!available;
			}

			if (pref === null) continue;

			if (pref) {
				node.removeAttribute('hidden');
				let enabled = node.getAttribute(this.kENABLED);
				if (enabled) {
					/* tabbrowser
					   tabs
					   selectedTabs */
					eval('enabled = ('+enabled+')');
					if (enabled)
						node.removeAttribute('disabled');
					else
						node.setAttribute('disabled', true);
				}
			}
			else {
				node.setAttribute('hidden', true);
			}
		}

		var separators = this.getSeparators(aPopup);
		for (var i = separators.snapshotLength-1; i > -1; i--)
		{
			separators.snapshotItem(i).removeAttribute('hidden');
		}

		var separator;
		while (separator = this.getObsoleteSeparator(aPopup))
		{
			separator.setAttribute('hidden', true);
		}
	},
	
	getSeparators : function MTS_getSeparators(aPopup) 
	{
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:menuseparator',
					aPopup,
					this.NSResolver, // document.createNSResolver(document.documentElement),
					XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
					null
				);
		}
		catch(e) {
			return { snapshotLength : 0 };
		}
		return xpathResult;
	},
 
	getObsoleteSeparator : function MTS_getObsoleteSeparator(aPopup) 
	{
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:menuseparator[not(@hidden)][not(following-sibling::*[not(@hidden)]) or not(preceding-sibling::*[not(@hidden)]) or local-name(following-sibling::*[not(@hidden)]) = "menuseparator"]',
					aPopup,
					this.NSResolver, // document.createNSResolver(document.documentElement),
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				);
		}
		catch(e) {
			return null;
		}
		return xpathResult.singleNodeValue;
	},
  
	initCopyFormatItems : function MTS_initCopyFormatItems(aPopup) 
	{
		if (aPopup.formatsTimeStamp == this.formatsTimeStamp) return;

		aPopup.formatsTimeStamp = this.formatsTimeStamp;

		var separator = aPopup.getElementsByTagName('menuseparator')[0];
		var range = document.createRange();
		range.selectNodeContents(aPopup);
		range.setStartAfter(separator);
		range.deleteContents();
		if (this.formats.length) {
			separator.removeAttribute('hidden');
			let fragment = document.createDocumentFragment();
			for (let i = 0, maxi = this.formats.length; i < maxi; i++)
			{
				let format = this.formats[i];
				let item = document.createElement('menuitem');
				item.setAttribute('label', format.label);
				item.setAttribute('value', format.format);
				item.setAttribute('format-type', format.id);
				fragment.appendChild(item);
			}
			range.insertNode(fragment);
		}
		else {
			separator.setAttribute('hidden', true);
		}
		range.detach();
	},
  
/* Commands */ 
	
	closeTabs : function MTS_closeTabs(aTabs) 
	{
		if (!aTabs) return;

		if (!this.warnAboutClosingTabs(aTabs.length))
			return;

		this.closeTabsInternal(aTabs);
	},
	
	closeTabsInternal : function MTS_closeTabsInternal(aTabs) 
	{
		if (!aTabs.length) return;

		/* PUBLIC API */
		if (!this.fireTabsClosingEvent(aTabs))
			return;

		aTabs = this.sortTabs(aTabs);
		if (this.getPref('extensions.multipletab.close.direction') == this.CLOSE_DIRECTION_LAST_TO_START)
			aTabs.reverse();

		var w = aTabs[0].ownerDocument.defaultView;
		var b = this.getTabBrowserFromChild(aTabs[0]);
		var closeSelectedLast = this.getPref('extensions.multipletab.close.selectedTab.last');

		var self = this;
		var operation = function() {
			var selected;
			for (let i = 0, maxi = aTabs.length; i < maxi; i++)
			{
				let tab = aTabs[i];
				if (closeSelectedLast && tab.selected)
					selected = tab;
				else
					b.removeTab(tab, { animate : true });
			}
			if (selected)
				b.removeTab(selected, { animate : true });
		};

		w['piro.sakura.ne.jp'].stopRendering.stop();
		if ('UndoTabService' in window && UndoTabService.isUndoable()) {
			let data = UndoTabService.getTabOpetarionTargetsData({
					browser : b
					}, {
					oldSelected : UndoTabService.getId(b.selectedTab)
				});
			UndoTabService.doOperation(
				operation,
				{
					name  : 'multipletab-closeTabs',
					label : this.bundle.getFormattedString('undo_closeTabs_label', [aTabs.length]),
					data  : data
				}
			);
			data.newSelected = UndoTabService.getId(b.selectedTab);
		}
		else {
			operation();
		}
		w['piro.sakura.ne.jp'].stopRendering.start();

		/* PUBLIC API */
		this.fireTabsClosedEvent(b, aTabs);

		aTabs = null;
	},
	CLOSE_DIRECTION_START_TO_LAST : 0,
	CLOSE_DIRECTION_LAST_TO_START : 1,
  
	closeSimilarTabsOf : function MTS_closeSimilarTabsOf(aCurrentTab, aTabs, aIncludeCurrent) 
	{
		if (!aCurrentTab) return;

		var removeTabs = this.getSimilarTabsOf(aCurrentTab, aTabs);
		if (aIncludeCurrent) removeTabs.push(aCurrentTab);
		var count = removeTabs.length;
		if (!count || !this.warnAboutClosingTabs(count))
			return;

		var b = this.getTabBrowserFromChild(aCurrentTab);
		this.closeTabsInternal(removeTabs);
	},
 
	closeOtherTabs : function MTS_closeOtherTabs(aTabs) 
	{
		if (!aTabs || !aTabs.length) return;

		aTabs = Array.slice(aTabs);
		var b = this.getTabBrowserFromChild(aTabs[0]);
		var allTabs = this.getTabsArray(b);

		if (!this.warnAboutClosingTabs(allTabs.length - aTabs.length))
			return;

		var removeTabs = [];
		for (let i = 0, maxi = allTabs.length; i < maxi; i++)
		{
			let tab = allTabs[i];
			if (aTabs.indexOf(tab) < 0 && !tab.hasAttribute('pinned'))
				removeTabs.push(tab);
		}

		this.closeTabsInternal(removeTabs);
	},
 
	reloadTabs : function MTS_reloadTabs(aTabs) 
	{
		if (!aTabs) return;

		aTabs = this.filterBlankTabs(aTabs);
		if (!aTabs.length) return;

		var b = this.getTabBrowserFromChild(aTabs[0]);
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			if (!this.ensureLoaded(tab))
				b.reloadTab(tab);
		}
	},
 
	saveTabs : function MTS_saveTabs(aTabs, aSaveType, aFolder) 
	{
		if (!aTabs) return;

		aTabs = this.filterBlankTabs(aTabs);

		if (aSaveType === void(0)) {
			aSaveType = this.getPref('extensions.multipletab.saveTabs.saveType');
		}
		if (aSaveType < 0) {
			aSaveType = this.kSAVE_TYPE_FILE;
		}

		if (aTabs.length == 1) {
			this.ensureLoaded(aTabs[0]);
			var saveType = aSaveType;
			if (aSaveType & this.kSAVE_TYPE_TEXT &&
				!this.shouldConvertTabToText(aTabs[0], aSaveType)) {
				aSaveType = this.kSAVE_TYPE_COMPLETE;
			}
			this.saveOneTab(aTabs[0], null, aSaveType);
			return;
		}

		var folder = aFolder || this.selectFolder(this.bundle.getString('saveTabs_chooseFolderTitle'));
		if (!folder) return;

		var fileExistence = {};
		aTabs.forEach(function processTab(aTab) {
			if (this.ensureLoaded(aTab)) {
				window.setTimeout(function(aSelf) {
					processTab.call(aSelf, aTab);
				}, 200, this);
				return;
			}
			var b = aTab.linkedBrowser;
			var destFile = folder.clone();
			var uri = this.getCurrentURIOfTab(aTab);
			var shouldConvertToText = this.shouldConvertTabToText(aTab, aSaveType);
			var fileInfo = new FileInfo(aTab.label);
			initFileInfo(
				fileInfo,
				uri.spec,
				b.contentDocument.characterSet,
				b.contentDocument,
				(shouldConvertToText ? 'text/plain' : b.contentDocument.contentType ),
				null
			);
			var base = fileInfo.fileName;
			var extension = shouldConvertToText ? '.txt' : '.'+fileInfo.fileExt ;
			if (base.indexOf(extension) == base.length - extension.length) {
				base = base.substring(0, base.length - extension.length);
			}
			var fileName = '';
			var count = 2;
			var existingFile;
			do {
				fileName = fileName ? base+'('+(count++)+')'+extension : base+extension ;
				destFile = folder.clone();
				destFile.append(fileName);
			}
			while (destFile.exists() || destFile.path in fileExistence);
			fileExistence[destFile.path] = true;
			var saveType = aSaveType;
			if (saveType & this.kSAVE_TYPE_TEXT && !shouldConvertToText) {
				saveType = this.kSAVE_TYPE_COMPLETE;
			}
			window.setTimeout(function(aSelf) {
				aSelf.saveOneTab(aTab, destFile, saveType);
			}, 200, this);
		}, this);
	},
	
	kSAVE_TYPE_FILE     : 0, 
	kSAVE_TYPE_COMPLETE : 1,
	kSAVE_TYPE_TEXT     : 2,
 
	shouldConvertTabToText : function MTS_shouldConvertTabToText(aTab, aSaveType) 
	{
		return(
			aSaveType == this.kSAVE_TYPE_TEXT &&
			GetSaveModeForContentType(aTab.linkedBrowser.contentDocument.contentType, aTab.linkedBrowser.contentDocument) & SAVEMODE_COMPLETE_TEXT
		);
	},
 
	selectFolder : function MTS_selectFolder(aTitle) 
	{
		var picker = Components
						.classes['@mozilla.org/filepicker;1']
						.createInstance(Components.interfaces.nsIFilePicker);
		picker.init(window, aTitle, picker.modeGetFolder);
		var downloadDir = this.getPref('browser.download.dir', Components.interfaces.nsILocalFile);
		if (downloadDir) picker.displayDirectory = downloadDir;
		picker.appendFilters(picker.filterAll);
		if (picker.show() == picker.returnOK) {
			return picker.file.QueryInterface(Components.interfaces.nsILocalFile);
		}
		return null;
	},
 
	saveOneTab : function MTS_saveOneTab(aTab, aDestFile, aSaveType) 
	{
		var b = aTab.linkedBrowser;
		var uri = this.getCurrentURIOfTab(aTab);

		var autoChosen = aDestFile ? new AutoChosen(aDestFile, uri) : null ;
		if (autoChosen && aSaveType == this.kSAVE_TYPE_TEXT) {
			autoChosen.saveAsType = kSaveAsType_Text;
		}

		internalSave(
			uri.spec,
			(aSaveType != this.kSAVE_TYPE_FILE ? b.contentDocument : null ),
			null, // default file name
			null, // content disposition
			b.contentDocument.contentType,
			false, // should bypass cache?
			null, // title of picker
			autoChosen,
			b.referringURI, // referrer
			true, // skip prompt?
			null // cache key
		);
	},
  
	addBookmarkFor : function MTS_addBookmarkFor(aTabs, aFolderName) 
	{
		var isTSTBookmarksTreeStructureAvailable = (
				'TreeStyleTabBookmarksService' in window &&
				'beginAddBookmarksFromTabs' in TreeStyleTabBookmarksService &&
				'endAddBookmarksFromTabs' in TreeStyleTabBookmarksService
			);
		if (isTSTBookmarksTreeStructureAvailable)
			TreeStyleTabBookmarksService.beginAddBookmarksFromTabs(aTabs);
		try {
			window['piro.sakura.ne.jp'].bookmarkMultipleTabs.addBookmarkFor(aTabs, aFolderName);
		}
		catch(e) {
		}
		if (isTSTBookmarksTreeStructureAvailable)
			TreeStyleTabBookmarksService.endAddBookmarksFromTabs();
	},
 
	printTabs : function MTS_printTabs(aTabs) 
	{
		if (!('PrintAllTabs' in window)) return;

		aTabs.forEach(this.ensureLoaded, this);

		PrintAllTabs.__multipletab__printNodes = aTabs.map(function(aTab) {
			return aTab._tPos;
		});
		PrintAllTabs.onMenuItemCommand(null, false, false);
		PrintAllTabs.__multipletab__printNodes = null;
	},
 
	duplicateTabs : function MTS_duplicateTabs(aTabs) 
	{
		if (!aTabs || !aTabs.length) return [];

		var b = this.getTabBrowserFromChild(aTabs[0]);
		var w = b.ownerDocument.defaultView;
		var shouldSelectAfter = this.getPref('extensions.multipletab.selectAfter.duplicate');
		var duplicatedTabs;

		var self = this;
		var operation = function() {
			duplicatedTabs = self.duplicateTabsInternal(b, aTabs);
			if (shouldSelectAfter) {
				for (let i = 0, maxi = duplicatedTabs.length; i < maxi; i++)
				{
					let tab = duplicatedTabs[i];
					self.setSelection(tab, true);
				}
			}
		};
		w['piro.sakura.ne.jp'].stopRendering.stop();
		if ('UndoTabService' in window && UndoTabService.isUndoable()) {
			let data = UndoTabService.getTabOpetarionTargetsData({
					browser : b
					}, {
					oldSelected : UndoTabService.getId(b.selectedTab)
				});
			UndoTabService.doOperation(
				operation,
				{
					name  : 'multipletab-duplicateTabs',
					label : this.bundle.getFormattedString('undo_duplicateTabs_label', [aTabs.length]),
					data  : data
				}
			);
			data.newSelected = UndoTabService.getId(b.selectedTab);
		}
		else {
			operation();
		}
		w['piro.sakura.ne.jp'].stopRendering.start();

		return duplicatedTabs;
	},
	
	duplicateTabsInternal : function MTS_duplicateTabsInternal(aTabBrowser, aTabs) 
	{
		var max = aTabs.length;
		if (!max) return [];

		aTabs = this.sortTabs(aTabs);

		aTabs.forEach(this.ensureLoaded, this);

		var b = aTabBrowser;
		var w = b.ownerDocument.defaultView;
		var selectedIndex = aTabs.indexOf(b.selectedTab);

		this.duplicatingTabs = true;

		w['piro.sakura.ne.jp'].stopRendering.stop();

		this.clearSelection(b);

		var duplicatedTabs = aTabs.map(function(aTab) {
				var state = this.evalInSandbox('('+this.SessionStore.getTabState(aTab)+')');
				for (let i = 0, maxi = this._clearTabValueKeys.length; i < maxi; i++)
				{
					delete state.extData[this._clearTabValueKeys[i]];
				}
				state = 'JSON' in window ? JSON.stringify(state) : state.toSource() ;
				var tab = b.addTab();
				this.SessionStore.setTabState(tab, state);
				return tab;
			}, this);

		this.clearSelection(b);

		if (selectedIndex > -1)
			b.selectedTab = duplicatedTabs[selectedIndex];

		w['piro.sakura.ne.jp'].stopRendering.start();

		w.setTimeout(function(aSelf) {
			aSelf.duplicatingTabs = false;
		}, 0, this);

		return duplicatedTabs;
	},
  
	splitWindowFromTabs : function MTS_splitWindowFromTabs(aTabs, aRemoteWindow) 
	{
		if (!aTabs || !aTabs.length) return null;

		aTabs.forEach(this.ensureLoaded, this);

		var b = this.getTabBrowserFromChild(aTabs[0]);

		if (!aRemoteWindow) {
			let self = this;
			aRemoteWindow = window.openDialog(location.href, '_blank', 'chrome,all,dialog=no', 'about:blank');
			aRemoteWindow.addEventListener('load', function() {
				aRemoteWindow.removeEventListener('load', arguments.callee, false);
				aRemoteWindow.setTimeout(function() {
					self.tearOffTabsToNewWindow(aTabs, aRemoteWindow);
				}, 0);
			}, false);
		}
		else {
			this.tearOffTabsToNewWindow(aTabs, aRemoteWindow);
		}

		return aRemoteWindow;
	},
	
	tearOffTabsToNewWindow : function MTS_tearOffTabsToNewWindow(aTabs, aRemoteWindow) 
	{
		var ourBrowser    = this.getTabBrowserFromChild(aTabs[0]);
		var ourWindow     = ourBrowser.ownerDocument.defaultView;
		var remoteBrowser = aRemoteWindow.gBrowser;
		var ourService    = ourWindow.MultipleTabService;
		var remoteService = aRemoteWindow.MultipleTabService;

		var selectAfter = this.getPref('extensions.multipletab.selectAfter.move');

		var operation = function(aOurParams, aRemoteParams, aData) {
				var allSelected = true;
				var selectionState = aTabs.map(function(aTab) {
						var selected = ourService.isSelected(aTab);
						if (!selected) allSelected = false;
						return selected;
					});

				remoteService.duplicatingTabs = true;
				aRemoteWindow['piro.sakura.ne.jp'].stopRendering.stop();

				if (aOurParams)
					aOurParams.wait();
				if (aRemoteParams)
					aRemoteParams.wait();

				aRemoteWindow.setTimeout(function() {
					var remoteBrowser = aRemoteWindow.gBrowser;
					var importedTabs = remoteService.importTabsTo(aTabs, remoteBrowser);
					remoteService.clearSelection(remoteBrowser);
					var tabs = remoteService.getTabsArray(remoteBrowser);
					for (let i = 0, maxi = tabs.length; i < maxi; i++)
					{
						let tab = tabs[i];
						let index = importedTabs.indexOf(tab);
						if (index > -1) {
							if (
								!allSelected &&
								selectionState[index] &&
								selectAfter
								) {
								remoteService.setSelection(tab, true);
							}
						}
						else {
							// causes error. why?
							// remoteService.irrevocableRemoveTab(tab, remoteBrowser);
							remoteBrowser.removeTab(tab, { animate : true });
						}
					}
					aRemoteWindow['piro.sakura.ne.jp'].stopRendering.start();

					if (aData) {
						aData.remote.positions = [];
						aData.remote.tabs = importedTabs.map(function(aTab) {
							aData.remote.positions.push(aTab._tPos);
							return aRemoteWindow.UndoTabService.getId(aTab);
						});
					}
					if (aOurParams)
						aOurParams.continue();
					if (aRemoteParams)
						aRemoteParams.continue();
				}, 0);
			};

		if ('UndoTabService' in window && UndoTabService.isUndoable()) {
			let data = {
					our : UndoTabService.getTabOpetarionTargetsData({
						window  : ourWindow,
						browser : ourBrowser,
						tabs    : aTabs
						}, {
						selected  : UndoTabService.getId(ourBrowser.selectedTab),
						positions : aTabs.map(function(aTab) {
							return aTab._tPos;
						})
					}),
					remote : UndoTabService.getTabOpetarionTargetsData({
						window  : aRemoteWindow,
						browser : remoteBrowser
						}, {
						width  : aRemoteWindow.outerWidth,
						height : aRemoteWindow.outerHeight,
						x      : aRemoteWindow.screenX,
						y      : aRemoteWindow.screenY
					})
				};
			data.our.entry = {
				name  : 'multipletab-tearOffTabs-our',
				label : this.bundle.getFormattedString('undo_splitWindowFromTabs_label', [aTabs.length]),
				data  : data
			};
			data.remote.entry = {
				name  : 'multipletab-tearOffTabs-remote',
				label : this.bundle.getFormattedString('undo_splitWindowFromTabs_label', [aTabs.length]),
				data  : data
			};
			UndoTabService.doOperation(
				function(aOurParams) {
					UndoTabService.doOperation(
						function(aRemoteParams) {
							operation(aOurParams, aRemoteParams, data);
						},
						aRemoteWindow,
						data.remote.entry
					);
				},
				ourWindow,
				data.our.entry
			);
		}
		else {
			operation();
		}

		return aRemoteWindow;
	},
	onPreUndoTearOffTabsToNewWindow : function MTS_onPreUndoTearOffTabsToNewWindow(aEvent)
	{
		var remote = UndoTabService.getTabOpetarionTargetsBy(aEvent.entry.data.remote);
		if (!remote.window || !remote.browser)
			return;

		remote.browser.addTab('about:blank'); // to prevent browser's auto-close

		data.remote.width  = remote.window.outerWidth;
		data.remote.height = remote.window.outerHeight;
		data.remote.x      = remote.window.screenX;
		data.remote.y      = remote.window.screenY;
	},
	onUndoTearOffTabsToNewWindow : function MTS_onUndoTearOffTabsToNewWindow(aEvent)
	{
		var entry  = aEvent.entry;
		var data   = entry.data;
		var our    = UndoTabService.getTabOpetarionTargetsBy(data.our);
		var remote = UndoTabService.getTabOpetarionTargetsBy(data.remote);
		if (!our.window || !remote.window)
			return aEvent.preventDefault();

		var tabs = our.tabs;
		if (entry == data.remote.entry) {
			if (remote.tabs.length == data.remote.tabs.length) {
				tabs = remote.window.MultipleTabService.importTabsTo(remote.tabs, our.browser);
			}
			UndoTabService.fakeUndo(our.window, data.our.entry);
		}

		if (tabs.length == data.our.tabs.length) {
			this.moveTabsByIndex(
				our.browser,
				tabs.map(function(aTab, aIndex) {
					UndoTabService.setElementId(aTab, data.our.tabs[aIndex]);
					return aTab._tPos;
				}),
				data.our.positions
			);
		}

		var selected = UndoTabService.getTargetById(data.our.selected, data.our.browser.mTabContainer);
		if (selected)
			our.browser.selectedTab = selected;

		if (remote.browser)
			this.closeOwner(remote.browser);
	},
	onRedoTearOffTabsToNewWindow : function MTS_onRedoTearOffTabsToNewWindow(aEvent)
	{
		var entry  = aEvent.entry;
		var data   = entry.data;
		var remote = UndoTabService.getTabOpetarionTargetsBy(data.remote);

		// When the window was already reopened by other redo processes,
		// then use it.
		if (remote.window) {
			remote.window.resizeTo(data.remote.width, data.remote.height);
			remote.window.moveTo(data.remote.x, data.remote.y);
			return;
		}

		aEvent.wait();
		var remoteWindow = window.openDialog(location.href, '_blank', 'chrome,all,dialog=no', 'about:blank');
		remoteWindow.addEventListener('load', function() {
			remoteWindow.removeEventListener('load', arguments.callee, false);
			data.remote.window = UndoTabService.setWindowId(remoteWindow, data.remote.window);
			remoteWindow.resizeTo(data.remote.width, data.remote.height);
			remoteWindow.moveTo(data.remote.x, data.remote.y);
			data.remote.browser = UndoTabService.setElementId(remoteWindow.gBrowser, data.remote.browser);
			remoteWindow.setTimeout(function() {
				aEvent.continue();
			}, 0);
		}, false);
	},
	onPostRedoTearOffTabsToNewWindow : function MTS_onPostRedoTearOffTabsToNewWindow(aEvent)
	{
		var entry  = aEvent.entry;
		var data   = entry.data;
		var remote = UndoTabService.getTabOpetarionTargetsBy(data.remote);
		if (!remote.window)
			return aEvent.preventDefault();

		if (remote.tabs.length == data.remote.tabs.length) {
			remote.window['piro.sakura.ne.jp'].stopRendering.start();
			remote.window.MultipleTabService.getTabsArray(remote.browser)
				.some(function(aTab) {
					if (remote.tabs.indexOf(aTab) > -1)
						return false;
					// remote.window.MultipleTabService.irrevocableRemoveTab(aTab, remote.browser);
					remote.browser.removeTab(aTab, { animate : true });
					return true;
				});
			this.moveTabsByIndex(
				remote.browser,
				remote.tabs.map(function(aTab, aIndex) {
					return aTab._tPos;
				}),
				data.remote.positions
			);
			remote.window['piro.sakura.ne.jp'].stopRendering.start();
		}

		remote.window.setTimeout(function() {
			remote.window.UndoTabService.addEntry(remote.window, data.remote.entry);
			remote.window.UndoTabService.fakeRedo(remote.window, data.remote.entry);
		}, 250);
	},
 
	splitWindowFrom : function MTS_splitWindowFrom(aTabs) // old name, for backward compatibility 
	{
		return this.splitWindowFromTabs(aTabs);
	},
  
	importTabsTo : function MTS_importTabsTo() 
	{
		var aTabs = [],
			aTabBrowser,
			aClone;
		for (let i = 0, maxi = arguments.length; i < maxi; i++)
		{
			let arg = arguments[i];
			if (typeof arg == 'boolean') {
				aClone = arg;
			}
			else if (!arg) {
				continue;
			}
			else if (arg instanceof Components.interfaces.nsIDOMNode) {
				if (arg.localName == 'tabbrowser')
					aTabBrowser = arg;
				else if (arg.localName == 'tab')
					aTabs.push(arg);
			}
			else if (typeof arg == 'object') {
				aTabs = aTabs.concat(arg);
			}
		}

		var importedTabs = [];
		if (!aTabs.length)
			return importedTabs;

		aTabs.forEach(this.ensureLoaded, this);

		this.duplicatingTabs = true;

		var targetBrowser = aTabBrowser || this.browser;
		var targetWindow  = targetBrowser.ownerDocument.defaultView;
		var sourceWindow  = aTabs[0].ownerDocument.defaultView;
		var sourceService = sourceWindow.MultipleTabService;
		var sourceBrowser = sourceService.getTabBrowserFromChild(aTabs[0]);

		targetWindow['piro.sakura.ne.jp'].stopRendering.stop();
		sourceWindow['piro.sakura.ne.jp'].stopRendering.stop();

		if (targetBrowser.__multipletab__canDoWindowMove && !aClone) {// move tabs
			for (let i = 0, maxi = aTabs.length; i < maxi; i++)
			{
				let tab = aTabs[i];
				let newTab = targetBrowser.addTab();
				importedTabs.push(newTab);
				newTab.linkedBrowser.stop();
				newTab.linkedBrowser.docShell;
				targetBrowser.swapBrowsersAndCloseOther(newTab, tab);
				targetBrowser.setTabTitle(newTab);
				for (let i = 0, maxi = this._duplicatedTabPostProcesses.length; i < maxi; i++)
				{
					let process = this._duplicatedTabPostProcesses[i];
					process(newTab, newTab._tPos);
				}
			}
		}
		else { // duplicate tabs
			for (let i = 0, maxi = aTabs.length; i < maxi; i++)
			{
				let tab = aTabs[i];
				let newTab = targetBrowser.duplicateTab(tab);
				importedTabs.push(newTab);
				for (let i = 0, maxi = this._duplicatedTabPostProcesses.length; i < maxi; i++)
				{
					let process = this._duplicatedTabPostProcesses[i];
					process(newTab, newTab._tPos);
				}
				if (!aClone) {
					sourceService.irrevocableRemoveTab(tab, sourceBrowser);
				}
			}
		}

		targetWindow['piro.sakura.ne.jp'].stopRendering.start();
		sourceWindow['piro.sakura.ne.jp'].stopRendering.start();

		this.duplicatingTabs = false;

		return importedTabs;
	},
 
	registerClearTabValueKey : function MTS_registerClearTabValueKey(aKey) 
	{
		this._clearTabValueKeys.push(aKey);
	},
	_clearTabValueKeys : [],
 
	registerDuplicatedTabPostProcess : function MTS_registerDuplicatedTabPostProcess(aProcess) 
	{
		this._duplicatedTabPostProcesses.push(aProcess);
	},
	_duplicatedTabPostProcesses : [],
 
	copyURIsToClipboard : function MTS_copyURIsToClipboard(aTabs, aFormatType, aFormat) 
	{
		if (!aTabs) return;
		var string = this.formatURIsForClipboard(aTabs, aFormatType, aFormat);
		Components
			.classes['@mozilla.org/widget/clipboardhelper;1']
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyString(string);
	},
	formatURIsForClipboard : function MTS_formatURIsForClipboard(aTabs, aFormatType, aFormat)
	{
		if (!aTabs) return '';

		if (aTabs instanceof Components.interfaces.nsIDOMNode) aTabs = [aTabs];

		aTabs.forEach(this.ensureLoaded, this);

		var format = aFormat || this.getClopboardFormatForType(aFormatType);
		if (!format) format = '%URL%';

		var now = new Date();
		var timeUTC = now.toUTCString();
		var timeLocal = now.toLocaleString();

		var stringToCopy = Array.slice(aTabs).map(function(aTab) {
				let uri = this.getCurrentURIOfTab(aTab).spec;
				let doc = aTab.linkedBrowser.contentDocument;
				let title = doc.title || aTab.getAttribute('label');
				let author = this._getMetaInfo(doc, 'author');
				let description = this._getMetaInfo(doc, 'description');
				let keywords = this._getMetaInfo(doc, 'keywords');
				return format
						.replace(/%(?:RLINK|RLINK_HTML(?:IFIED)?|SEL|SEL_HTML(?:IFIED)?)%/gi, '')
						.replace(/%URL%/gi, uri)
						.replace(/%(?:TITLE|TEXT)%/gi, title)
						.replace(/%URL_HTML(?:IFIED)?%/gi, this._escape(uri))
						.replace(/%TITLE_HTML(?:IFIED)?%/gi, this._escape(title))
						.replace(/%AUTHOR%/gi, author)
						.replace(/%AUTHOR_HTML(?:IFIED)?%/gi, this._escape(author))
						.replace(/%DESC(?:RIPTION)?%/gi, description)
						.replace(/%DESC(?:RIPTION)?_HTML(?:IFIED)?%/gi, this._escape(description))
						.replace(/%KEYWORDS%/gi, keywords)
						.replace(/%KEYWORDS_HTML(?:IFIED)?%/gi, this._escape(keywords))
						.replace(/%UTC_TIME%/gi, timeUTC)
						.replace(/%LOCAL_TIME%/gi, timeLocal)
						.replace(/%EOL%/gi, this.lineFeed);
			}, this);
		if (stringToCopy.length > 1)
			stringToCopy.push('');

		return stringToCopy.join(this.lineFeed);
	},
	_escape : function MTS_escape(aString)
	{
		return aString
				.replace(/&/g, '&amp;')
				.replace(/"/g, '&quot;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;');
	},
	_getMetaInfo : function MTS_getMetaInfo(aDocument, aName)
	{
		var upperCase = aName.toUpperCase();
		var lowerCase = aName.toLowerCase();
		return aDocument.evaluate(
				'/descendant::*[translate(local-name(), "META", "meta")="meta"][translate(@name, "'+upperCase+'", "'+lowerCase+'")="'+lowerCase+'"]/attribute::content',
				aDocument,
				null,
				XPathResult.STRING_TYPE,
				null
			).stringValue;
	},
	
	kFORMAT_TYPE_DEFAULT : 0, 
	kFORMAT_TYPE_MOZ_URL : 1,
	kFORMAT_TYPE_LINK    : 2,
 
	getClopboardFormatForType : function MTS_getClopboardFormatForType(aFormatType) 
	{
		if (aFormatType === void(0))
			aFormatType = this.getPref('extensions.multipletab.clipboard.formatType');

		switch (aFormatType)
		{
			default:
				for (let i in this.formats)
				{
					if (this.formats[i].id == aFormatType)
						return this.formats[i].format;
				}
			case this.kFORMAT_TYPE_DEFAULT:
			case this.kFORMAT_TYPE_MOZ_URL:
			case this.kFORMAT_TYPE_LINK:
				return this.getPref('extensions.multipletab.clipboard.format.'+aFormatType);
		}
	},
  
	// Tab Mix Plus commands 
	//   Tab Mix Plus:
	//     freeze, protect, lock
	//   Tab Utilities https://addons.mozilla.org/firefox/addon/59961
	//     freeze, protect
	//   Super Tab Mode https://addons.mozilla.org/firefox/addon/13288
	//     lock
	
	toggleTabsFreezed : function MTS_toggleTabsFreezed(aTabs, aNewState) 
	{
		if (aNewState === void(0))
			aNewState = !tabs.every(this._isTabFreezed);

		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			if (aNewState != this._isTabFreezed(tab))
				gBrowser.freezeTab(tab);
		}
	},
	_isTabFreezed : function MTS__isTabFreezed(aTab)
	{
		return aTab.hasAttribute('protected') && aTab.hasAttribute('locked');
	},
	get canFreezeTab()
	{
		return 'freezeTab' in gBrowser;
	},
 
	toggleTabsProtected : function MTS_toggleTabsProtected(aTabs, aNewState) 
	{
		if (aNewState === void(0))
			aNewState = !tabs.every(this._isTabProtected);

		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			if (aNewState != this._isTabProtected(tab))
				gBrowser.protectTab(tab);
		}
	},
	_isTabProtected : function MTS__isTabProtected(aTab)
	{
		return aTab.hasAttribute('protected');
	},
	get canProtectTab()
	{
		return 'protectTab' in gBrowser;
	},
 
	toggleTabsLocked : function MTS_toggleTabsLocked(aTabs, aNewState) 
	{
		if (aNewState === void(0))
			aNewState = !tabs.every(this._isTabLocked);

		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			if (aNewState == this._isTabLocked(aTab)) continue;

			// Tab Mix Plus, Tab Utilities
			if ('lockTab' in gBrowser)
				gBrowser.lockTab(tab);

			// Super Tab Mode
			if ('stmM' in window && 'togglePL' in stmM) {
				if (aNewState)
					tab.setAttribute('isPageLocked', true);
				else
					tab.removeAttribute('isPageLocked');
			}
		}
	},
	_isTabLocked : function MTS__isTabLocked(aTab)
	{
		return (
			aTab.hasAttribute('locked') || // Tab Mix Plus, Tab Utilities
			aTab.hasAttribute('isPageLocked') // Super Tab Mode
		);
	},
	get canLockTab()
	{
		return (
			'lockTab' in gBrowser || // Tab Mix Plus, Tab Utilities
			('stmM' in window && 'togglePL' in stmM) // Super Tab Mode
		);
	},
 
	pinTabs : function MTS_pinTabs(aTabs) 
	{
		if (!aTabs) return;
		var b = this.getTabBrowserFromChild(aTabs[0]);
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			b.pinTab(aTabs[i]);
		}
	},
	unpinTabs : function MTS_unpinTabs(aTabs)
	{
		if (!aTabs) return;
		var b = this.getTabBrowserFromChild(aTabs[0]);
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			b.unpinTab(aTabs[i]);
		}
	},
	isAllTabsPinned : function MTS_isAllTabsPinned(aTabs)
	{
		return aTabs.every(function(aTab) {
			return aTab.hasAttribute('pinned');
		});
	},
	isNoTabPinned : function MTS_isNoTabPinned(aTabs)
	{
		return aTabs.every(function(aTab) {
			return !aTab.hasAttribute('pinned');
		});
	},
	get canPinTab()
	{
		return 'pinTab' in gBrowser && 'unpinTab' in gBrowser;
	},
 
	// experimental command 
	moveTabsToGroup : function MTS_moveTabsToGroup(aTabs, aGroupId)
	{
		if (!this.canMoveTabsToGroup)
			return;

		var title;
		if (!aGroupId) {
			switch (this.getPref('extensions.multipletab.moveTabsToNewGroup.defaultTitle'))
			{
				default:
					break;

				case this.kNEW_GROUP_TITLE_FIRST:
					aTabs.some(function(aTab) {
						if (aTab.hasAttribute('pinned')) // pinned tabs cannot be grouped!
							return false;
						return title = aTab.label;
					});
					break;

				case this.kNEW_GROUP_TITLE_ASK:
					let titleSlot = { value : '' };
					if (!this.PromptService.prompt(window,
							this.bundle.getString('moveTabsToGroup.newGroup.title'),
							this.bundle.getFormattedString('moveTabsToGroup.newGroup.message', [aTabsCount]),
							titleSlot,
							null, null
						))
						return;
					title = titleSlot.value;
					break;
			}
			if (title)
				title = title.trim();
		}

		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			this.setSelection(tab, false);
			TabView.moveTabTo(tab, aGroupId);
			if (!tab._tabViewTabItem) // pinned tabs cannot be grouped!
				continue;
			if (!aGroupId) {
				let newGroup = tab._tabViewTabItem.parent;
				if (title)
					newGroup.setTitle(title);
				aGroupId = newGroup.id;
			}
		}
	},
	kNEW_GROUP_TITLE_BLANK : 0,
	kNEW_GROUP_TITLE_FIRST : 1,
	kNEW_GROUP_TITLE_ASK   : 2,
	updateGroupsPopup : function MTS_updateGroupsPopup(aPopup)
	{
		if (!this.canMoveTabsToGroup)
			return;

		var separator = aPopup.getElementsByTagName('menuseparator')[0];
		separator.hidden = true;

		var range = document.createRange();
		range.selectNodeContents(aPopup);
		range.setEndBefore(separator);
		range.deleteContents();
		range.detach();

		var self = this;
		TabView._initFrame(function() {
			var activeGroup;
			self.getTabsArray(gBrowser).some(function(aTab) {
				if (!aTab._tabViewTabItem) // filter pinned tabs
					return false;
				activeGroup = aTab._tabViewTabItem.parent;
				return true;
			});
			var fragment = document.createDocumentFragment();
			var items = TabView._window.GroupItems.groupItems;
			for (let i = 0, maxi = items.length; i < maxi; i++)
			{
				let groupItem = items[i];
				let title = groupItem.getTitle();
				if (!title.length> 0 ||
					groupItem.hidden ||
					(activeGroup && activeGroup.id == groupItem.id))
					continue;
				let item = document.createElement('menuitem');
				item.setAttribute('label', title);
				item.setAttribute('group-id', groupItem.id);
				fragment.appendChild(item);
			}
			if (fragment.hasChildNodes())
				separator.hidden = false;
			aPopup.insertBefore(fragment, separator);
		});
	},
	get canMoveTabsToGroup()
	{
		return 'TabView' in window && 'moveTabTo' in TabView && '_initFrame' in TabView &&
			TabView.firstUseExperienced;
	},
   
/* Move and Duplicate multiple tabs on Drag and Drop */ 
	
	moveBundledTabsOf : function MTS_moveBundledTabsOf(aMovedTab, aEvent) 
	{
		var b = this.getTabBrowserFromChild(aMovedTab);
		var oldPosition = aEvent.detail;
		var movedTabs = this.getBundledTabsOf(aMovedTab);
		if (movedTabs.length <= 1)
			return;
		this.rearrangeBundledTabsOf(aMovedTab, oldPosition, movedTabs);

		b.mTabDropIndicatorBar.collapsed = true; // hide anyway!
	},
 
	importBundledTabsOf : function MTS_importBundledTabsOf(aNewTab, aSourceTab) 
	{
		var targetBrowser = this.getTabBrowserFromChild(aNewTab);

		if (!targetBrowser.__multipletab__canDoWindowMove) {
			this.duplicateBundledTabsOf(aNewTab, aSourceTab, true);
			retrurn;
		}

		var targetWindow = aNewTab.ownerDocument.defaultView;
		var targetService = targetWindow.MultipleTabService;

		var info = {};
		var sourceTabs = targetService.getBundledTabsOf(aSourceTab, info);
		var sourceWindow = info.sourceWindow;
		if (sourceTabs.length <= 1)
			return;

		var shouldSelectAfter = this.getPref('extensions.multipletab.selectAfter.move');

		var operation = function(aCollectData) {
			var result = {};

			var sourceBaseIndex = sourceTabs.indexOf(aSourceTab);

			var otherSourceTabs = sourceTabs.slice(0);
			otherSourceTabs.splice(otherSourceTabs.indexOf(aSourceTab), 1);

			var sourceService = sourceWindow.MultipleTabService;
			var sourceBrowser = info.sourceBrowser;

			result.source = !aCollectData ? null :
				{
					window  : UndoTabService.getId(sourceWindow),
					browser : UndoTabService.getId(sourceBrowser),
					tabs    : sourceTabs.map(function(aTab) {
						return UndoTabService.getId(aTab);
					}),
					positions : sourceTabs.map(function(aTab) {
						return aTab._tPos;
					})
				};

			var isAllTabsMove = sourceService.getTabs(sourceBrowser).snapshotLength == otherSourceTabs.length;

			targetBrowser.movingSelectedTabs = true;
			targetService.clearSelection(targetBrowser);
			sourceService.clearSelection(sourceBrowser);

			targetWindow['piro.sakura.ne.jp'].stopRendering.stop();
			sourceWindow['piro.sakura.ne.jp'].stopRendering.stop();

			var importedTabs = targetService.importTabsTo(otherSourceTabs, targetBrowser);
			importedTabs.splice(sourceBaseIndex, 0, aNewTab);
			targetService.rearrangeBundledTabsOf(aNewTab, importedTabs);
			if (shouldSelectAfter)
				importedTabs.map(function(aTab) {
					targetService.setSelection(aTab, true);
				});

			result.target = !aCollectData ? null :
				{
					window  : UndoTabService.getId(targetWindow),
					browser : UndoTabService.getId(targetBrowser),
					tabs    : importedTabs.map(function(aTab) {
						return UndoTabService.getId(aTab);
					}),
					positions : importedTabs.map(function(aTab) {
						return aTab._tPos;
					})
				};

			if (isAllTabsMove) {
				targetService.closeOwner(sourceBrowser);
			}
			else {
				sourceWindow['piro.sakura.ne.jp'].stopRendering.start();
			}

			targetService.setSelection(aNewTab, shouldSelectAfter);
			targetBrowser.movingSelectedTabs = false;

			targetWindow['piro.sakura.ne.jp'].stopRendering.start();

			return result;
		};

		if ('UndoTabService' in window && UndoTabService.isUndoable()) {
			let data = {
					source : null,
					target : null
				};
			let targetEntry = {
					name  : 'multipletab-importBundledTabs-target',
					label : this.bundle.getFormattedString('undo_importBundledTabsOf_target_label', [sourceTabs.length]),
					data  : data
				};
			let sourceEntry = {
					name  : 'multipletab-importBundledTabs-source',
					label : this.bundle.getFormattedString('undo_importBundledTabsOf_source_label', [sourceTabs.length]),
					data  : data
				};
			UndoTabService.doOperation(
				function() {
					UndoTabService.doOperation(
						function() {
							var result = operation(true);
							data.source = result.source;
							data.target = result.target;
						},
						sourceWindow,
						sourceEntry
					);
				},
				targetWindow,
				targetEntry
			);
		}
		else {
			operation();
		}
	},
	windowMoveBundledTabsOf : function MTS_windowMoveBundledTabsOf(aNewTab, aSourceTab) // old name, for backward compatibility
	{
		return this.importBundledTabsOf(aNewTab, aSourceTab);
	},
	
	closeOwner : function MTS_closeOwner(aTabOwner) 
	{
		var w = aTabOwner.ownerDocument.defaultView;
		if (!w) return;
		if ('SplitBrowser' in w) {
			if ('getSubBrowserFromChild' in w.SplitBrowser) {
				var subbrowser = w.SplitBrowser.getSubBrowserFromChild(aTabOwner);
				if (subbrowser) {
					subbrowser.close();
					return;
				}
			}
			if (w.SplitBrowser.browsers.length) return;
		}
		w.close();
	},
  
	duplicateBundledTabsOf : function MTS_duplicateBundledTabsOf(aNewTab, aSourceTab, aMayBeMove) 
	{
		var sourceWindow = aSourceTab.ownerDocument.defaultView;
		var sourceService = sourceWindow.MultipleTabService;

		var targetWindow = aNewTab.ownerDocument.defaultView;
		var targetService = targetWindow.MultipleTabService;

		var info = {};
		var sourceTabs = sourceService.getBundledTabsOf(aSourceTab, info);
		if (sourceTabs.length <= 1)
			return;

		var sourceBrowser = info.sourceBrowser;
		var targetBrowser = targetService.getTabBrowserFromChild(aNewTab);

		var isMove = (aMayBeMove && sourceBrowser != targetBrowser);
		var isAllTabsMove = (
				isMove &&
				targetWindow != sourceWindow &&
				sourceService.getTabs(sourceBrowser).snapshotLength == sourceTabs.length
			);
		var shouldSelectAfter = this.getPref(isMove ?
				'extensions.multipletab.selectAfter.move' :
				'extensions.multipletab.selectAfter.duplicate'
			);

		var operation = function(aCollectData) {
			var result = {};

			result.source = !aCollectData ? null :
				{
					window  : UndoTabService.getId(sourceWindow),
					browser : UndoTabService.getId(sourceBrowser),
					tabs    : sourceTabs.map(function(aTab) {
						return UndoTabService.getId(aTab);
					}),
					positions : sourceTabs.map(function(aTab) {
						return aTab._tPos;
					})
				};

			var sourceBaseIndex = sourceTabs.indexOf(aSourceTab);
			var otherTabs = sourceTabs.slice(0);
			otherTabs.splice(sourceBaseIndex, 1);

			sourceService.clearSelection(sourceBrowser);
			targetService.clearSelection(targetBrowser);

			var otherSourceTabs = sourceTabs.slice(0);
			otherSourceTabs.splice(otherSourceTabs.indexOf(aSourceTab), 1);

			targetBrowser.duplicatingSelectedTabs = true;
			targetBrowser.movingSelectedTabs = true;

			var duplicatedTabs = targetService.importTabsTo(otherTabs, targetBrowser, !isMove);
			duplicatedTabs.splice(sourceBaseIndex, 0, aNewTab);
			targetService.rearrangeBundledTabsOf(aNewTab, duplicatedTabs);

			if (shouldSelectAfter) {
				for (let i = 0, maxi = duplicatedTabs.length; i < maxi; i++)
				{
					targetService.setSelection(tabs[i], true);
				}
			}

			result.target = !aCollectData ? null :
				{
					window  : UndoTabService.getId(targetWindow),
					browser : UndoTabService.getId(targetBrowser),
					tabs    : duplicatedTabs.map(function(aTab) {
						return UndoTabService.getId(aTab);
					}),
					positions : duplicatedTabs.map(function(aTab) {
						return aTab._tPos;
					})
				};

			if (isAllTabsMove)
				targetService.closeOwner(sourceBrowser);

			targetBrowser.movingSelectedTabs = false;
			targetBrowser.duplicatingSelectedTabs = false;
			targetBrowser.mTabDropIndicatorBar.collapsed = true; // hide anyway!

			return result;
		};

		if ('UndoTabService' in window && UndoTabService.isUndoable()) {
			let data = {
					source : null,
					target : null
				};
			let targetEntry = {
				name  : isMove ?
							'multipletab-importBundledTabs-source' :
							'multipletab-duplicateBundledTabs-target',
				label : this.bundle.getFormattedString(isMove ?
							'undo_importBundledTabsOf_target_label' :
							'undo_duplicateTabs_label',
							[sourceTabs.length]
						),
				data  : data
			};
			let sourceEntry = {
				name  : isMove ?
							'multipletab-importBundledTabs-source' :
							'multipletab-duplicateBundledTabs-target',
				label : this.bundle.getFormattedString(isMove ?
							'undo_duplicateBundledTabsOf_source_label' :
							'undo_duplicateTabs_label',
							[sourceTabs.length]
						),
				data  : data
			};
			if (sourceWindow == targetWindow) {
				UndoTabService.doOperation(
					function() {
						var result = operation(true);
						data.source = result.source;
						data.target = result.target;
					},
					targetWindow,
					targetEntry
				);
			}
			else {
				UndoTabService.doOperation(
					function() {
						UndoTabService.doOperation(
							function() {
								var result = operation(true);
								data.source = result.source;
								data.target = result.target;
							},
							targetWindow,
							targetEntry
						);
						return (isMove && !isAllTabsMove) ? true : false ;
					},
					sourceWindow,
					sourceEntry
				);
			}
		}
		else {
			operation();
		}
	},
 
	tearOffSelectedTabsFromRemote : function MTS_tearOffSelectedTabsFromRemote() 
	{
		var remoteTab = window.arguments[0];
		var info = {};
		var tabs = this.getBundledTabsOf(remoteTab, info);
		if (tabs.length > 1) {
			if (this.isDraggingAllTabs(remoteTab)) {
				window.close();
			}
			else {
				window.setTimeout(function() {
					info.sourceWindow.MultipleTabService.splitWindowFromTabs(tabs, window);
				}, 0);
			}
			return true;
		}
		return false;
	},
	
	isDraggingAllTabs : function MTS_isDraggingAllTabs(aTab) 
	{
		var info = {};
		var tabs = this.getBundledTabsOf(aTab, info);
		return tabs.length && tabs.length == info.sourceWindow.MultipleTabService.getTabs(info.sourceBrowser).snapshotLength;
	},
   
/* Tab Selection */ 
	
	hasSelection : function MTS_hasSelection(aTabBrowser) 
	{
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:tab[@'+this.kSELECTED+' = "true"]',
					(aTabBrowser || this.browser).mTabContainer,
					this.NSResolver, // document.createNSResolver(document.documentElement),
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				);
			return xpathResult.singleNodeValue ? true : false ;
		}
		catch(e) {
		}
		return false;
	},
 
	isSelected : function MTS_isSelected(aTab) 
	{
		return aTab && aTab.getAttribute(this.kSELECTED) == 'true';
	},
 
	isReadyToClose : function MTS_isReadyToClose(aTab) 
	{
		return aTab && aTab.getAttribute(this.kREADY_TO_CLOSE) == 'true';
	},
 
	isCollapsed : function MTS_isCollapsed(aTab) 
	{
		return (
			'TreeStyleTabService' in window &&
			('isCollapsed' in TreeStyleTabService ?
				TreeStyleTabService.isCollapsed(aTab) :
				aTab.getAttribute(TreeStyleTabService.kCOLLAPSED) == 'true')
		);
	},
 
	setSelection : function MTS_setSelection(aTab, aState) 
	{
		this.setBooleanAttributeToTab(aTab, this.kSELECTED_OLD, aState, true); // for backward compatibility
		return this.setBooleanAttributeToTab(aTab, this.kSELECTED, aState, true, this.kSELECTED);
	},
	
	setReadyToClose : function MTS_setReadyToClose(aTab, aState) 
	{
		return this.setBooleanAttributeToTab(aTab, this.kREADY_TO_CLOSE, aState, false);
	},
 
	setBooleanAttributeToTab : function MTS_setBooleanAttributeToTab(aTab, aAttr, aState, aShouldSaveToSession, aPropertyName) 
	{
		if (!aState) {
			aTab.removeAttribute(aAttr);
			if (aShouldSaveToSession)
				this.deleteTabValue(aTab, aAttr);
			if (aPropertyName)
				aTab[aPropertyName] = false;
		}
		else {
			aTab.setAttribute(aAttr, true);
			if (aShouldSaveToSession)
				this.setTabValue(aTab, aAttr, 'true');
			if (aPropertyName)
				aTab[aPropertyName] = true;
		}
		this.selectionModified = true;

		if (
			'TreeStyleTabService' in window &&
			'getDescendantTabs' in TreeStyleTabService &&
			('isCollapsed' in TreeStyleTabService ?
				TreeStyleTabService.isSubtreeCollapsed(aTab) :
				aTab.getAttribute(TreeStyleTabService.kSUBTREE_COLLAPSED) == 'true'
			)
			) {
			var tabs = TreeStyleTabService.getDescendantTabs(aTab);
			for (var i = 0, maxi = tabs.length; i < maxi; i++)
			{
				this.setBooleanAttributeToTab(tabs[i], aAttr, aState, aShouldSaveToSession, aPropertyName);
			}
		}

		return aState;
	},
 
	setTabValue : function MTS_setTabValue(aTab, aKey, aValue) 
	{
		if (!aValue) return this.deleteTabValue(aTab, aKey);

		try {
			this.checkCachedSessionDataExpiration(aTab);
			this.SessionStore.setTabValue(aTab, aKey, aValue);
		}
		catch(e) {
		}

		return aValue;
	},
 
	deleteTabValue : function MTS_deleteTabValue(aTab, aKey) 
	{
		try {
			this.checkCachedSessionDataExpiration(aTab);
			this.SessionStore.setTabValue(aTab, aKey, '');
			this.SessionStore.deleteTabValue(aTab, aKey);
		}
		catch(e) {
		}
	},
 
	// workaround for http://piro.sakura.ne.jp/latest/blosxom/mozilla/extension/treestyletab/2009-09-29_debug.htm
	checkCachedSessionDataExpiration : function MTS_checkCachedSessionDataExpiration(aTab) 
	{
		var data = aTab.linkedBrowser.__SS_data;
		if (data &&
			data._tabStillLoading &&
			aTab.getAttribute('busy') != 'true' &&
			aTab.linkedBrowser.__SS_restoreState != 1)
			data._tabStillLoading = false;
	},
  
	toggleSelection : function MTS_toggleSelection(aTab) 
	{
		this.toggleBooleanAttributeToTab(aTab, this.kSELECTED_OLD, true); // for backward compatibility
		return this.toggleBooleanAttributeToTab(aTab, this.kSELECTED, true, this.kSELECTED);
	},
	
	toggleReadyToClose : function MTS_toggleReadyToClose(aTab) 
	{
		return this.toggleBooleanAttributeToTab(aTab, this.kREADY_TO_CLOSE, false);
	},
 
	toggleBooleanAttributeToTab : function MTS_toggleBooleanAttributeToTab(aTab, aAttr, aShouldSaveToSession, aPropertyName) 
	{
		return this.setBooleanAttributeToTab(aTab, aAttr, aTab.getAttribute(aAttr) != 'true', aShouldSaveToSession, aPropertyName);
	},
  
	clearSelection : function MTS_clearSelection(aTabBrowser) 
	{
		this.clearSelectionSub(this.getSelectedTabs(aTabBrowser), this.kSELECTED_OLD); // for backward compatibility
		this.clearSelectionSub(this.getSelectedTabs(aTabBrowser), this.kSELECTED);
		this.clearSelectionSub(this.getReadyToCloseTabs(aTabBrowser), this.kREADY_TO_CLOSE);
		this.selectionModified = false;
		this.lastManuallySelectedTab = null;
	},
	clearSelectionSub : function MTS_clearSelectionSub(aTabs, aAttr)
	{
		if (!aTabs || !aTabs.length) return;

		for (var i = aTabs.length-1; i > -1; i--)
		{
			aTabs[i].removeAttribute(aAttr);
			try {
				this.SessionStore.setTabValue(aTabs[i], aAttr, '');
				this.SessionStore.deleteTabValue(aTabs[i], aAttr);
			}
			catch(e) {
			}
		}
	},
 
	getTabsInUndeterminedRange : function MTS_getTabsInUndeterminedRange(aSource) 
	{
		var b = this.getTabBrowserFromChild(aSource) || this.browser;
		return this.getArrayFromXPathResult(
				'descendant::xul:tab[@'+this.kIN_UNDETERMINED_RANGE+'="true" and not(@hidden="true")]',
				b.mTabContainer
			);
	},
 
	addTabInUndeterminedRange : function MTS_addTabInUndeterminedRange(aTab) 
	{
		aTab.setAttribute(this.kIN_UNDETERMINED_RANGE, true);
	},
 
	clearUndeterminedRange : function MTS_clearUndeterminedRange(aSource) 
	{
		var tabs = this.getTabsInUndeterminedRange(aSource);
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			tabs[i].removeAttribute(this.kIN_UNDETERMINED_RANGE);
		}
	},
  
/* Pref Listener */ 
	
	domain : 'extensions.multipletab', 
 
	observe : function MTS_observe(aSubject, aTopic, aPrefName) 
	{
		if (aTopic != 'nsPref:changed') return;

		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.multipletab.tabdrag.mode':
				this.tabDragMode = value;
				break;

			case 'extensions.multipletab.tabclick.accel.mode':
				this.tabAccelClickMode = value;
				break;

			case 'extensions.multipletab.tabclick.shift.mode':
				this.tabShiftClickMode = value;
				break;

			case 'extensions.multipletab.selectionStyle':
				if (value == 'auto') {
					value = ('tabColors' in window || 'CHROMATABS' in window) ? 'border' :
							'color' ;
				}
				document.documentElement.setAttribute(this.kSELECTION_STYLE, value);
				break;

			case 'extensions.multipletab.implicitlySelectCurrentTab':
				this.implicitlySelect = value;
				break;

			case 'extensions.multipletab.clipboard.linefeed':
				this.lineFeed = value;
				break;

			case 'extensions.multipletab.clipboard.formats':
				this.formats = [];
				this.formatsTimeStamp = Date.now();
				let (parts = value.split('|')) {
					for (let i = 0, maxi = parts.length; i < maxi; i++)
					{
						let part = parts[i];
						try {
							let format, label;
							[format, label] = part.split('/').map(decodeURIComponent);
							if (!format) continue;
							if (!label) label = format;
							this.formats.push({
								id     : i + this.kCUSTOM_TYPE_OFFSET,
								label  : label,
								format : format
							});
						}
						catch(e) {
						}
					}
				}
				break;

			default:
				break;
		}
	}
  
}; 
(function() {
	var namespace = {};
	Components.utils.import('resource://multipletab-modules/prefs.js', namespace);
	Components.utils.import('resource://multipletab-modules/namespace.jsm', namespace);
	Components.utils.import('resource://multipletab-modules/autoScroll.js', namespace);

	MultipleTabService.__proto__ = namespace.prefs;
	MultipleTabService.namespace = namespace.getNamespaceFor('piro.sakura.ne.jp')['piro.sakura.ne.jp'];
})();

window.addEventListener('load', MultipleTabService, false);
window.addEventListener('DOMContentLoaded', MultipleTabService, false);
  
