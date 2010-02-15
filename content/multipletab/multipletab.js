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

	kSELECTION_STYLE : 'multipletab-selection-style',
	kSELECTED        : 'multipletab-selected',
	kSELECTED_DUPLICATING : 'multipletab-selected-duplicating',
	kREADY_TO_CLOSE  : 'multipletab-ready-to-close',
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
			this._IOService = Components
					.classes['@mozilla.org/network/io-service;1']
					.getService(Components.interfaces.nsIIOService);
		}
		return this._IOService;
	},
	_IOService : null,
 
	get PromptService() 
	{
		if (!this._PromptService) {
			this._PromptService = Components
					.classes['@mozilla.org/embedcomp/prompt-service;1']
					.getService(Components.interfaces.nsIPromptService);
		}
		return this._PromptService;
	},
	_PromptService : null,
 
	get EffectiveTLD() 
	{
		if (!('_EffectiveTLD' in this)) {
			this._EffectiveTLD = 'nsIEffectiveTLDService' in Components.interfaces ?
				Components
					.classes['@mozilla.org/network/effective-tld-service;1']
					.getService(Components.interfaces.nsIEffectiveTLDService) :
				null ;
		}
		return this._EffectiveTLD;
	},
//	_EffectiveTLD : null,
  
	isDisabled : function MTS_isDisabled() 
	{
		return (document.getElementById('cmd_CustomizeToolbars').getAttribute('disabled') == 'true');
	},
 
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
 
