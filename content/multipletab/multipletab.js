(function(aGlobal) {
var { Promise } = Components.utils.import('resource://gre/modules/Promise.jsm', {});

var { SessionStore } = Components.utils.import('resource:///modules/sessionstore/SessionStore.jsm', {});
var { inherit } = Components.utils.import('resource://multipletab-modules/inherit.jsm', {});

var { MultipleTabHandlerConstants } = Components.utils.import('resource://multipletab-modules/constants.js', {});
var { isFormatRequiresLoaded } = Components.utils.import('resource://multipletab-modules/documentToCopyText.js', {});
var { saveBrowserAs, saveBrowserInto } = Components.utils.import('resource://multipletab-modules/saveDocument.js', {});
var { evaluateXPath, getArrayFromXPathResult } = Components.utils.import('resource://multipletab-modules/xpath.js', {});

var namespace = {};
Components.utils.import('resource://multipletab-modules/prefs.js', namespace);
Components.utils.import('resource://multipletab-modules/namespace.jsm', namespace);
Components.utils.import('resource://multipletab-modules/autoScroll.js', namespace);

var MultipleTabService = aGlobal.MultipleTabService = inherit(MultipleTabHandlerConstants, { 

	tabDragMode : -1,

	tabAccelClickMode : -1,
	tabShiftClickMode : -1,

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
	
/* Utilities */ 
	
	
  
	get autoScroll() { return this.namespace.autoScroll; }, 
 
	get isToolbarCustomizing() 
	{
		var toolbox = window.gToolbox || window.gNavToolbox;
		return toolbox && toolbox.customizing;
	},
 
	// called with target(nsIDOMEventTarget), document(nsIDOMDocument), type(string) and data(object) 
	fireCustomEvent : function(...aArgs)
	{
		var target, document, type, data, canBubble, cancelable;
		for (let arg of aArgs)
		{
			if (typeof arg == 'boolean') {
				if (canBubble === void(0))
					canBubble = arg;
				else
					cancelable = arg;
			}
			else if (typeof arg == 'string')
				type = arg;
			else if (arg instanceof Document)
				document = arg;
			else if (arg instanceof EventTarget)
				target = arg;
			else
				data = arg;
		}
		if (!target)
			target = document;
		if (!document)
			document = target.ownerDocument || target;

		var event = new CustomEvent(type, {
			bubbles    : canBubble,
			cancelable : cancelable,
			detail     : data
		});
		return target.dispatchEvent(event);
	},

	// XXX: this getter is the way to access internal properties of SessionStore.jsm.
	// This shouldn't be the part of this object.
	get SessionStoreNS() {
		if (!this._SessionStoreNS) {
			this._SessionStoreNS = Components.utils.import('resource:///modules/sessionstore/SessionStore.jsm', {});
		}
		return this._SessionStoreNS;
	},
	_SessionStoreNS : null,

	get debug() 
	{
		return this.prefs.getPref('extensions.multipletab.debug');
	},

	get allowMoveMultipleTabs() 
	{
		return this.prefs.getPref('extensions.multipletab.tabdrag.moveMultipleTabs');
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
		var warnMode = this.prefs.getPref('extensions.multipletab.warnOnCloseMultipleTabs');
		if (
			warnMode == this.WARN_ON_CLOSE_SILENT ||
			(warnMode == this.WARN_ON_CLOSE_INHERIT && !this.prefs.getPref('browser.tabs.warnOnClose'))
			)
			return true;

		var maxUndoCount = this.prefs.getPref('browser.sessionstore.max_tabs_undo') || -1;
		var smallerThanWarnCount = aTabsCount <= Math.max(1, maxUndoCount);
		if (smallerThanWarnCount)
			return true;

		var checked = { value: true };
		var message = PluralForm.get(aTabsCount, this.tabbrowserBundle.getString('tabs.closeWarningMultiple')).replace('#1', aTabsCount);
		window.focus();
		var shouldClose = Services.prompt.confirmEx(window,
				this.tabbrowserBundle.getString('tabs.closeWarningTitle'),
				message,
				(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
				(Services.prompt.BUTTON_TITLE_CANCEL * Services.prompt.BUTTON_POS_1),
				this.tabbrowserBundle.getString('tabs.closeButtonMultiple'),
				null, null,
				this.tabbrowserBundle.getString('tabs.closeWarningPromptMe'),
				checked
			) == 0;
		if (shouldClose && !checked.value) {
			if (warnMode == this.WARN_ON_CLOSE_INHERIT)
				this.prefs.setPref('browser.tabs.warnOnClose', false);
			else
				this.prefs.setPref('extensions.multipletab.warnOnCloseMultipleTabs', 0);
		}
		return shouldClose;
	},
	WARN_ON_CLOSE_INHERIT: -1,
	WARN_ON_CLOSE_SILENT:  0,
	WARN_ON_CLOSE_WARN:    1,
 
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
			!(aSource instanceof Event) ||
			!(dt = aSource.dataTransfer)
			)
			return getArrayFromXPathResult(
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
		return getArrayFromXPathResult(
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
		return getArrayFromXPathResult(
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
		return getArrayFromXPathResult(
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

		var userHomePart = this.prefs.getPref('extensions.multipletab.checkUserHost') ?
							str.match(/^\w+:\/\/[^\/]+(\/~[^\/]+)\//) :
							'' ;
		if (userHomePart) userHomePart = userHomePart[1];

		if (this.prefs.getPref('extensions.multipletab.useEffectiveTLD') && Services.eTLD) {
			try {
				let domain = Services.eTLD.getBaseDomain(aURI, 0);
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
			var fileHandler = Services.io
						.getProtocolHandler('file')
						.QueryInterface(Ci.nsIFileProtocolHandler);
			var tempLocalFile = fileHandler.getFileFromURLSpec(aURI);
			newURI = Services.io.newFileURI(tempLocalFile);
		}
		else {
			newURI = Services.io.newURI(aURI, null, null);
		}
		return newURI;
	},
 
	getTabFromEvent : function MTS_getTabFromEvent(aEvent, aReallyOnTab) 
	{
		var tab = evaluateXPath(
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
		return evaluateXPath(
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

		if (aTabBrowserChild.tabbrowser) // tabs
			return aTabBrowserChild.tabbrowser;

		if (aTabBrowserChild.id == 'TabsToolbar') // tabs toolbar
			return aTabBrowserChild.getElementsByTagName('tabs')[0].tabbrowser;

		// tab context menu
		var popup = evaluateXPath(
				'ancestor-or-self::xul:menupopup[@id="tabContextMenu"]',
				aTabBrowserChild,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		if (popup && 'TabContextMenu' in window)
			return this.getTabBrowserFromChild(TabContextMenu.contextTab);

		var b = evaluateXPath(
				'ancestor-or-self::xul:tabbrowser | '+
				'ancestor-or-self::xul:tabs[@tabbrowser]',
				aTabBrowserChild,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		return (b && b.tabbrowser) || b;
	},
 
	getTabs : function MTS_getTabs(aTabBrowser) 
	{
		return evaluateXPath(
				'descendant::xul:tab[not(@hidden="true")]',
				aTabBrowser.mTabContainer
			);
	},
 
	getTabsArray : function MTS_getTabsArray(aTabBrowser) 
	{
		return getArrayFromXPathResult(this.getTabs(aTabBrowser));
	},
 
	getTabAt : function MTS_getTabAt(aIndex, aTabBrowser) 
	{
		if (aIndex < 0) return null;
		return evaluateXPath(
				'descendant::xul:tab['+(aIndex+1)+']',
				aTabBrowser.mTabContainer,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getNextTab : function MTS_getNextTab(aTab) 
	{
		return evaluateXPath(
				'following-sibling::xul:tab[not(@hidden="true")][1]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getPreviousTab : function MTS_getPreviousTab(aTab) 
	{
		return evaluateXPath(
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

		aTab.__multipletab__contentBridge.makeBlank();

		// XXX: This is forward compatibility.
		// `RestoringTabData` doesn't exist in Firefox 23-27. This path doesn't work on them.
		// It had been introduced to refactor Firefox SessionStore code.
		// But it was backed out at https://hg.mozilla.org/mozilla-central/rev/0d6e59222717.
		// It might be restore by https://bugzilla.mozilla.org/show_bug.cgi?id=871246.
		if (this.SessionStoreNS.RestoringTabsData)
			this.SessionStoreNS.RestoringTabsData.remove(aTab.linkedBrowser);

		delete aTab.linkedBrowser.__SS_data;
		delete aTab.__SS_extdata;
	},
 
	irrevocableRemoveTab : function MTS_irrevocableRemoveTab(aTab, aTabBrowser) 
	{
		// nsSessionStore.js doesn't save the tab to the undo cache
		// if the tab is completely blank.
		this.makeTabBlank(aTab);

		// override session data to prevent undo
		var data = {
			entries : [],
			_tabStillLoading : true
		};

		// XXX: This is forward compatibility.
		// `RestoringTabData` doesn't exist in Firefox 23-27. This path doesn't work on them.
		// It had been introduced to refactor Firefox SessionStore code.
		// But it was backed out at https://hg.mozilla.org/mozilla-central/rev/0d6e59222717.
		// It might be restore by https://bugzilla.mozilla.org/show_bug.cgi?id=871246.
		if (this.SessionStoreNS.RestoringTabsData)
			this.SessionStoreNS.RestoringTabsData.set(aTab.linkedBrowser, data);
		else
			aTab.linkedBrowser.__SS_data = data;

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
			return Promise.resolve(true);
		}

		if (aTab.linkedBrowser.__SS_restoreState == 1 ||
			aTab.getAttribute('pending') == 'true') {
			return new Promise((function(aResolve, aReject) {
				let listener = function(aEvent) {
						aTab.removeEventListener('SSTabRestored', listener, true);
						aResolve(true);
					};
				aTab.addEventListener('SSTabRestored', listener, true);
				aTab.linkedBrowser.reload();
			}).bind(this));
		}

		return Promise.resolve(false);
	},

	prepareTabForSwap : function MTS_prepareTabForSwap(aTab) 
	{
		// We can skip restoring of the pending tab for now.
		// However, because it will be restored by Firefox itself,
		// we cannot stay swapped tabs pending.
		// See also: https://github.com/piroor/multipletab/issues/83
		if ('_swapRegisteredOpenURIs' in this.browser)
			return Promise.resolve(true);

		return this.ensureLoaded(aTab);
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
 
	rearrangeBundledTabsOf : function MTS_rearrangeBundledTabsOf(...aArgs)
	{
		var baseTab,
			oldBasePosition = -1,
			tabs;
		for (let arg of aArgs)
		{
			if (arg instanceof Node)
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
		return evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ",@class," "), " tab-icon ")]',
				aEvent.originalTarget || aEvent.target,
				XPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	isEventFiredOnClickable : function MTS_isEventFiredOnClickable(aEvent) 
	{
		return evaluateXPath(
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
		return evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ",@class," "), " tab-close-button ")]',
				aEvent.originalTarget || aEvent.target,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getCloseboxFromTab : function MTS_getCloseboxFromTab(aTab) 
	{
		var finder = function findCloseBox(aNode) {
				if (aNode.localName == 'toolbarbutton' &&
					aNode.className.indexOf('tab-close-button') > -1)
					return aNode;

				var nodes = document.getAnonymousNodes(aNode) || aNode.childNodes;
				if (nodes) {
					for (let i = 0, maxi = nodes.length; i < maxi; i++)
					{
						let closebox = findCloseBox(nodes[i]);
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
		return Services.appinfo.OS == 'Darwin' ? aEvent.metaKey : aEvent.ctrlKey ;
	},
  
// fire custom events 
	
	fireDuplicatedEvent : function MTS_fireDuplicatedEvent(aNewTab, aSourceTab) 
	{
		var data = {
				sourceTab : aSourceTab
			};
		this.fireCustomEvent(this.kEVENT_TYPE_TAB_DUPLICATE, aNewTab, true, false, data);
		// for backward compatibility
		this.fireCustomEvent(this.kEVENT_TYPE_TAB_DUPLICATE.replace(/^nsDOM/, ''), aNewTab, true, false, data);
	},
 
	fireWindowMoveEvent : function MTS_fireWindowMoveEvent(aNewTab, aSourceTab) 
	{
		var data = {
				sourceTab : aSourceTab
			};
		this.fireCustomEvent(this.kEVENT_TYPE_WINDOW_MOVE, aNewTab, true, false, data);
		// for backward compatibility
		this.fireCustomEvent(this.kEVENT_TYPE_WINDOW_MOVE.replace(/^nsDOM/, ''), aNewTab, true, false, data);
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
			this.fireCustomEvent(this.kEVENT_TYPE_TABS_CLOSING, b, true, true, data) &&
			// for backward compatibility
			this.fireCustomEvent(this.kEVENT_TYPE_TABS_CLOSING.replace(/^nsDOM/, ''), b, true, true, data)
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
		this.fireCustomEvent(this.kEVENT_TYPE_TABS_CLOSED, aTabBrowser, true, false, data);
		// for backward compatibility
		this.fireCustomEvent(this.kEVENT_TYPE_TABS_CLOSED.replace(/^nsDOM/, ''), aTabBrowser, true, false, data);
	},
  

  
/* Initializing */ 
	
	init : function MTS_init() 
	{
		if (!('gBrowser' in window))
			return;

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

		window.messageManager.loadFrameScript(this.CONTENT_SCRIPT, true);

		this.migratePrefs();
		this.prefs.addPrefListener(this);
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.tabdrag.mode');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.tabclick.accel.mode');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.tabclick.shift.mode');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.selectionStyle');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.implicitlySelectCurrentTab');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.clipboard.linefeed');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.clipboard.formats');

		let { updateInternalSave } = Components.utils.import('resource://multipletab-modules/updateInternalSave.js', {});
		updateInternalSave(window);

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
			gBrowserInit.__multipletab___delayedStartup = gBrowserInit._delayedStartup;
			gBrowserInit._delayedStartup = function(...args) {
				MultipleTabService.runningDelayedStartup = true;
				var retVal = this.__multipletab___delayedStartup.apply(this, args);
				MultipleTabService.runningDelayedStartup = false;
				return retVal;
			};
		}

		this.overrideExtensionsOnPreInit(); // hacks.js
	},
	runningDelayedStartup : false,
 
	delayedInit : function MTS_delayedInit() 
	{
		this.overrideExtensionsOnDelayedInit(); // hacks.js
	},
 
	applyPlatformDefaultPrefs : function MTS_applyPlatformDefaultPrefs() 
	{
		var OS = Services.appinfo.OS;
		var processed = {};
		var originalKeys = this.prefs.getDescendant('extensions.multipletab.platform.'+OS);
		for (let i = 0, maxi = originalKeys.length; i < maxi; i++)
		{
			let originalKey = originalKeys[i];
			let key = originalKey.replace('platform.'+OS+'.', '');
			this.prefs.setDefaultPref(key, this.prefs.getPref(originalKey));
			processed[key] = true;
		}
		originalKeys = this.prefs.getDescendant('extensions.multipletab.platform.default');
		for (let i = 0, maxi = originalKeys.length; i < maxi; i++)
		{
			let originalKey = originalKeys[i];
			let key = originalKey.replace('platform.default.', '');
			if (!(key in processed))
				this.prefs.setDefaultPref(key, this.prefs.getPref(originalKey));
		}
	},
 
	migratePrefs : function MTS_migratePrefs() 
	{
		switch (this.prefs.getPref('extensions.multipletab.prefsVersion') || 0)
		{
			case 0:
				var clickModeValue = this.prefs.getPref('extensions.multipletab.tabclick.mode');
				if (clickModeValue !== null) {
					this.prefs.setPref('extensions.multipletab.tabclick.accel.mode', clickModeValue);
				}
				this.prefs.clearPref('extensions.multipletab.tabclick.mode');
			default:
				break;
		}
		this.prefs.setPref('extensions.multipletab.prefsVersion', this.kPREF_VERSION);
	},
 
	initTabBrowser : function MTS_initTabBrowser(aTabBrowser) 
	{
		this.initTabbar(aTabBrowser);

		if ('swapBrowsersAndCloseOther' in aTabBrowser) {
			aTabBrowser.__multipletab__canDoWindowMove = true;
			aTabBrowser.__multipletab__swapBrowsersAndCloseOther = aTabBrowser.swapBrowsersAndCloseOther;
			aTabBrowser.swapBrowsersAndCloseOther = function(aOurTab, aRemoteTab, ...args) {
				if (MultipleTabService.runningDelayedStartup &&
					MultipleTabService.tearOffSelectedTabsFromRemote(aRemoteTab))
					return;
				return this.__multipletab__swapBrowsersAndCloseOther(aOurTab, aRemoteTab, ...args);
			};
		}
		else {
			aTabBrowser.__multipletab__canDoWindowMove = false;
		}

		window['piro.sakura.ne.jp'].tabsDragUtils.initTabBrowser(aTabBrowser);

		this.initTabBrowserContextMenu(aTabBrowser);

		var tabs = this.getTabsArray(aTabBrowser);
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.initTab(tabs[i], aTabBrowser);
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
		var items = getArrayFromXPathResult('child::*[starts-with(@id, "multipletab-context-")]', template)
					.concat(getArrayFromXPathResult('child::*[not(@id) or not(starts-with(@id, "multipletab-context-"))]', template))
		for (let i = 0, maxi = items.length; i < maxi; i++)
		{
			let item = items[i].cloneNode(true);
			if (item.getAttribute('id'))
				item.setAttribute('id', item.getAttribute('id')+suffix);

			let refNode = void(0);

			let insertAfter = item.getAttribute(this.kINSERT_AFTER);
			if (insertAfter) {
				try {
					refNode = evaluateXPath(
							insertAfter.replace(/^\s*xpath:\s*/i, ''),
							tabContextMenu,
							XPathResult.FIRST_ORDERED_NODE_TYPE
						).singleNodeValue;
					if (refNode) refNode = refNode.nextSibling;
				}
				catch(e) {
				}
			}

			let insertBefore = item.getAttribute(this.kINSERT_BEFORE);
			if (refNode === void(0) && insertBefore) {
				try {
					refNode = evaluateXPath(
							insertBefore.replace(/^\s*xpath:\s*/i, ''),
							tabContextMenu,
							XPathResult.FIRST_ORDERED_NODE_TYPE
						).singleNodeValue;
				}
				catch(e) {
				}
			}

			tabContextMenu.insertBefore(item, refNode || null);
		}

		tabContextMenu.addEventListener('popupshowing', this, false);
	},
  
	initTab : function MTS_initTab(aTab, aTabBrowser) 
	{
		aTab.__multipletab__contentBridge = new MultipleTabHandlerContentBridge(aTab, aTabBrowser);
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

		window.messageManager.broadcastAsyncMessage(this.MESSAGE_TYPE, {
			command : this.COMMAND_SHUTDOWN,
			params  : {}
		});

		this.endListenWhileDragging();

		this.prefs.removePrefListener(this);

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
		if (aTab.__multipletab__contentBridge) {
			aTab.__multipletab__contentBridge.destroy();
			delete aTab.__multipletab__contentBridge;
		}

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
					this.isSelected(aEvent.detail.sourceTab) &&
					this.allowMoveMultipleTabs &&
					!b.duplicatingSelectedTabs &&
					(!('UndoTabService' in window) || UndoTabService.isUndoable())
					)
					this.duplicateBundledTabsOf(aEvent.originalTarget, aEvent.detail.sourceTab, false);
				break;

			case this.kEVENT_TYPE_WINDOW_MOVE:
				b = this.getTabBrowserFromChild(aEvent.currentTarget);
				if (
					this.isSelected(aEvent.detail.sourceTab) &&
					this.allowMoveMultipleTabs &&
					!b.duplicatingSelectedTabs &&
					(!('UndoTabService' in window) || UndoTabService.isUndoable())
					)
					this.importBundledTabsOf(aEvent.originalTarget, aEvent.detail.sourceTab);
				break;

			case 'DOMContentLoaded':
				return this.preInit();

			case 'load':
				return this.init();

			case 'unload':
				return this.destroy();

			case 'tabviewshown':
				return this.clearSelection();

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
						if (!this.isVisible(tab))
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
			) ? this.prefs.getPref('extensions.multipletab.tabdrag.close.delay') :
				this.prefs.getPref('extensions.multipletab.tabdrag.delay') ;
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
			this.isOnElement(this.lastMouseDownX, this.lastMouseDownY, this.getCloseboxFromTab(tab)) &&
			this.prefs.getPref('extensions.multipletab.tabdrag.close')
			) {
			let delay = this.prefs.getPref('extensions.multipletab.tabdrag.close.delay');
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
			this.addTabInUndeterminedRange(tab);
			this.startListenWhileDragging(tab);
		}
		else {
			let delay = this.prefs.getPref('extensions.multipletab.tabdrag.delay');
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
				this.pendingFirstMouseOverTab = this.firstMouseOverTab = aTarget;
		}
		else {
			this.pendingFirstMouseOverTab = this.firstMouseOverTab = null;
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
		if (window['piro.sakura.ne.jp'].tabsDragUtils.canAnimateDraggedTabs(aEvent)) {
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
				if (this.prefs.getPref('extensions.multipletab.tabdrag.autopopup'))
					this.showSelectionPopup(aEvent, this.prefs.getPref('extensions.multipletab.tabdrag.autoclear'));
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
				if (this.pendingFirstMouseOverTab) {
					this.setReadyToClose(this.pendingFirstMouseOverTab, true);
					this.pendingFirstMouseOverTab = null;
				}
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
				if (this.isVisible(tab))
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
				if (this.isVisible(tab))
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
		this.initTab(tab, gBrowser);

		var session = Cc['@mozilla.org/widget/dragservice;1']
						.getService(Ci.nsIDragService)
						.getCurrentSession();
		var draggedTab = session && session.sourceNode ?
							this.getTabFromChild(session.sourceNode) :
							null ;
		var ownerBrowser = this.getTabBrowserFromChild(draggedTab);
		if (draggedTab &&
			!draggedTab.__multipletab__duplicating &&
			!draggedTab.duplicatingSelectedTabs &&
			this.getTabBrowserFromChild(draggedTab) != this.getTabBrowserFromChild(tab)) {
			// this maybe a moving of tab from another window
			this.fireWindowMoveEvent(tab, draggedTab);
		}
	},
 
	// for drag and drop of selected tabs
	onDuplicateTab : function MTS_onDuplicateTab(aTask, aTabBrowser, aTab) 
	{
		// This flag is required to block unexpected "window move" event,
		// because a TabOpen event is fired while tabs are duplicated and
		// the TabOpen event unexpectedly triggers "window move" event.
		aTab.__multipletab__duplicating = true;

		var newTab = null;

		if (
			this.isSelected(aTab) &&
			(
				this.allowMoveMultipleTabs ||
				!('UndoTabService' in window && UndoTabService.isUndoable())
			)
			) {
			let b = this.getTabBrowserFromChild(aTab);
			if (!b.duplicatingSelectedTabs) {
				let tabs = this.getBundledTabsOf(aTab);
				if (tabs.length > 0) {
					let process = (function() {
						newTab = aTask.call(aTabBrowser);
						this.fireDuplicatedEvent(newTab, aTab);
					}).bind(this);
					if ('UndoTabService' in window && UndoTabService.isUndoable()) {
						UndoTabService.doOperation(
							process,
							{
								name  : 'multipletab-duplicateTab',
								label : this.bundle.getFormattedString('undo_duplicateTabs_label', [tabs.length])
							}
						);
					}
					else {
						process();
					}
				}
			}
		}

		if (!newTab)
			newTab = aTask.call(aTabBrowser);

		aTab.__multipletab__duplicating = false;
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
			var removeLeft = evaluateXPath(
					'descendant::xul:menuitem[starts-with(@id, "multipletab-context-removeLeftTabs")]',
					aPopup,
					XPathResult.FIRST_ORDERED_NODE_TYPE
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
	},
 
	getShowHideMenuItemsConditions : function MTS_getShowHideMenuItemsConditions(aPopup, aContextTabs)
	{
		var b            = this.getTabBrowserFromChild(aPopup) || this.browser;
		var selectedTabs = this.getSelectedTabs(b);
		var tabs         = this.getTabsArray(b);
		var conditions = {
			'any-selected'           : selectedTabs.length > 0,
			'partially-selected'     : selectedTabs.length < tabs.length,
			'not-all-selected'       : !this.isAllSelected(aContextTabs),
			'can-print-tabs'         : 'PrintAllTabs' in window,
			'can-freeze-tabs'        : this.canFreezeTab,
			'can-protect-tabs'       : this.canProtectTab,
			'can-lock-tabs'          : this.canLockTab,
			'can-move-across-groups' : this.canMoveTabsToGroup
		};
		this.showHideMenuItemsConditionsProviders.forEach(function(aProvider) {
			var extraConditions = aProvider(aContextTabs);
			Object.keys(extraConditions).forEach(function(aKey) {
				conditions[aKey] = extraConditions[aKey];
			});
		});
		return conditions;
	},
	showHideMenuItemsConditionsProviders : [],
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
			selectType[item.name] = this.prefs.getPref(item.key) < 0;
		}

		var selectedTabs = this.getSelectedTabs(b);
		var tabbrowser = b;
		var tabs = this.getTabsArray(b);
		var contextTabs = aPopup.id == this.kSELECTION_MENU ? selectedTabs : tabs ;
		var conditions = this.getShowHideMenuItemsConditions(aPopup, contextTabs);

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
				pref = this.prefs.getPref('extensions.multipletab.show.'+key) &&
						(Boolean(RegExp.$3) == selectType[RegExp.$2]);
			}
			else {
				pref = this.prefs.getPref('extensions.multipletab.show.'+key);
			}

			let available = node.getAttribute(this.kAVAILABLE);
			if (available) {
				available = available.split(/[,\|\s]+/);
				let itemVisible = true;
				Object.keys(conditions).forEach(function(aKey) {
					if (available.indexOf(aKey) > -1)
						itemVisible = itemVisible && conditions[aKey];
				});
				if (pref) pref = !!itemVisible;
			}

			if (pref === null) continue;

			if (pref) {
				node.removeAttribute('hidden');
				let enabled = node.getAttribute(this.kENABLED);
				if (enabled) {
					enabled = enabled.split(/[,\|\s]+/);
					let itemEnabled = true;
					Object.keys(conditions).forEach(function(aKey) {
						if (enabled.indexOf(aKey) > -1)
							itemEnabled = itemEnabled && conditions[aKey];
					});
					if (itemEnabled)
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
		separators.reverse().forEach(function(aSeparator) {
			aSeparator.removeAttribute('hidden');
		});

		var separator;
		while (separator = this.getObsoleteSeparator(aPopup))
		{
			separator.setAttribute('hidden', true);
		}
	},
	
	getSeparators : function MTS_getSeparators(aPopup) 
	{
		return getArrayFromXPathResult(
			'descendant::xul:menuseparator',
			aPopup,
			XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
		);
	},
 
	getObsoleteSeparator : function MTS_getObsoleteSeparator(aPopup) 
	{
		try {
			return evaluateXPath(
				'descendant::xul:menuseparator[not(@hidden)][not(following-sibling::*[not(@hidden)]) or not(preceding-sibling::*[not(@hidden)]) or local-name(following-sibling::*[not(@hidden)]) = "menuseparator"]',
				aPopup,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		}
		catch(e) {
			return null;
		}
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
		if (this.prefs.getPref('extensions.multipletab.close.direction') == this.CLOSE_DIRECTION_LAST_TO_START)
			aTabs.reverse();

		var w = aTabs[0].ownerDocument.defaultView;
		var b = this.getTabBrowserFromChild(aTabs[0]);
		var closeSelectedLast = this.prefs.getPref('extensions.multipletab.close.selectedTab.last');

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

		/* PUBLIC API */
		this.fireTabsClosedEvent(b, aTabs);

		aTabs = null;
	},
  
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
			this.ensureLoaded(tab)
				.then(function(aLoaded) {
					if (!aLoaded)
						tab.linkedBrowser.reload();
				});
		}
	},
 
	saveTabs : function MTS_saveTabs(aTabs, aSaveType, aFolder) 
	{
		if (!aTabs)
			return Promise.resolve();

		aTabs = this.filterBlankTabs(aTabs);

		if (aSaveType === void(0)) {
			aSaveType = this.prefs.getPref('extensions.multipletab.saveTabs.saveType');
		}
		if (aSaveType < 0) {
			aSaveType = this.kSAVE_TYPE_FILE;
		}

		var self = this;

		if (aTabs.length == 1) {
			return this.ensureLoaded(aTabs[0])
				.then(function(aLoaded) {
					var b = aTabs[0].linkedBrowser;
					saveBrowserAs(b, {
						referrerURI : b.referringURI && b.referringURI.spec,
						saveType    : aSaveType
					});
				})
				.catch(function(aError) {
					Components.utils.reportError(aError);
					throw aError;
				});
		}

		if (!aFolder) {
			return this.selectFolder(this.bundle.getString('saveTabs_chooseFolderTitle'))
					.then(function(aFolder) {
						if (aFolder)
							return self.saveTabs(aTabs, aSaveType, aFolder);
					})
					.catch(function(aError) {
						Components.utils.reportError(aError);
						throw aError;
					});
		}

		if (!aFolder.exists()) {
			window.alert('Unexpected error: selected folder "' + aFolder.path + '" does not exist!');
			return Promise.resolve();
		}

		return Promise.all(aTabs.map(function(aTab) {
			return this.ensureLoaded(aTab)
					.then(function(aLoaded) {
						var b = aTab.linkedBrowser;
						saveBrowserInto(b, aFolder.path, {
							name        : aTab.label,
							referrerURI : b.referringURI && b.referringURI.spec,
							saveType    : aSaveType,
							delay       : 200
						});
					});
		}, this));
	},
	
 
	selectFolder : function MTS_selectFolder(aTitle) 
	{
		var picker = Cc['@mozilla.org/filepicker;1']
						.createInstance(Ci.nsIFilePicker);
		picker.init(window, aTitle, picker.modeGetFolder);
		var downloadDir = this.prefs.getPref('browser.download.dir', Ci.nsILocalFile);
		if (downloadDir) picker.displayDirectory = downloadDir;
		picker.appendFilters(picker.filterAll);

		function findExistingFolder(aFile) {
			// Windows's file picker sometimes returns wrong path like
			// "c:\folder\folder" even if I actually selected "c:\folder".
			// However, when the "OK" button is chosen, any existing folder
			// must be selected. So, I find existing ancestor folder from
			// the path.
			while (aFile && !aFile.exists() && aFile.parent)
			{
				aFile = aFile.parent;
			}
			return aFile;
		}

		return new Promise((function(aResolve, aReject) {
			picker.open({ done: function(aResult) {
				if (aResult == picker.returnOK) {
					let folder = picker.file.QueryInterface(Ci.nsILocalFile);
					aResolve(findExistingFolder(folder));
				}
				else {
					aResolve(null);
				}
			}});
		}).bind(this));
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
  
	removeBookmarkFor : function MTS_removeBookmarkFor(aTabs) 
	{
		var BookmarksService = Cc['@mozilla.org/browser/nav-bookmarks-service;1']
								.getService(Ci.nsINavBookmarksService);
		var bookmarks = this.getBookmarksFromTabs(aTabs);
		for (let bookmark of bookmarks)
		{
			BookmarksService.removeItem(bookmark);
		}
	},
	getBookmarksFromTabs : function MTS_getBookmarksFromTabs(aTabs) 
	{
		var allBookmarks = [];
		aTabs.forEach(function(aTab) {
			allBookmarks = allBookmarks.concat(this.getBookmarksFromTab(aTab));
		}, this);
		return allBookmarks;
	},
	getBookmarksFromTab : function MTS_removeBookmarkFor(aTab) 
	{
		var BookmarksService = Cc['@mozilla.org/browser/nav-bookmarks-service;1']
								.getService(Ci.nsINavBookmarksService);
		return BookmarksService.getBookmarkIdsForURI(aTab.linkedBrowser.currentURI, {});
	},
 
	// for Print All Tabs https://addons.mozilla.org/firefox/addon/5142
	printTabs : function MTS_printTabs(aTabs) 
	{
		if (!('PrintAllTabs' in window))
			return Promise.resolve();

		return Promise.all(aTabs.map(this.ensureLoaded, this))
			.then(function() {
				PrintAllTabs.__multipletab__printNodes = aTabs.map(function(aTab) {
					return aTab._tPos;
				});
				PrintAllTabs.onMenuItemCommand(null, false, false);
				PrintAllTabs.__multipletab__printNodes = null;
			});
	},
 
	duplicateTabs : function MTS_duplicateTabs(aTabs, aOpenInBackground) 
	{
		if (!aTabs || !aTabs.length)
			return [];

		aTabs.sort(function(aA, aB) {
			return aA._tPos - aB._tPos;
		});
		var first = aTabs[0];
		var last  = aTabs[aTabs.length - 1];

		var b = this.getTabBrowserFromChild(first);
		var w = b.ownerDocument.defaultView;
		var shouldSelectAfter = this.prefs.getPref('extensions.multipletab.selectAfter.duplicate') && aTabs.length > 1;
		var duplicatedTabs;

		var self = this;
		var operation = function() {
			self.duplicateTabsInternal(b, aTabs, aOpenInBackground)
				.then(function(aDuplicatedTabs) {
					for (let i = 0, maxi = aDuplicatedTabs.length; i < maxi; i++)
					{
						let tab = aDuplicatedTabs[i];
						if (last.ownerDocument == tab.ownerDocument)
							b.moveTabTo(tab, last._tPos + 1 + i);
						if (shouldSelectAfter)
							self.setSelection(tab, true);
					}
				});
		};
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

		return duplicatedTabs;
	},
	
	duplicateTabsInternal : function MTS_duplicateTabsInternal(aTabBrowser, aTabs, aOpenInBackground) 
	{
		var max = aTabs.length;
		if (!max)
			return Promise.resolve([]);

		aTabs = this.sortTabs(aTabs);

		var b = aTabBrowser;
		var w = b.ownerDocument.defaultView;
		var selectedIndex = aTabs.indexOf(b.selectedTab);

		this.duplicatingTabs = true;

		this.clearSelection(b);

		var duplicatedTabs = [];
		var self = this;
		return Promise.all(aTabs.map(this.prepareTabForSwap, this))
			.then(function() {
				return new Promise(function(aResolve, aReject) {
					(function duplicateOneTab() {
						try {
							var sourceTab = aTabs.shift();
							var tab = SessionStore.duplicateTab(w, sourceTab);
							if (tab.__SS_extdata) {
								for (let i = 0, maxi = self._clearTabValueKeys.length; i < maxi; i++)
								{
									delete tab.__SS_extdata[self._clearTabValueKeys[i]];
								}
							}
							duplicatedTabs.push(tab);
							tab.addEventListener('SSTabRestoring', function onSSTabRestoring(aEvent) {
								tab.removeEventListener(aEvent.type, onSSTabRestoring, false)
								if (aTabs.length > 0)
									duplicateOneTab();
								else
									aResolve();
							}, false);
						}
						catch(e) {
							aReject(e);
						}
					})();
				});
			})
			.then(function() {
				self.clearSelection(b);
				if (selectedIndex > -1 && !aOpenInBackground)
					b.selectedTab = duplicatedTabs[selectedIndex];
			})
			.then(function(aDuplicatedTabs) {
				self.duplicatingTabs = false;
				return duplicatedTabs;
			});
	},
  
	splitWindowFromTabs : function MTS_splitWindowFromTabs(aTabs, aRemoteWindow) 
	{
		if (!aTabs || !aTabs.length) return null;

		var self = this;
		return Promise.all(aTabs.map(this.prepareTabForSwap, this))
			.then(function() {
				var b = self.getTabBrowserFromChild(aTabs[0]);

				if (!aRemoteWindow) {
					aRemoteWindow = window.openDialog(location.href, '_blank', 'chrome,all,dialog=no', 'about:blank');
					aRemoteWindow.addEventListener('load', function onload() {
						aRemoteWindow.removeEventListener('load', onload, false);
						aRemoteWindow.setTimeout(function() {
							self.tearOffTabsToNewWindow(aTabs, aRemoteWindow);
						}, 0);
					}, false);
				}
				else {
					self.tearOffTabsToNewWindow(aTabs, aRemoteWindow);
				}

				return aRemoteWindow;
			});
	},
	
	tearOffTabsToNewWindow : function MTS_tearOffTabsToNewWindow(aTabs, aRemoteWindow) 
	{
		var ourBrowser    = this.getTabBrowserFromChild(aTabs[0]);
		var ourWindow     = ourBrowser.ownerDocument.defaultView;
		var remoteBrowser = aRemoteWindow.gBrowser;
		var ourService    = ourWindow.MultipleTabService;
		var remoteService = aRemoteWindow.MultipleTabService;

		var selectAfter = this.prefs.getPref('extensions.multipletab.selectAfter.move');

		var operation = function(aOurParams, aRemoteParams, aData) {
				var allSelected = true;
				var selectionState = aTabs.map(function(aTab) {
						var selected = ourService.isSelected(aTab);
						if (!selected) allSelected = false;
						return selected;
					});

				remoteService.duplicatingTabs = true;

				if (aOurParams)
					aOurParams.wait();
				if (aRemoteParams)
					aRemoteParams.wait();

				aRemoteWindow.setTimeout(function() {
					var remoteBrowser = aRemoteWindow.gBrowser;
					remoteService.importTabsTo(aTabs, remoteBrowser).then(function(aImportedTabs) {
						remoteService.clearSelection(remoteBrowser);
						var tabs = remoteService.getTabsArray(remoteBrowser);
						for (let i = 0, maxi = tabs.length; i < maxi; i++)
						{
							let tab = tabs[i];
							let index = aImportedTabs.indexOf(tab);
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

						if (aData) {
							aData.remote.positions = [];
							aData.remote.tabs = aImportedTabs.map(function(aTab) {
								aData.remote.positions.push(aTab._tPos);
								return aRemoteWindow.UndoTabService.getId(aTab);
							});
						}
						if (aOurParams)
							aOurParams.continue();
						if (aRemoteParams)
							aRemoteParams.continue();
					});
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
		var self = this;
		Promise.resolve()
			.then(function() {
				if (entry != data.remote.entry) return;

				if (remote.tabs.length == data.remote.tabs.length)
					return remote.window.MultipleTabService.importTabsTo(remote.tabs, our.browser)
							.then(function(aImportedTabs) {
								tabs = aImportedTabs;
								UndoTabService.fakeUndo(our.window, data.our.entry);
							});
				else
					UndoTabService.fakeUndo(our.window, data.our.entry);
			})
			.then(function() {
				if (tabs.length == data.our.tabs.length) {
					self.moveTabsByIndex(
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
					self.closeOwner(remote.browser);
			});
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
		remoteWindow.addEventListener('load', function onload() {
			remoteWindow.removeEventListener('load', onload, false);
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
  
	importTabsTo : function MTS_importTabsTo(...aArgs) 
	{
		var aTabs = [],
			aTabBrowser,
			aClone;
		for (let arg of aArgs)
		{
			if (typeof arg == 'boolean') {
				aClone = arg;
			}
			else if (!arg) {
				continue;
			}
			else if (arg instanceof Node) {
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

		this.duplicatingTabs = true;

		var targetBrowser = aTabBrowser || this.browser;
		var targetWindow  = targetBrowser.ownerDocument.defaultView;
		var sourceWindow  = aTabs[0].ownerDocument.defaultView;
		var sourceService = sourceWindow.MultipleTabService;
		var sourceBrowser = sourceService.getTabBrowserFromChild(aTabs[0]);

		var self = this;
		return Promise.all(aTabs.map(this.prepareTabForSwap, this))
			.then(function() {
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
						for (let i = 0, maxi = self._duplicatedTabPostProcesses.length; i < maxi; i++)
						{
							let process = self._duplicatedTabPostProcesses[i];
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
						for (let i = 0, maxi = self._duplicatedTabPostProcesses.length; i < maxi; i++)
						{
							let process = self._duplicatedTabPostProcesses[i];
							process(newTab, newTab._tPos);
						}
						if (!aClone) {
							sourceService.irrevocableRemoveTab(tab, sourceBrowser);
						}
					}
				}

				self.duplicatingTabs = false;

				return importedTabs;
			});
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
		if (!aTabs)
			return Promise.resolve();

		var self = this
		return this.formatURIsForClipboard(aTabs, aFormatType, aFormat)
			.then(function(aCopyData) {
				self.copyToClipboard(aCopyData);
			})
			.catch(function(error) {
				Components.utils.reportError(error);
			});
	},
	formatURIsForClipboard : function MTS_formatURIsForClipboard(aTabs, aFormatType, aFormat)
	{
		if (!aTabs)
			return Promise.resolve('');

		if (aTabs instanceof Node)
			aTabs = [aTabs];

		var format = aFormat || this.getClopboardFormatForType(aFormatType);
		var now = new Date();

		var self = this;
		var start;
		if (isFormatRequiresLoaded(format))
			start = Promise.all(aTabs.map(this.ensureLoaded, this));
		else
			start = Promise.resolve();

		return start
			.then(function() {
				return Promise.all(aTabs.map(function(aTab) {
					return aTab.__multipletab__contentBridge.toCopyText({
						format   : format,
						now      : now,
						lineFeed : self.lineFeed
					});
				}));
			})
			.then(function(aStringsToCopy) {
				if (aStringsToCopy.length > 1)
					aStringsToCopy.push('');

				var isRichText = /%RT%/i.test(format);
				var richText = isRichText ? aStringsToCopy.join('<br />') : null ;
				aStringsToCopy = aStringsToCopy.join(self.lineFeed);

				return {
					string: aStringsToCopy,
					richText: richText,
					toString: function() {
						return aStringsToCopy;
					}
				};
			})
			.catch(function(aError) {
				Components.utils.reportError(aError);
				throw aError;
			});
	},
	copyToClipboard : function MTS_copyToClipboard(aCopyData)
	{
		if (aCopyData.richText) {
			// Borrowed from CoLT
			var trans = Cc['@mozilla.org/widget/transferable;1']
							.createInstance(Ci.nsITransferable);

			// Not sure if section below works as it originally created since I'm not 
			// that familiar with MAF (Mozilla Application Framework)
			var privacyContext = PrivateBrowsingUtils.privacyContextFromWindow(document.commandDispatcher.focusedWindow);
			trans.init(privacyContext);

			// Rich Text HTML Format
			trans.addDataFlavor('text/html');
			var htmlString = Cc['@mozilla.org/supports-string;1']
								.createInstance(Ci.nsISupportsString);
			htmlString.data = aCopyData.richText;
			trans.setTransferData('text/html', htmlString, aCopyData.richText.length * 2);

			// Plain Text Format
			var textString = Cc['@mozilla.org/supports-string;1']
								.createInstance(Ci.nsISupportsString);
			textString.data = aCopyData.string;
			trans.setTransferData('text/unicode', textString, aCopyData.string.length * 2);

			var clipboard = Cc['@mozilla.org/widget/clipboard;1']
								.getService(Ci.nsIClipboard);
			clipboard.setData(trans, null, Ci.nsIClipboard.kGlobalClipboard);
		}
		else {
			Cc['@mozilla.org/widget/clipboardhelper;1']
				.getService(Ci.nsIClipboardHelper)
				.copyString(aCopyData.string, document);
		}
	},
	
	getClopboardFormatForType : function MTS_getClopboardFormatForType(aFormatType) 
	{
		if (aFormatType === void(0))
			aFormatType = this.prefs.getPref('extensions.multipletab.clipboard.formatType');

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
				return this.prefs.getPref('extensions.multipletab.clipboard.format.'+aFormatType);
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
			if (aNewState == this._isTabLocked(tab))
				continue;

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
  
	// Tab suspending commands 
	//   Suspend Tab http://piro.sakura.ne.jp/xul/suspendtab/
	//     SuspendTab.suspend, SuspendTab.resume
	//   UnloadTab https://addons.mozilla.org/firefox/addon/unloadtab/
	//     unloadTabObj.tabUnload, unloadTabObj.tabRestore
	suspendTabs : function MTS_suspendTabs(aTabs) 
	{
		if (!aTabs) return;
		var b = this.getTabBrowserFromChild(aTabs[0]);
		aTabs.forEach(
			'SuspendTab' in window ? // Suspend Tab
				function(aTab) {
					SuspendTab.suspend(aTab);
				} :
			'unloadTabObj' in window ? // UnloadTab
				function(aTab) {
					unloadTabObj.tabUnload(aTab, { bypassCheck: true });
				} :
				function() {}
		);
	},
	resumeTabs : function MTS_resumeTabs(aTabs)
	{
		if (!aTabs) return;
		var b = this.getTabBrowserFromChild(aTabs[0]);
		aTabs.forEach(
			'SuspendTab' in window ? // Suspend Tab
				function(aTab) {
					SuspendTab.resume(aTab);
				} :
			'unloadTabObj' in window ? // UnloadTab
				function(aTab) {
					unloadTabObj.tabRestore(aTab);
				} :
				function() {}
		);
	},
	isAllTabsSuspended : function MTS_isAllTabsSuspended(aTabs)
	{
		return aTabs.every(function(aTab) {
			return this._isTabSuspended(aTab);
		}, this);
	},
	isNoTabSuspended : function MTS_isNoTabSuspended(aTabs)
	{
		return aTabs.every(function(aTab) {
			return !this._isTabSuspended(aTab);
		}, this);
	},
	_isTabSuspended : function MTS__isTabSuspended(aTab)
	{
		return (
			aTab.hasAttribute('pending') || // Suspend Tab
			aTab.hasAttribute('uT_tabUnload') // UnloadTab
		);
	},
	get canSuspendTab()
	{
		return (
			( // Suspend Tab
				'SuspendTab' in window &&
				typeof SuspendTab.suspend == 'function' &&
				typeof SuspendTab.resume == 'function'
			) ||
			( // UnloadTab
				'unloadTabObj' in window &&
				typeof unloadTabObj.tabUnload == 'function' &&
				typeof unloadTabObj.tabRestore == 'function'
			)
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
		for (let i = aTabs.length - 1; i > -1; i--)
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
 
	muteAudio : function MTS_muteAudio(aTabs) 
	{
		if (!aTabs) return;
		var b = this.getTabBrowserFromChild(aTabs[0]);
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			if (aTabs[i].getAttribute('soundplaying') == 'true' &&
				aTabs[i].getAttribute('muted') != 'true')
				aTabs[i].toggleMuteAudio();
		}
	},
	unmuteAudio : function MTS_unmuteAudio(aTabs)
	{
		if (!aTabs) return;
		var b = this.getTabBrowserFromChild(aTabs[0]);
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			if (aTabs[i].getAttribute('soundplaying') == 'true' &&
				aTabs[i].getAttribute('muted') == 'true')
				aTabs[i].toggleMuteAudio();
		}
	},
	isAllTabsMuted : function MTS_isAllTabsMuted(aTabs)
	{
		return aTabs.every(function(aTab) {
			return aTab.getAttribute('soundplaying') != 'true' ||
					aTab.getAttribute('muted') == 'true';
		});
	},
	isNoTabMuted : function MTS_isNoTabMuted(aTabs)
	{
		return aTabs.every(function(aTab) {
			return aTab.getAttribute('soundplaying') != 'true' ||
					aTab.getAttribute('muted') != 'true';
		});
	},
 
	// experimental command 
	moveTabsToGroup : function MTS_moveTabsToGroup(aTabs, aGroupId)
	{
		if (!this.canMoveTabsToGroup)
			return;

		var title;
		if (!aGroupId) {
			switch (this.prefs.getPref('extensions.multipletab.moveTabsToNewGroup.defaultTitle'))
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
					if (!Services.prompt.prompt(window,
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
				if (groupItem.hidden ||
					(activeGroup && activeGroup.id == groupItem.id))
					continue;
				fragment.appendChild(self._createMoveToGroupItem(groupItem));
			}
			if (fragment.hasChildNodes())
				separator.hidden = false;
			aPopup.insertBefore(fragment, separator);
		});
	},
	// see http://mxr.mozilla.org/mozilla-central/ident?i=TabView__createGroupMenuItem
	_createMoveToGroupItem : function MTS_createMoveToGroupItem(aGroupItem)
	{
		let title = aGroupItem.getTitle(true).trim();
		let item = document.createElement('menuitem');
		item.setAttribute('label', title);
		item.setAttribute('group-id', aGroupItem.id);
		return item;
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

		var indicator = b.mTabDropIndicatorBar || b.tabContainer._tabDropIndicator;
		if (indicator)
			indicator.collapsed = true; // hide anyway!
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

		var shouldSelectAfter = this.prefs.getPref('extensions.multipletab.selectAfter.move');

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

			return targetService.importTabsTo(otherSourceTabs, targetBrowser)
				.then(function(importedTabs) {
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

					targetService.setSelection(aNewTab, shouldSelectAfter);
					targetBrowser.movingSelectedTabs = false;

					return result;
				});
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
							operation(true).then(function(result) {
								data.source = result.source;
								data.target = result.target;
							});
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
		var shouldSelectAfter = this.prefs.getPref(isMove ?
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

			return targetService.importTabsTo(otherTabs, targetBrowser, !isMove)
				.then(function(duplicatedTabs) {
					duplicatedTabs.splice(sourceBaseIndex, 0, aNewTab);
					targetService.rearrangeBundledTabsOf(aNewTab, duplicatedTabs);

					if (shouldSelectAfter) {
						for (let i = 0, maxi = duplicatedTabs.length; i < maxi; i++)
						{
							targetService.setSelection(duplicatedTabs[i], true);
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
					var indicator = targetBrowser.mTabDropIndicatorBar || targetBrowser.tabContainer._tabDropIndicator;
					if (indicator)
						indicator.collapsed = true; // hide anyway!

					return result;
				});
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
						operation(true).then(function(result) {
							data.source = result.source;
							data.target = result.target;
						});
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
								operation(true).then(function(result) {
									data.source = result.source;
									data.target = result.target;
								});
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
 
	tearOffSelectedTabsFromRemote : function MTS_tearOffSelectedTabsFromRemote(aRemoteTab) 
	{
		var info = {};
		var tabs = this.getBundledTabsOf(aRemoteTab, info);
		if (tabs.length > 1) {
			if (this.isDraggingAllTabs(aRemoteTab)) {
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
			var xpathResult = evaluateXPath(
					'descendant::xul:tab[@'+this.kSELECTED+' = "true"]',
					(aTabBrowser || this.browser).mTabContainer,
					XPathResult.FIRST_ORDERED_NODE_TYPE
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
	isAllSelected : function MTS_isAllSelected(aTabs)
	{
		if (!aTabs)
			aTabs = this.getTabsArray(this.browser);
		return aTabs.every(function(aTab) {
			return this.isSelected(aTab);
		}, this);
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
 
	isVisible : function MTS_isVisible(aTab) 
	{
		if (aTab.getAttribute('hidden') == 'true' ||
			aTab.getAttribute('collapsed') == 'true' ||
			this.isCollapsed(aTab))
			return false;

		var style = window.getComputedStyle(aTab, '');

		var visibility = style.getPropertyValue('visibility');
		if (visibility == 'collapse' ||
			visibility == 'hidden')
			return false;

		var display = style.getPropertyValue('display');
		if (display == 'none')
			return false;

		return true;
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
		if (!aTab)
			return;

		if (this.debug)
			dump('MTS_setBooleanAttributeToTab '+[aAttr, aState, aShouldSaveToSession, aPropertyName]+'\n'+
					'  '+aTab._tPos+': '+aTab.linkedBrowser.currentURI.spec+'\n');

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
			if (this.debug)
				dump(' => handle collapsed children also.\n');
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
			SessionStore.setTabValue(aTab, aKey, String(aValue));
		}
		catch(e) {
		}

		return aValue;
	},
 
	deleteTabValue : function MTS_deleteTabValue(aTab, aKey) 
	{
		try {
			this.checkCachedSessionDataExpiration(aTab);
			SessionStore.setTabValue(aTab, aKey, '');
			SessionStore.deleteTabValue(aTab, aKey);
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
				SessionStore.setTabValue(aTabs[i], aAttr, '');
				SessionStore.deleteTabValue(aTabs[i], aAttr);
			}
			catch(e) {
			}
		}
	},
 
	invertAllSelection : function MTS_invertAllSelection(aSource) 
	{
		var b = this.getTabBrowserFromChild(aSource) || this.browser;
		var tabs = this.getTabsArray(b);
		tabs.forEach(this.toggleSelection.bind(this));
	},
  
	selectSimilarTabsOf : function MTS_selectSimilarTabsOf(aCurrentTab, aTabs) 
	{
		if (!aCurrentTab) return;

		var tabs = this.getSimilarTabsOf(aCurrentTab, aTabs);
		if (tabs.indexOf(aCurrentTab) < 0)
			tabs.push(aCurrentTab);
		var b = this.getTabBrowserFromChild(aCurrentTab);
		tabs.forEach((function(aTab) {
			this.setSelection(aTab, true);
		}).bind(this));
	},
 
	getTabsInUndeterminedRange : function MTS_getTabsInUndeterminedRange(aSource) 
	{
		var b = this.getTabBrowserFromChild(aSource) || this.browser;
		return getArrayFromXPathResult(
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
	
	observe : function MTS_observe(aSubject, aTopic, aPrefName) 
	{
		if (aTopic != 'nsPref:changed') return;

		var value = this.prefs.getPref(aPrefName);
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
				{
					let parts = value.split('|');
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
  
}, Object); 

function MultipleTabHandlerContentBridge(aTab, aTabBrowser) 
{
	this.init(aTab, aTabBrowser);
}
MultipleTabHandlerContentBridge.prototype = inherit(MultipleTabHandlerConstants, {
	mTab : null,
	mTabBrowser : null,
	init : function MTHCB_init(aTab, aTabBrowser)
	{
		this.mTab = aTab;
		this.mTabBrowser = aTabBrowser;
		this.handleMessage = this.handleMessage.bind(this);
		this.toCopyTextResolvers = {};

		var manager = window.messageManager;
		manager.addMessageListener(this.MESSAGE_TYPE, this.handleMessage);
	},
	destroy : function MTHCB_destroy()
	{
		var manager = window.messageManager;
		manager.removeMessageListener(this.MESSAGE_TYPE, this.handleMessage);

		delete this.mTab;
		delete this.mTabBrowser;
		delete this.toCopyTextResolvers;
	},
	sendAsyncCommand : function MTHCB_sendAsyncCommand(aCommandType, aCommandParams)
	{
		var manager = this.mTab.linkedBrowser.messageManager;
		manager.sendAsyncMessage(this.MESSAGE_TYPE, {
			command : aCommandType,
			params  : aCommandParams || {}
		});
	},
	makeBlank : function MTHCB_makeBlank()
	{
		this.sendAsyncCommand(this.COMMAND_REQUEST_MAKE_BLANK);
	},
	toCopyText : function MTHCB_toCopyText(aParams)
	{
		return new Promise((function(aResolve, aReject) {
			var id = aParams.now.getTime() + '-' + Math.floor(Math.random() * 65000);
			this.sendAsyncCommand(this.COMMAND_REQUEST_COPY_TEXT, {
				id       : id,
				format   : aParams.format,
				now      : aParams.now.getTime(),
				uri      : MultipleTabService.getCurrentURIOfTab(this.mTab).spec,
				title    : this.mTab.getAttribute('label'),
				lineFeed : aParams.lineFeed
			});
			return this.toCopyTextResolvers[id] = aResolve;
		}).bind(this));
	},
	handleMessage : function MTHCB_handleMessage(aMessage)
	{
//		dump('*********************handleMessage*******************\n');
//		dump('TARGET IS: '+aMessage.target.localName+'\n');
//		dump(JSON.stringify(aMessage.json)+'\n');

		if (aMessage.target != this.mTab.linkedBrowser)
		  return;

		switch (aMessage.json.command)
		{
			case this.COMMAND_REPORT_COPY_TEXT:
				var id = aMessage.json.id;
				if (id in this.toCopyTextResolvers) {
					let resolver = this.toCopyTextResolvers[id];
					delete this.toCopyTextResolvers[id];
					resolver(aMessage.json.text);
				}
				return;
		}
	}
}, Object);
var MultipleTabHandlerContentBridge = aGlobal.MultipleTabHandlerContentBridge = MultipleTabHandlerContentBridge;

MultipleTabService.prefs = namespace.prefs;
MultipleTabService.namespace = namespace.getNamespaceFor('piro.sakura.ne.jp')['piro.sakura.ne.jp'];

MultipleTabService.showHideMenuItemsConditionsProviders.push(
	(function bookmarkedProvider(aContextTabs) {
		return {
			'any-bookmarked' : this.getBookmarksFromTabs(aContextTabs).length > 0,
		};
	}).bind(MultipleTabService)
);
MultipleTabService.showHideMenuItemsConditionsProviders.push(
	(function pinnedProvider(aContextTabs) {
		return {
			'not-all-pinned' : !this.isAllTabsPinned(aContextTabs),
			'any-pinned'     : !this.isNoTabPinned(aContextTabs)
		};
	}).bind(MultipleTabService)
);
MultipleTabService.showHideMenuItemsConditionsProviders.push(
	(function mutedProvider(aContextTabs) {
		return {
			'not-all-muted' : !this.isAllTabsMuted(aContextTabs),
			'any-muted'     : !this.isNoTabMuted(aContextTabs)
		};
	}).bind(MultipleTabService)
);
MultipleTabService.showHideMenuItemsConditionsProviders.push(
	(function suspendedProvider(aContextTabs) {
		return {
			'can-suspend-tabs'  : this.canSuspendTab,
			'not-all-suspended' : !this.isAllTabsSuspended(aContextTabs),
			'any-suspended'     : !this.isNoTabSuspended(aContextTabs)
		};
	}).bind(MultipleTabService)
);

window.addEventListener('load', MultipleTabService, false);
window.addEventListener('DOMContentLoaded', MultipleTabService, false);
})(window);
  