// tabs 
	
	warnAboutClosingTabs : function MTS_warnAboutClosingTabs(aTabsCount) 
	{
		if (
			aTabsCount <= 1 ||
			!this.getPref('browser.tabs.warnOnClose')
			)
			return true;
		var checked = { value:true };
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
		if (shouldClose && !checked.value)
			this.setPref('browser.tabs.warnOnClose', false);
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
 
	getSelectedTabs : function MTS_getSelectedTabs(aTabBrowser) 
	{
		return this.getArrayFromXPathResult(
				'descendant::xul:tab[@'+this.kSELECTED+'="true"]',
				(aTabBrowser || this.browser).mTabContainer
			);
	},
 
	getReadyToCloseTabs : function MTS_getReadyToCloseTabs(aTabBrowser) 
	{
		return this.getArrayFromXPathResult(
				'descendant::xul:tab[@'+this.kREADY_TO_CLOSE+'="true"]',
				(aTabBrowser || this.browser).mTabContainer
			);
	},
 
	getLeftTabsOf : function MTS_getLeftTabsOf(aTab) 
	{
		return this.getArrayFromXPathResult(
				'preceding-sibling::xul:tab',
				aTab
			);
	},
 
	getRightTabsOf : function MTS_getRightTabsOf(aTab) 
	{
		return this.getArrayFromXPathResult(
				'following-sibling::xul:tab',
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
			var currentDomain = this.getDomainFromURI(aCurrentTab.linkedBrowser.currentURI);
		}
		catch(e) {
			return resultTabs;
		}

		Array.slice(aTabs).forEach(function(aTab) {
			if (aTab == aCurrentTab) return;
			if (this.getDomainFromURI(aTab.linkedBrowser.currentURI) == currentDomain)
				resultTabs.push(aTab);
		}, this);
		return resultTabs;
	},
	getDomainFromURI : function MTS_getDomainFromURI(aURI)
	{
		if (!aURI) return null;
		try {
			if (!(aURI instanceof Ci.nsIURI)) aURI = this.makeURIFromSpec(aURI);
		}
		catch(e) {
			return null;
		}
		if (this.getPref('extensions.multipletab.useEffectiveTLD') && this.EffectiveTLD) {
			try {
				var domain = this.EffectiveTLD.getBaseDomain(aURI, 0);
				if (domain) return domain;
			}
			catch(e) {
			}
		}
		try {
			var host = aURI.host;
			return host;
		}
		catch(e) {
		}
		return null;
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
				'ancestor-or-self::xul:tab[ancestor::xul:tabbrowser]',
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
				'ancestor-or-self::xul:tab[ancestor::xul:tabbrowser]',
				aNode,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getTabBrowserFromChild : function MTS_getTabBrowserFromChild(aTab) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:tabbrowser',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getTabs : function MTS_getTabs(aTabBrowser) 
	{
		return this.evaluateXPath(
				'descendant::xul:tab',
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
				'following-sibling::xul:tab[1]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getPreviousTab : function MTS_getPreviousTab(aTab) 
	{
		return this.evaluateXPath(
				'preceding-sibling::xul:tab[1]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
	
	// old method (for backward compatibility) 
	getTabBrowserFromChildren : function MTS_getTabBrowserFromChildren(aTab)
	{
		return this.getTabBrowserFromChild(aTab);
	},
  
	filterBlankTabs : function MTS_filterBlankTabs(aTabs) 
	{
		return aTabs.filter(function(aTab) {
				return aTab.linkedBrowser.currentURI.spec != 'about:blank' ||
						// for BarTap ( https://addons.mozilla.org/firefox/addon/67651 )
						aTab.getAttribute('ontap') == 'true';
			});
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

		delete aTab.linkedBrowser.__SS_data; // Firefox 3.6-
		delete aTab.linkedBrowser.parentNode.__SS_data; // -Firefox 3.5
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
				_tabStillLoading : true, // for Firefox 3.5 or later
				_tab : aTab // for Firefox 3.0.x
			};
		aTab.linkedBrowser.__SS_data = data; // Firefox 3.6-
		aTab.linkedBrowser.parentNode.__SS_data = data; // -Firefox 3.5

		(aTabBrowser || this.getTabBrowserFromChild(aTab))
			.removeTab(aTab);
	},
 
	ensureLoaded : function MTS_ensureLoaded(aTab) 
	{
		// for BarTap ( https://addons.mozilla.org/firefox/addon/67651 )
		if (aTab.getAttribute('ontap') == 'true') {
			var event = document.createEvent('Event');
			event.initEvent('BarTapLoad', true, true);
			aTab.linkedBrowser.dispatchEvent(event);
			return true;
		}
		return false;
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
		Array.slice(arguments).forEach(function(aArg) {
			if (aArg instanceof Components.interfaces.nsIDOMNode)
				baseTab = aArg;
			else if (typeof aArg == 'number')
				oldBasePosition = aArg;
			else if (typeof aArg == 'object')
				tabs = aArg;
		});

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
		rearranged.forEach(function(aTab, aNewPosition) {
			if (otherTabs.indexOf(aTab) < 0) return;

			var previousTab = aNewPosition > 0 ? rearranged[aNewPosition-1] : null ;
			if (previousTab)
				aNewPosition = previousTab._tPos + 1;
			if (aNewPosition > aTab._tPos)
				aNewPosition--;
			if (aTab._tPos != aNewPosition)
				b.moveTabTo(aTab, aNewPosition);
		});
		b.movingSelectedTabs = false;
	},
 
	moveTabsByIndex : function MTS_moveTabsByIndex(aTabBrowser, aOldPositions, aNewPositions) 
	{
		// step 1: calculate new positions of all tabs
		var restOldPositions = [];
		var restNewPositions = [];
		var tabs = this.getTabsArray(aTabBrowser);
		tabs.forEach(function(aTab, aIndex) {
			if (aOldPositions.indexOf(aIndex) < 0)
				restOldPositions.push(aIndex);
			if (aNewPositions.indexOf(aIndex) < 0)
				restNewPositions.push(aIndex);
		});

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
		rearranged.forEach(function(aTab, aNewPosition) {
			var index = aOldPositions.indexOf(allOldPositions[aNewPosition]);
			if (index < 0) return; // it's not a target!
			var newPosition = aNewPositions[index ];
			var previousTab = newPosition > 0 ? rearranged[newPosition-1] : null ;
			if (previousTab)
				newPosition = previousTab._tPos + 1;
			if (newPosition > aTab._tPos)
				newPosition--;
			if (aTab._tPos != newPosition)
				aTabBrowser.moveTabTo(aTab, newPosition);
		});
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
 
	getCloseboxFromEvent : function MTS_getCloseboxFromEvent(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ",@class," "), " tab-close-button ")]',
				aEvent.originalTarget || aEvent.target,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	isAccelKeyPressed : function MTS_isAccelKeyPressed(aEvent) 
	{
		return navigator.platform.toLowerCase().indexOf('mac') > -1 ? aEvent.metaKey : aEvent.ctrlKey ;
	},
  
// fire custom events 
	
	fireDuplicatedEvent : function MTS_fireDuplicatedEvent(aNewTab, aSourceTab, aSourceEvent) 
	{
		var event = aNewTab.ownerDocument.createEvent('Events');
		event.initEvent('MultipleTabHandler:TabDuplicate', true, false);
		event.sourceTab = aSourceTab;
		event.mayBeMove = aSourceEvent && !this.isAccelKeyPressed(aSourceEvent);
		aNewTab.dispatchEvent(event);
	},
 
	fireWindowMoveEvent : function MTS_fireWindowMoveEvent(aNewTab, aSourceTab) 
	{
		var event = document.createEvent('Events');
		event.initEvent('MultipleTabHandler:TabWindowMove', true, false);
		event.sourceTab = aSourceTab;
		aNewTab.dispatchEvent(event);
	},
 
	fireTabsClosingEvent : function MTS_fireTabsClosingEvent(aTabs) 
	{
		if (!aTabs || !aTabs.length) return false;
		var d = aTabs[0].ownerDocument;
		/* PUBLIC API */
		var event = d.createEvent('Events');
		event.initEvent('MultipleTabHandlerTabsClosing', true, true);
		event.tabs = aTabs;
		event.count = aTabs.length;
		return this.getTabBrowserFromChild(aTabs[0]).dispatchEvent(event);
	},
 
	fireTabsClosedEvent : function MTS_fireTabsClosedEvent(aTabBrowser, aTabs) 
	{
		if (!aTabs || !aTabs.length) return false;
		aTabs = aTabs.filter(function(aTab) { return !aTab.parentNode; });
		var d = aTabBrowser.ownerDocument;
		/* PUBLIC API */
		var event = d.createEvent('Events');
		event.initEvent('MultipleTabHandlerTabsClosed', true, false);
		event.tabs = aTabs;
		event.count = aTabs.length;
		aTabBrowser.dispatchEvent(event);
	},
  
	createDragFeedbackImage : function MTS_createDragFeedbackImage(aNode) 
	{
		var tabs = this.getDraggedTabs(aNode);
		if (tabs.length < 2) return null;

		var canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
		var offset = tabs[0].boxObject.height * 0.66;
		var padding = offset * (tabs.length - 1);
		var width = tabs[0].boxObject.width + (padding * 0.66);
		var height = tabs[0].boxObject.height + padding;
		canvas.width = width;
		canvas.height = height;
		try {
			var ctx = canvas.getContext('2d');
			ctx.clearRect(0, 0, width, height);
			tabs.forEach(function(aTab, aIndex) {
				var box = aTab.boxObject;
				ctx.drawWindow(window, box.x, box.y, box.width, box.height, 'transparent');
				ctx.translate(offset * 0.66, offset);
			}, this);
			var image = new Image();
			image.src = canvas.toDataURL()
			return image;
		}
		catch(e) {
			return null;
		}
	},
	getDragFeedbackImageX : function MTS_getDragFeedbackImageX(aNode)
	{
		var tabs = this.getDraggedTabs(aNode);
		if (tabs.length < 2) return 0;
		return 16;
	},
	getDragFeedbackImageY : function MTS_getDragFeedbackImageY(aNode)
	{
		var tabs = this.getDraggedTabs(aNode);
		if (tabs.length < 2) return 0;
		return 16;
	},
	getDraggedTabs : function MTS_getDraggedTabs(aNode)
	{
		var b = this.getTabBrowserFromChild(aNode);
		var tabs = b ? this.getSelectedTabs(b) : [] ;
		return tabs;
	},
  
/* Initializing */ 
	
	init : function MTS_init() 
	{
		if (!('gBrowser' in window)) return;

		window.addEventListener('mouseup', this, true);

		window.removeEventListener('load', this, false);
		window.addEventListener('unload', this, false);

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
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.clipboard.linefeed');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.clipboard.formats');

/*
		if ('nsDragAndDrop' in window &&
			'startDrag' in nsDragAndDrop) {
			eval('nsDragAndDrop.startDrag = '+nsDragAndDrop.startDrag.toSource().replace(
				/(invokeDragSessionWithImage\([^\)]+,\s*)null\s*,\s*0,\s*0(\s*,[^\)]+\))/,
				'$1MultipleTabService.createDragFeedbackImage(aEvent.target), MultipleTabService.getDragFeedbackImageX(aEvent.target), MultipleTabService.getDragFeedbackImageY(aEvent.target)$2'
			));
		}
*/

		if ('internalSave' in window) {
			eval('window.internalSave = '+window.internalSave.toSource().replace(
				'var useSaveDocument =',
				<![CDATA[
					if (aChosenData && 'saveAsType' in aChosenData) {
						saveAsType = aChosenData.saveAsType;
						saveMode = SAVEMODE_FILEONLY | SAVEMODE_COMPLETE_TEXT;
					}
				$&]]>
			).replace(
				/(!aChosenData)( && useSaveDocument && saveAsType == kSaveAsType_Text)/,
				'($1 || "saveAsType" in aChosenData)$2'
			));
		}

		[
			'tm-freezeTab\tmultipletab-selection-freezeTabs',
			'tm-protectTab\tmultipletab-selection-protectTabs',
			'tm-lockTab\tmultipletab-selection-lockTabs'
		].forEach(function(aIDs) {
			aIDs = aIDs.split('\t');
			var source = document.getElementById(aIDs[0]);
			var target = document.getElementById(aIDs[1]);
			if (source)
				target.setAttribute('label', source.getAttribute('label'));
		}, this);

		this.initTabBrowser(gBrowser);

		this.overrideExtensionsOnInit(); // hacks.js

		window.setTimeout(function(aSelf) { aSelf.delayedInit(); }, 0, this);
	},
	
	preInit : function MTS_preInit() 
	{
		window.removeEventListener('DOMContentLoaded', this, false);

		var b = document.getElementById('content');
		if (b && 'swapBrowsersAndCloseOther' in b) {
			eval('window.BrowserStartup = '+window.BrowserStartup.toSource().replace(
				'gBrowser.swapBrowsersAndCloseOther(gBrowser.selectedTab, uriToLoad);',
				'if (!MultipleTabService.tearOffSelectedTabsFromRemote()) { $& }'
			));
		}

		this.overrideExtensionsOnPreInit(); // hacks.js
	},
 
	delayedInit : function MTS_delayedInit() 
	{
		this.overrideExtensionsOnDelayedInit(); // hacks.js
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
		aTabBrowser.addEventListener('TabOpen', this, true);
		aTabBrowser.addEventListener('TabClose', this, true);
		aTabBrowser.addEventListener('TabMove', this, true);
		aTabBrowser.addEventListener('MultipleTabHandler:TabDuplicate', this, true);
		aTabBrowser.addEventListener('MultipleTabHandler:TabWindowMove', this, true);
//		aTabBrowser.mTabContainer.addEventListener('dragstart',   this, true);
		aTabBrowser.mTabContainer.addEventListener('draggesture', this, true);
		aTabBrowser.mTabContainer.addEventListener('mouseover',   this, true);
		aTabBrowser.mTabContainer.addEventListener('mousemove',   this, true);
		aTabBrowser.mTabContainer.addEventListener('mousedown',   this, true);

/*
		eval('aTabBrowser.onDragStart = '+aTabBrowser.onDragStart.toSource().replace(
			'aXferData.data.addDataForFlavour("text/unicode", URI.spec);',
			<![CDATA[
				var selectedTabs = MultipleTabService.getSelectedTabs(this);
				if (MultipleTabService.isSelected(aEvent.target) &&
					MultipleTabService.allowMoveMultipleTabs) {
					aXferData.data.addDataForFlavour(
						'text/unicode',
						selectedTabs.map(function(aTab) {
							return aTab.linkedBrowser.currentURI.spec;
						}).join('\n')
					);
				}
				else {
					$&
				}
			]]>
		).replace(
			/(aXferData.data.addDataForFlavour\("text\/html", [^\)]+\);)/,
			<![CDATA[
				if (MultipleTabService.isSelected(aEvent.target) &&
					MultipleTabService.allowMoveMultipleTabs) {
					aXferData.data.addDataForFlavour(
						'text/html',
						selectedTabs.map(function(aTab) {
							return '<a href="' + aTab.linkedBrowser.currentURI.spec + '">' + aTab.label + '</a>';
						}).join('\n')
					);
				}
				else {
					$1
				}
			]]>
		));
*/

		eval('aTabBrowser.duplicateTab = '+aTabBrowser.duplicateTab.toSource().replace(
			')',
			', aSourceEvent)'
		).replace(
			'{',
			'{ return MultipleTabService.onDuplicateTab(function() {'
		).replace(
			/(\}\)?)$/,
			<![CDATA[
					},
					this,
					aTab,
					aSourceEvent
				);
			$1]]>
		));

		if ('_onDrop' in aTabBrowser && 'swapBrowsersAndCloseOther' in aTabBrowser) {
			eval('aTabBrowser._onDrop = '+aTabBrowser._onDrop.toSource().replace(
				/(this\.swapBrowsersAndCloseOther\([^;]+\);)/,
				'MultipleTabService.fireWindowMoveEvent(newTab, draggedTab); $1'
			));
			aTabBrowser.__multipletab__canDoWindowMove = true;
		}
		else {
			if ('onDrop' in aTabBrowser) {
				eval('aTabBrowser.onDrop = '+aTabBrowser.onDrop.toSource().replace(
					/(this\.duplicateTab\([^\)]+)(\))/g,
					'$1, aEvent$2'
				));
			}
			aTabBrowser.__multipletab__canDoWindowMove = false;
		}

		if ('_onDragEnd' in aTabBrowser) {
			eval('aTabBrowser._onDragEnd = '+aTabBrowser._onDragEnd.toSource().replace(
				/([^\{\}\(\);]*this\.replaceTabWithWindow\()/,
				'if (MultipleTabService.isDraggingAllTabs(draggedTab)) return; $1'
			));
		}

		this.initTabBrowserContextMenu(aTabBrowser);

		this.getTabsArray(aTabBrowser).forEach(function(aTab) {
			this.initTab(aTab);
		}, this);
	},
	
	initTabBrowserContextMenu : function MTS_initTabBrowserContextMenu(aTabBrowser) 
	{
		var suffix = '-tabbrowser-'+(aTabBrowser.id || 'instance-'+parseInt(Math.random() * 65000));
		var tabContextMenu = document.getAnonymousElementByAttribute(aTabBrowser, 'anonid', 'tabContextMenu');
		var template = document.getElementById(this.kCONTEXT_MENU_TEMPLATE);
		this.getArrayFromXPathResult('child::*[starts-with(@id, "multipletab-context-")]', template)
			.concat(this.getArrayFromXPathResult('child::*[not(@id) or not(starts-with(@id, "multipletab-context-"))]', template))
			.forEach(function(aItem) {
				let item = aItem.cloneNode(true);
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
			}, this);

		tabContextMenu.addEventListener('popupshowing', this, false);
	},
  
	initTab : function MTS_initTab(aTab) 
	{
		aTab.addEventListener('mousemove', this, true);
	},
  
	destroy : function MTS_destroy() 
	{
		this.destroyTabBrowser(gBrowser);
		window.addEventListener('mouseup', this, true);

		window.removeEventListener('unload', this, false);
		window.removeEventListener('UIOperationHistoryPreUndo:TabbarOperations', this, false);
		window.removeEventListener('UIOperationHistoryUndo:TabbarOperations', this, false);
		window.removeEventListener('UIOperationHistoryRedo:TabbarOperations', this, false);
		window.removeEventListener('UIOperationHistoryPostRedo:TabbarOperations', this, false);

		this.removePrefListener(this);

		this.getTabsArray(gBrowser).forEach(function(aTab) {
			this.destroyTab(aTab);
		}, this);

		var tabContextMenu = document.getAnonymousElementByAttribute(gBrowser, 'anonid', 'tabContextMenu');
		tabContextMenu.removeEventListener('popupshowing', this, false);
	},
	
	destroyTabBrowser : function MTS_destroyTabBrowser(aTabBrowser) 
	{
		aTabBrowser.removeEventListener('TabOpen', this, true);
		aTabBrowser.removeEventListener('TabClose', this, true);
		aTabBrowser.removeEventListener('TabMove', this, true);
		aTabBrowser.removeEventListener('MultipleTabHandler:TabDuplicate', this, true);
		aTabBrowser.removeEventListener('MultipleTabHandler:TabWindowMove', this, true);
//		aTabBrowser.mTabContainer.removeEventListener('dragstart',   this, true);
		aTabBrowser.mTabContainer.removeEventListener('draggesture', this, true);
		aTabBrowser.mTabContainer.removeEventListener('mouseover',   this, true);
		aTabBrowser.mTabContainer.removeEventListener('mousemove',   this, true);
		aTabBrowser.mTabContainer.removeEventListener('mousedown',   this, true);

		var tabContextMenu = document.getAnonymousElementByAttribute(aTabBrowser, 'anonid', 'tabContextMenu');
		tabContextMenu.removeEventListener('popupshowing', this, false);
	},
 
	destroyTab : function MTS_destroyTab(aTab) 
	{
		this.setSelection(aTab, false);
		if (!this.hasSelection())
			this.selectionModified = false;

		aTab.removeEventListener('mousemove', this, true);
	},
   
/* Event Handling */ 
	
	handleEvent : function MTS_handleEvent(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'mousedown':
				this.lastMouseDownX = aEvent.screenX;
				this.lastMouseDownY = aEvent.screenY;
				this.onTabClick(aEvent);
				break;

//			case 'dragstart':
//				break;

			case 'draggesture':
				this.onTabDragStart(aEvent);
				break;

			case 'mouseup':
				this.onTabDragEnd(aEvent);
				break;

			case 'mouseover':
				this.onTabDragEnter(aEvent);
				break;

			case 'mousemove':
				this.onTabDragOver(aEvent);
				break;

			case 'TabOpen':
				this.initTab(aEvent.originalTarget);
				break;

			case 'TabClose':
				this.destroyTab(aEvent.originalTarget);
				break;

			case 'TabMove':
				if (
					this.isSelected(aEvent.originalTarget) &&
					this.allowMoveMultipleTabs &&
					!aEvent.currentTarget.movingSelectedTabs &&
					(!('UndoTabService' in window) || UndoTabService.isUndoable())
					)
					this.moveBundledTabsOf(aEvent.originalTarget, aEvent);
				break;

			case 'MultipleTabHandler:TabDuplicate':
				if (
					this.isSelected(aEvent.sourceTab) &&
					this.allowMoveMultipleTabs &&
					!aEvent.currentTarget.duplicatingSelectedTabs &&
					(!('UndoTabService' in window) || UndoTabService.isUndoable())
					)
					this.duplicateBundledTabsOf(aEvent.originalTarget, aEvent.sourceTab, aEvent.mayBeMove);
				break;

			case 'MultipleTabHandler:TabWindowMove':
				if (
					this.isSelected(aEvent.sourceTab) &&
					this.allowMoveMultipleTabs &&
					!aEvent.currentTarget.duplicatingSelectedTabs &&
					(!('UndoTabService' in window) || UndoTabService.isUndoable())
					)
					this.importBundledTabsOf(aEvent.originalTarget, aEvent.sourceTab);
				break;

			case 'DOMContentLoaded':
				this.preInit();
				break;

			case 'load':
				this.init();
				break;

			case 'unload':
				this.destroy();
				break;

			case 'popupshowing':
				if (
					aEvent.target.id != this.kSELECTION_MENU &&
					this.hasSelection()
					) {
					this.showSelectionPopup({
						screenX : this.lastMouseDownX,
						screenY : this.lastMouseDownY,
					});
					aEvent.preventDefault();
					aEvent.stopPropagation();
					return false;
				}
				this.enableMenuItems(aEvent.target);
				this.showHideMenuItems(aEvent.target);
				this.updateMenuItems(aEvent.target);
				break;


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
			var b = this.getTabBrowserFromChild(tab);
			if (aEvent.shiftKey) {
				if (this.tabShiftClickMode != this.TAB_CLICK_MODE_SELECT)
					return;
				var tabs = b.mTabContainer.childNodes;
				var inSelection = false;
				this.getTabsArray(b).forEach(function(aTab) {
					if (aTab.getAttribute('hidden') == 'true' ||
						aTab.getAttribute('collapsed') == 'true')
						return;

					if (aTab == b.selectedTab ||
						aTab == tab) {
						inSelection = !inSelection;
						this.setSelection(aTab, true);
					}
					else {
						this.setSelection(aTab, inSelection);
					}
				}, this);
				aEvent.preventDefault();
				aEvent.stopPropagation();
				return;
			}
			else if (this.isAccelKeyPressed(aEvent)) {
				if (this.tabAccelClickMode != this.TAB_CLICK_MODE_SELECT) {
					b.removeTab(tab);
					return;
				}

				if (!this.selectionModified && !this.hasSelection())
					this.setSelection(b.selectedTab, true);

				this.toggleSelection(tab);
				aEvent.preventDefault();
				aEvent.stopPropagation();
				return;
			}
			else if (this.tabDragMode != this.TAB_DRAG_MODE_DEFAULT) {
				var delay = this.getPref('extensions.multipletab.tabdrag.delay');
				if (delay > 0) {
					this.cancelDelayedDragStart();
					this.lastMouseDown = Date.now();
					this.delayedDragStartTimer = window.setTimeout(this.delayedDragStart, delay, this, aEvent);
				}
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
	
	delayedDragStart : function MTS_delayedDragStart(aSelf, aEvent) 
	{
		aSelf.clearSelection();
		aSelf.tabDragging = false; // cancel "dragging" before we start to drag it really.
		aSelf.delayedDragStartReady = true;
		aSelf.onTabDragStart(aEvent, true);
	},
	cancelDelayedDragStart : function MTS_cancelDelayedDragStart()
	{
		if (this.delayedDragStartTimer) {
			window.clearTimeout(this.delayedDragStartTimer);
			this.delayedDragStartTimer = null;
		}
	},
	delayedDragStartTimer : null,
  
	onTabDragStart : function MTS_onTabDragStart(aEvent, aIsTimeout) 
	{
		this.cancelDelayedDragStart();

		var tab = this.getTabFromEvent(aEvent);
		if (!tab) {
			this.lastMouseOverTarget = null;
			return;
		}

		if (
			tab.mOverCloseButton ||
			tab.tmp_mOverCloseButton // Tab Mix Plus
			) {
			this.tabCloseboxDragging = true;
			this.lastMouseOverTarget = this.getCloseboxFromEvent(aEvent);
			this.clearSelectionSub(this.getSelectedTabs(this.getTabBrowserFromChild(tab)), this.kSELECTED);
			this.setReadyToClose(tab, true);
		}
		else if (
			this.isEventFiredOnTabIcon(aEvent) ||
			this.tabDragMode == this.TAB_DRAG_MODE_DEFAULT
			) {
			return;
		}
		else {
			var delay = this.getPref('extensions.multipletab.tabdrag.delay');
			if (
				delay > 0 &&
				(Date.now() - this.lastMouseDown < delay) &&
				!aIsTimeout
				) {
				return
			}
			this.tabDragging = true;
			this.delayedDragStartReady = false;
			this.lastMouseOverTarget = tab;
			if (this.tabDragMode == this.TAB_DRAG_MODE_SELECT)
				this.setSelection(tab, true);
		}

		aEvent.preventDefault();
		aEvent.stopPropagation();
	},
	tabDragging         : false,
	tabCloseboxDragging : false,
	lastMouseOverTarget : null,
	lastMouseDown       : 0,
 
	onTabDragEnd : function MTS_onTabDragEnd(aEvent) 
	{
		this.cancelDelayedDragStart();

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
		this.delayedDragStartReady = false;

		this.lastMouseOverTarget = null;
	},
 
	onTabDragEnter : function MTS_onTabDragEnter(aEvent) 
	{
		if (!(
				this.tabDragging ||
				this.tabCloseboxDragging
			) || this.isDisabled())
			return;

		var b = this.getTabBrowserFromChild(aEvent.originalTarget);
		var arrowscrollbox = b.mTabContainer.mTabstrip;
		if (aEvent.originalTarget == document.getAnonymousElementByAttribute(arrowscrollbox, 'class', 'scrollbutton-up')) {
			arrowscrollbox._startScroll(-1);
		}
		else if (aEvent.originalTarget == document.getAnonymousElementByAttribute(arrowscrollbox, 'class', 'scrollbutton-down')) {
			arrowscrollbox._startScroll(1);
		}
	},
 
	onTabDragOver : function MTS_onTabDragOver(aEvent) 
	{
		if (!(
				this.tabDragging ||
				this.tabCloseboxDragging
			) || this.isDisabled())
			return;

		if (this.tabDragging || this.tabCloseboxDragging) {
			window['piro.sakura.ne.jp'].autoScroll.processAutoScroll(aEvent);
		}

		if (this.tabDragging) {
			var tab = this.getTabFromEvent(aEvent, true);
			if (tab == this.lastMouseOverTarget) return;

			if (!tab) {
				this.lastMouseOverTarget = null;
				return;
			}

			this.lastMouseOverTarget = tab;

			switch(this.tabDragMode)
			{
				case this.TAB_DRAG_MODE_SELECT:
					this.toggleSelection(tab);
					break;

				case this.TAB_DRAG_MODE_SWITCH:
					var b = this.getTabBrowserFromChild(tab);
					b.selectedTab = tab;
					break;

				default:
					break;
			}
		}
		else if (this.tabCloseboxDragging) {
			if (aEvent.originalTarget == this.lastMouseOverTarget) return;

			this.lastMouseOverTarget = aEvent.originalTarget;

			if (!this.getCloseboxFromEvent(aEvent)) return;

			var tab = this.getTabFromEvent(aEvent, true);
			this.toggleReadyToClose(tab);
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
		var popup = this.tabSelectionPopup;
		popup.hidePopup();
		popup.autoClearSelection = aAutoClearSelection;
		document.popupNode = this.browser.mTabContainer;
		if ('openPopupAtScreen' in popup) // Firefox 3
			popup.openPopupAtScreen(aEvent.screenX, aEvent.screenY, true);
		else
			popup.showPopup(
				document.documentElement,
				aEvent.screenX - document.documentElement.boxObject.screenX,
				aEvent.screenY - document.documentElement.boxObject.screenY,
				'popup'
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
		var b   = this.getTabBrowserFromChild(aPopup) || this.browser;
		var box = b.mTabContainer.mTabstrip || b.mTabContainer ;
		var isVertical = ((box.getAttribute('orient') || window.getComputedStyle(box, '').getPropertyValue('-moz-box-orient')) == 'vertical');

		var selectableItemsRegExp = new RegExp(
				'^(multipletab-(?:context|selection)-('+
				this.selectableItems.map(function(aItem) {
					return aItem.name;
				}).join('|')+
				'))(:select)?$'
			);

		var selectType = {};
		this.selectableItems.forEach(function(aItem) {
			selectType[aItem.name] = this.getPref(aItem.key) < 0;
		}, this);

		var selectedTabs = this.getSelectedTabs(b);
		var tabbrowser = b;
		var tabs = this.getTabsArray(b);
		Array.slice(aPopup.childNodes).forEach(function(aNode, aIndex) {
			var label;
			if (
				(isVertical && (label = aNode.getAttribute('label-vertical'))) ||
				(!isVertical && (label = aNode.getAttribute('label-horizontal')))
				)
				aNode.setAttribute('label', label);

			var key = aNode.getAttribute('id').replace(/-tabbrowser-.*$/, '');
			var pref;
			if (selectableItemsRegExp.test(key)) {
				key  = RegExp.$1
				pref = this.getPref('extensions.multipletab.show.'+key) &&
						(Boolean(RegExp.$3) == selectType[RegExp.$2]);
			}
			else {
				pref = this.getPref('extensions.multipletab.show.'+key);
			}

			var available = aNode.getAttribute(this.kAVAILABLE);
			if (available) {
				/* tabbrowser
				   tabs
				   selectedTabs */
				eval('available = ('+available+')');
				if (!available) pref = false;
			}

			if (pref === null) return;

			if (pref) {
				aNode.removeAttribute('hidden');
				var enabled = aNode.getAttribute(this.kENABLED);
				if (enabled) {
					/* tabbrowser
					   tabs
					   selectedTabs */
					eval('enabled = ('+enabled+')');
					if (enabled)
						aNode.removeAttribute('disabled');
					else
						aNode.setAttribute('disabled', true);
				}
			}
			else {
				aNode.setAttribute('hidden', true);
			}
		}, this);

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
			this.formats.forEach(function(aItem) {
				let item = document.createElement('menuitem');
				item.setAttribute('label', aItem.label);
				item.setAttribute('value', aItem.format);
				item.setAttribute('format-type', aItem.id);
				fragment.appendChild(item);
			}, this);
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
			aTabs.forEach(function(aTab) {
				if (closeSelectedLast && aTab.selected)
					selected = aTab;
				else
					b.removeTab(aTab);
			});
			if (selected)
				b.removeTab(selected);
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
		var tabs = this.getTabsArray(b);

		if (!this.warnAboutClosingTabs(tabs.length - aTabs.length))
			return;

		var removeTabs = [];
		tabs.forEach(function(aTab) {
			if (aTabs.indexOf(aTab) < 0) removeTabs.push(aTab);
		});

		this.closeTabsInternal(removeTabs);
	},
 
	reloadTabs : function MTS_reloadTabs(aTabs) 
	{
		if (!aTabs) return;

		aTabs = this.filterBlankTabs(aTabs);
		if (!aTabs.length) return;

		var b = this.getTabBrowserFromChild(aTabs[0]);
		aTabs.forEach(function(aTab) {
			if (!this.ensureLoaded(aTab))
				b.reloadTab(aTab);
		}, this);
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
		aTabs.forEach(function(aTab) {
			if (this.ensureLoaded(aTab)) {
				window.setTimeout(function(aSelf) {
					arguments.callee.call(aSelf);
				}, 200, this);
				return;
			}
			var b = aTab.linkedBrowser;
			var destFile = folder.clone();
			var uri = b.currentURI;
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
		var uri = b.currentURI;

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
			if (shouldSelectAfter)
				duplicatedTabs.forEach(function(aTab) {
					self.setSelection(aTab, true);
				});
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
				this._clearTabValueKeys.forEach(function(aKey) {
					delete state.extData[aKey];
				});
				state = state.toSource();
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
					remoteService.getTabsArray(remoteBrowser)
						.forEach(function(aTab) {
							var index = importedTabs.indexOf(aTab);
							if (index > -1) {
								if (
									!allSelected &&
									selectionState[index] &&
									selectAfter
									) {
									remoteService.setSelection(aTab, true);
								}
							}
							else {
								// causes error. why?
								// remoteService.irrevocableRemoveTab(aTab, remoteBrowser);
								remoteBrowser.removeTab(aTab);
							}
						});
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
					remote.browser.removeTab(aTab);
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
		Array.slice(arguments).forEach(function(aArg) {
			if (typeof aArg == 'boolean') {
				aClone = aArg;
			}
			else if (!aArg) {
				return;
			}
			else if (aArg instanceof Components.interfaces.nsIDOMNode) {
				if (aArg.localName == 'tabbrowser')
					aTabBrowser = aArg;
				else if (aArg.localName == 'tab')
					aTabs.push(aArg);
			}
			else if (typeof aArg == 'object') {
				aTabs = aTabs.concat(aArg);
			}
		});

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

		if (targetBrowser.__multipletab__canDoWindowMove && !aClone) {// move tabs, for Firefox 3.5 or later
			aTabs.forEach(function(aTab, aIndex) {
				var newTab = targetBrowser.addTab();
				importedTabs.push(newTab);
				newTab.linkedBrowser.stop();
				newTab.linkedBrowser.docShell;
				targetBrowser.swapBrowsersAndCloseOther(newTab, aTab);
				targetBrowser.setTabTitle(newTab);
				this._duplicatedTabPostProcesses.forEach(function(aProcess) {
					aProcess(newTab, newTab._tPos);
				});
			}, this);
		}
		else { // duplicate tabs, or move tabs for Firefox 3.0
			aTabs.forEach(function(aTab) {
				var newTab = targetBrowser.duplicateTab(aTab);
				importedTabs.push(newTab);
				this._duplicatedTabPostProcesses.forEach(function(aProcess) {
					aProcess(newTab, newTab._tPos);
				});
				if (!aClone) {
					sourceService.irrevocableRemoveTab(aTab, sourceBrowser);
				}
			}, this);
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
				let uri = aTab.linkedBrowser.currentURI.spec;
				let title = aTab.linkedBrowser.contentDocument.title || aTab.getAttribute('label');
				let escapedURI = uri
								.replace(/&/g, '&amp;')
								.replace(/"/g, '&quot;')
								.replace(/</g, '&lt;')
								.replace(/>/g, '&gt;');
				let escapedTitle = title
								.replace(/&/g, '&amp;')
								.replace(/"/g, '&quot;')
								.replace(/</g, '&lt;')
								.replace(/>/g, '&gt;');
				return format
						.replace(/%(?:RLINK|RLINK_HTML(?:IFIED)?|SEL|SEL_HTML(?:IFIED)?)%/gi, '')
						.replace(/%URL%/gi, uri)
						.replace(/%(?:TITLE|TEXT)%/gi, title)
						.replace(/%URL_HTML(?:IFIED)?%/gi, escapedURI)
						.replace(/%TITLE_HTML(?:IFIED)?%/gi, escapedTitle)
						.replace(/%UTC_TIME%/gi, timeUTC)
						.replace(/%LOCAL_TIME%/gi, timeLocal)
						.replace(/%EOL%/gi, this.lineFeed);
			}, this);
		if (stringToCopy.length > 1)
			stringToCopy.push('');

		return stringToCopy.join(this.lineFeed);
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

		aTabs.forEach(function(aTab) {
			if (aNewState != this._isTabFreezed(aTab))
				gBrowser.freezeTab(aTab);
		}, this);
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

		aTabs.forEach(function(aTab) {
			if (aNewState != this._isTabProtected(aTab))
				gBrowser.protectTab(aTab);
		}, this);
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

		aTabs.forEach(function(aTab) {
			if (aNewState == this._isTabLocked(aTab)) return;

			// Tab Mix Plus, Tab Utilities
			if ('lockTab' in gBrowser)
				gBrowser.lockTab(aTab);

			// Super Tab Mode
			if ('stmM' in window && 'togglePL' in stmM) {
				if (aNewState)
					aTab.setAttribute('isPageLocked', true);
				else
					aTab.removeAttribute('isPageLocked');
			}
		}, this);
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

			if (shouldSelectAfter)
				duplicatedTabs.forEach(function(aTab) {
					targetService.setSelection(aTab, true);
				});

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
		return aTab.getAttribute(this.kSELECTED) == 'true';
	},
 
	setSelection : function MTS_setSelection(aTab, aState) 
	{
		return this.setBooleanAttributeToTab(aTab, this.kSELECTED, aState, true);
	},
	
	setReadyToClose : function MTS_setReadyToClose(aTab, aState) 
	{
		return this.setBooleanAttributeToTab(aTab, this.kREADY_TO_CLOSE, aState, false);
	},
 
	setBooleanAttributeToTab : function MTS_setBooleanAttributeToTab(aTab, aAttr, aState, aShouldSaveToSession) 
	{
		if (!aState) {
			aTab.removeAttribute(aAttr);
			if (aShouldSaveToSession)
				this.deleteTabValue(aTab, aAttr);
		}
		else {
			aTab.setAttribute(aAttr, true);
			if (aShouldSaveToSession)
				this.setTabValue(aTab, aAttr, 'true');
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
				this.setBooleanAttributeToTab(tabs[i], aAttr, aState, aShouldSaveToSession);
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
		var data = aTab.linkedBrowser.__SS_data || // Firefox 3.6-
					aTab.linkedBrowser.parentNode.__SS_data; // -Firefox 3.5
		if (data &&
			data._tabStillLoading &&
			aTab.getAttribute('busy') != 'true')
			data._tabStillLoading = false;
	},
  
	toggleSelection : function MTS_toggleSelection(aTab) 
	{
		return this.toggleBooleanAttributeToTab(aTab, this.kSELECTED, true);
	},
	
	toggleReadyToClose : function MTS_toggleReadyToClose(aTab) 
	{
		return this.toggleBooleanAttributeToTab(aTab, this.kREADY_TO_CLOSE, false);
	},
 
	toggleBooleanAttributeToTab : function MTS_toggleBooleanAttributeToTab(aTab, aAttr, aShouldSaveToSession) 
	{
		return this.setBooleanAttributeToTab(aTab, aAttr, aTab.getAttribute(aAttr) != 'true', aShouldSaveToSession);
	},
  
	clearSelection : function MTS_clearSelection(aTabBrowser) 
	{
		this.clearSelectionSub(this.getSelectedTabs(aTabBrowser), this.kSELECTED);
		this.clearSelectionSub(this.getReadyToCloseTabs(aTabBrowser), this.kREADY_TO_CLOSE);
		this.selectionModified = false;
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
	selectionModified : false,
  
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

			case 'extensions.multipletab.clipboard.linefeed':
				this.lineFeed = value;
				break;

			case 'extensions.multipletab.clipboard.formats':
				this.formats = [];
				this.formatsTimeStamp = Date.now();
				value.split('|').forEach(function(aPart, aIndex) {
					try {
						let format, label;
						[format, label] = aPart.split('/').map(decodeURIComponent);
						if (!format) return;
						if (!label) label = format;
						this.formats.push({
							id     : aIndex + this.kCUSTOM_TYPE_OFFSET,
							label  : label,
							format : format
						});
					}
					catch(e) {
					}
				}, this);
				break;

			default:
				break;
		}
	}
  
}; 
MultipleTabService.__proto__ = window['piro.sakura.ne.jp'].prefs;

window.addEventListener('load', MultipleTabService, false);
window.addEventListener('DOMContentLoaded', MultipleTabService, false);
  
