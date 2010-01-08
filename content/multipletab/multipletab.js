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
				return aTab.linkedBrowser.currentURI.spec != 'about:blank';
			});
	},
 
	makeTabUnrecoverable : function MTS_makeTabUnrecoverable(aTab) 
	{
		// nsSessionStore.js doesn't save the tab to the undo cache
		// if the tab is completely blank.
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
		var movedTabsCount = 0;
		tabs.forEach(function(aTab, aIndex) {
			if (aOldPositions.indexOf(aIndex) < 0) return; // it's not a target!
			var newPosition = aNewPositions[movedTabsCount++];
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
		this.ensureEventCancelable(event);
		this.getTabBrowserFromChild(aTabs[0]).dispatchEvent(event);
		return !event.getPreventDefault();
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
 
	ensureEventCancelable : function MTS_ensureEventCancelable(aEvent) 
	{
		if (aEvent.getPreventDefault) return;
		// getPreventDefault is available on any event on Gecko 1.9.2 or later.
		// on Gecko 1.9.1 or before, UIEvents only have the method...
		aEvent.__original__preventDefault = aEvent.preventDefault;
		aEvent.__canceled = false;
		aEvent.preventDefault = function() {
			this.__original__preventDefault();
			this.__canceled = true;
		};
		aEvent.getPreventDefault = function() {
			return this.__canceled;
		};
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
 
	moveHistoryEntryBefore : function MTS_moveHistoryEntryBefore(aEntry, aName) 
	{
		var history = window['piro.sakura.ne.jp'].operationHistory.getHistory('TabbarOperations', window);
		var entries = history.lastEntries;
		if (!entries) return;

		var index = entries.indexOf(aEntry);
		if (index < 0) return;

		var insertionPoint = -1;
		for (let i in entries)
		{
			if (entries[i].name != aName)
				continue;
			insertionPoint = i;
			break;
		}
		if (insertionPoint < 0) return;

		entries.splice(index, 1);
		entries.splice(insertionPoint, 0, aEntry);
		history.lastEntries = entries;
	},
  
/* Initializing */ 
	
	init : function MTS_init() 
	{
		if (!('gBrowser' in window)) return;

		window.addEventListener('mouseup', this, true);

		window.removeEventListener('load', this, false);
		window.addEventListener('unload', MultipleTabService, false);

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

		if ('swapBrowsersAndCloseOther' in document.getElementById('content')) {
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
					!window['piro.sakura.ne.jp'].operationHistory.isUndoing('TabbarOperations', window) &&
					!window['piro.sakura.ne.jp'].operationHistory.isRedoing('TabbarOperations', window)
					)
					this.moveBundledTabsOf(aEvent.originalTarget, aEvent);
				break;

			case 'MultipleTabHandler:TabDuplicate':
				if (
					this.isSelected(aEvent.sourceTab) &&
					this.allowMoveMultipleTabs &&
					!aEvent.currentTarget.duplicatingSelectedTabs &&
					!window['piro.sakura.ne.jp'].operationHistory.isUndoing('TabbarOperations', window) &&
					!window['piro.sakura.ne.jp'].operationHistory.isRedoing('TabbarOperations', window)
					)
					this.duplicateBundledTabsOf(aEvent.originalTarget, aEvent.sourceTab, aEvent.mayBeMove);
				break;

			case 'MultipleTabHandler:TabWindowMove':
				if (
					this.isSelected(aEvent.sourceTab) &&
					this.allowMoveMultipleTabs &&
					!aEvent.currentTarget.duplicatingSelectedTabs &&
					!window['piro.sakura.ne.jp'].operationHistory.isUndoing('TabbarOperations', window) &&
					!window['piro.sakura.ne.jp'].operationHistory.isRedoing('TabbarOperations', window)
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
		}
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
		var newTab;
		if (
			this.isSelected(aTab) &&
			this.allowMoveMultipleTabs &&
			!aTabBrowser.duplicatingSelectedTabs &&
			!window['piro.sakura.ne.jp'].operationHistory.isUndoing('TabbarOperations', window) &&
			!window['piro.sakura.ne.jp'].operationHistory.isRedoing('TabbarOperations', window)
			) {
			var self = this;
			var entry;
			window['piro.sakura.ne.jp'].operationHistory.doUndoableTask(
				function(aInfo) {
					newTab = aTask.call(aTabBrowser);
					self.fireDuplicatedEvent(newTab, aTab, aSourceEvent);
				},

				'TabbarOperations',
				window,
				(entry = {
					name   : 'multipletab-duplicateTabs',
					label  : this.bundle.getString('undo_duplicateTabs_label'),
					// I don't define onUndo() and onRedo() for this entry
					// because they are processed
					onUndo : function(aInfo) { return false; },
					onRedo : function(aInfo) { return false; }
				})
			);
			this.moveHistoryEntryBefore(entry, 'undotab-duplicateTab');
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

		var w = aTabs[0].ownerDocument.defaultView;
		var b = this.getTabBrowserFromChild(aTabs[0]);
		var indexes = this.getIndexesFromTabs(aTabs);
		var selectedIndex = -1;
		var states = aTabs.map(function(aTab) {
				return this.SessionStore.getTabState(aTab);
			}, this);

		var count = this.getTabs(b).snapshotLength;

		w['piro.sakura.ne.jp'].operationHistory.doUndoableTask(
			function(aInfo) {
				var sv = w.MultipleTabService;
				var tabs = sv.getTabsArray(b);

				// Don't redo when tabs are modified (for safety)
				if (tabs.length != count)
					return false;

				var removeTabs = indexes.map(function(aPosition, aIndex) {
							var tab = tabs[aPosition];
							if (tab.selected) selectedIndex = aIndex;
							return tab;
						});

				if (sv.getPref('extensions.multipletab.close.direction') == sv.CLOSE_DIRECTION_LAST_TO_START)
					removeTabs.reverse();

				w['piro.sakura.ne.jp'].stopRendering.stop();

				var closeSelectedLast = sv.getPref('extensions.multipletab.close.selectedTab.last');
				var selected;
				removeTabs.forEach(function(aTab) {
					if (closeSelectedLast && aTab.selected)
						selected = aTab;
					else
						b.removeTab(aTab);
				});
				if (selected)
					b.removeTab(selected);

				w['piro.sakura.ne.jp'].stopRendering.start();
			},

			'TabbarOperations',
			w,
			{
				name   : 'multipletab-closeTabs',
				label  : this.bundle.getString('undo_closeTabs_label'),
				onUndo : function(aInfo) {
					var sv = w.MultipleTabService;
					var tabs = sv.getTabsArray(b);

					// Don't undo when tabs are modified (for safety)
					if (tabs.length + indexes.length != count)
						return false;

					w['piro.sakura.ne.jp'].stopRendering.stop();
					states.forEach(function(aState, aIndex) {
						var tab = b.addTab('about:blank');
						sv.SessionStore.setTabState(tab, aState);
						b.moveTabTo(tab, indexes[aIndex]);
						if (aIndex == selectedIndex)
							b.selectedTab = tab;
					});
					w['piro.sakura.ne.jp'].stopRendering.start();
				}
			}
		);

		/* PUBLIC API */
		this.fireTabsClosedEvent(b, aTabs);

		aTabs = null;
	},
	CLOSE_DIRECTION_START_TO_LAST : 0,
	CLOSE_DIRECTION_LAST_TO_START : 1,
  
	closeSimilarTabsOf : function MTS_closeSimilarTabsOf(aCurrentTab, aTabs) 
	{
		if (!aCurrentTab) return;

		var removeTabs = this.getSimilarTabsOf(aCurrentTab, aTabs);
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

		var b;
		var self = this;
		Array.slice(aTabs).forEach(function(aTab) {
			if (!b) b = self.getTabBrowserFromChild(aTab);
			b.reloadTab(aTab);
		});
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
		var indexes = this.getIndexesFromTabs(aTabs);
		var count = this.getTabs(b).snapshotLength;
		var shouldSelectAfter = this.getPref('extensions.multipletab.selectAfter.duplicate');
		var duplicatedIndexes = [];
		var duplicatedTabs;

		var entry;
		w['piro.sakura.ne.jp'].operationHistory.doUndoableTask(
			function(aInfo) {
				var sv = w.MultipleTabService;
				// Don't redo when tabs are modified (for safety)
				if (sv.getTabs(b).snapshotLength != count)
					return false;

				w['piro.sakura.ne.jp'].stopRendering.stop();

				var duplicatedTabs = sv.duplicateTabsInternal(b, indexes);
				if (shouldSelectAfter) {
					duplicatedTabs.forEach(function(aTab) {
						sv.setSelection(aTab, true);
					});
					shouldSelectAfter = false;
				}
				duplicatedIndexes = sv.getIndexesFromTabs(duplicatedTabs);

				w['piro.sakura.ne.jp'].stopRendering.start();
			},

			'TabbarOperations',
			w,
			(entry = {
				name   : 'multipletab-duplicateTabs',
				label  : this.bundle.getString('undo_duplicateTabs_label'),
				onUndo : function(aInfo) {
					var sv = w.MultipleTabService;
					var tabs = sv.getTabsArray(b);
					// Don't undo when tabs are modified (for safety)
					if (tabs.length != count + indexes.length)
						return false;

					w['piro.sakura.ne.jp'].stopRendering.stop();
					duplicatedIndexes.reverse().forEach(function(aIndex) {
						var tab = tabs[aIndex];
						sv.makeTabUnrecoverable(tab);
						b.removeTab(tab);
					});

					w['piro.sakura.ne.jp'].stopRendering.start();
				}
			})
		);
		this.moveHistoryEntryBefore(entry, 'undotab-duplicateTab');

		var tabs = this.getTabs(b);
		return duplicatedIndexes.map(function(aIndex) {
				return tabs.snapshotItem(aIndex);
			});
	},
	
	duplicateTabsInternal : function MTS_duplicateTabsInternal(aTabBrowser, aIndexes) 
	{
		var max = aIndexes.length;
		if (!max) return [];

		this.duplicatingTabs = true;

		var b = aTabBrowser;
		var w = b.ownerDocument.defaultView;
		var tabs = this.getTabsArray(b)
					.filter(function(aTab, aIndex) {
						return aIndexes.indexOf(aIndex) > -1;
					});
		var selectedIndex = aIndexes.indexOf(b.selectedTab._tPos);

		var duplicatedTabs = tabs.map(function(aTab) {
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

		w.setTimeout(function(aSelf) {
			aSelf.duplicatingTabs = false;
		}, 0, this);

		return duplicatedTabs;
	},
  
	splitWindowFromTabs : function MTS_splitWindowFromTabs(aTabs, aRemoteWindow) 
	{
		if (!aTabs || !aTabs.length) return null;

		var b = this.getTabBrowserFromChild(aTabs[0]);

		if (!aRemoteWindow) {
			var self = this;
			aRemoteWindow = window.openDialog(location.href, '_blank', 'chrome,all,dialog=no', 'about:blank');
			aRemoteWindow.addEventListener('load', function() {
				aRemoteWindow.removeEventListener('load', arguments.callee, false);
				self.importTabsToNewWindow(aTabs, aRemoteWindow);
			}, false);
		}
		else {
			this.importTabsToNewWindow(aTabs, aRemoteWindow);
		}

		return aRemoteWindow;
	},
	
	importTabsToNewWindow : function MTS_importTabsToNewWindow(aTabs, aRemoteWindow) 
	{
		var sourceBrowser = this.getTabBrowserFromChild(aTabs[0]);
		var sourceWindow  = sourceBrowser.ownerDocument.defaultView;
		var sourceId      = sourceWindow['piro.sakura.ne.jp'].operationHistory.getWindowId(sourceWindow);

		var indexes       = this.getIndexesFromTabs(aTabs);
		var selectedIndex = indexes.indexOf(sourceBrowser.selectedTab._tPos);
		var originalCount = this.getTabs(sourceBrowser).snapshotLength;

		var remoteId = aRemoteWindow ? sourceWindow['piro.sakura.ne.jp'].operationHistory.getWindowId(aRemoteWindow) : null ;

		var historyEntry = {
				name   : 'multipletab-tearOffTabs',
				label  : this.bundle.getString('undo_splitWindowFromTabs_label'),
				onUndo : function(aInfo) {
					// Don't undo if the original window is already closed (for safety)
					var sourceWindow = aInfo.manager.getWindowById(sourceId);
					if (!sourceWindow || sourceWindow.closed) {
						sourceBrowser = null;
						return false;
					}

					// Don't undo when the target window is already closed (for safety)
					var remoteWindow = remoteId ? aInfo.manager.getWindowById(remoteId) : null ;
					if (!remoteWindow || remoteWindow.closed) {
						return false;
					}

					// If "undo" is called in the new remote window and the last history entry
					// of the source window is related to this entry, then run "undo" in the
					// source window instead of the new remote window, because we should enable
					// "redo" in the source window to re-split tabs.
					if (this == remoteHistoryEntry) {
						var history = aInfo.manager.getHistory('TabbarOperations', sourceWindow);
						if (history.currentEntry == historyEntry) {
							sourceWindow.setTimeout(function() {
								aInfo.manager.undo('TabbarOperations', sourceWindow);
							}, 0);
							return;
						}
					}

					// Don't undo when tabs in the remote window are modified (for safety)
					var remoteService = remoteWindow.MultipleTabService;
					var remoteBrowser = remoteService.browser;
					var remoteTabs = remoteService.getTabsArray(remoteBrowser);
					if (remoteTabs.length != indexes.length)
						return false;

					var sourceService = sourceWindow.MultipleTabService;
					var tabs = sourceService.getTabsArray(sourceBrowser);
					// Don't undo when tabs are modified (for safety)
					if (tabs.length != originalCount - indexes.length)
						return false;

					sourceWindow['piro.sakura.ne.jp'].stopRendering.stop();
					remoteWindow['piro.sakura.ne.jp'].stopRendering.stop();

					remoteBrowser.addTab('about:blank'); // to prevent window close by importedTabs()

					var importedTabs = sourceService.importTabsTo(remoteTabs, sourceBrowser);
					importedTabs.forEach(function(aTab, aIndex) {
						sourceBrowser.moveTabTo(aTab, indexes[aIndex]);
					});
					if (selectedIndex > -1)
						sourceBrowser.selectedTab = importedTabs[selectedIndex];

					sourceWindow['piro.sakura.ne.jp'].stopRendering.start();

					remoteWindow.setTimeout(function() {
						// remoteWindow['piro.sakura.ne.jp'].stopRendering.start();
						remoteWindow.close();
					}, 0);
				},
				onRedo : function(aInfo) {
					var sourceWindow = aInfo.manager.getWindowById(sourceId);

					var sourceService = sourceWindow.MultipleTabService;
					var tabs = sourceService.getTabsArray(sourceBrowser);
					// Don't redo when tabs are modified (for safety)
					if (tabs.length != originalCount)
						return false;

					var continuation = aInfo.getContinuation();
					var remoteWindow = window.openDialog(location.href, '_blank', 'chrome,all,dialog=no', 'about:blank');
					remoteWindow.addEventListener('load', function() {
						remoteWindow.removeEventListener('load', arguments.callee, false);

						remoteId = aInfo.manager.getWindowId(remoteWindow);
						var sourceWindow = aInfo.manager.getWindowById(sourceId);
						var sourceService = sourceWindow.MultipleTabService;
						var tabs = sourceService.getTabsArray(sourceBrowser);

						tabs = tabs.filter(function(aTab, aIndex) {
								return indexes.indexOf(aIndex) > -1;
							});
						sourceService.importTabsToNewWindowInternal(tabs, remoteWindow);

						continuation();

						aInfo.manager.addEntry(
							'TabbarOperations',
							remoteWindow,
							remoteHistoryEntry
						);
					}, false);
				}
			};
		var remoteHistoryEntry = {
				__proto__ : historyEntry,
				onRedo : function() {}
			}

		sourceWindow['piro.sakura.ne.jp'].operationHistory.doUndoableTask(
			function(aInfo) {
				var sourceWindow = aInfo.manager.getWindowById(sourceId);
				var sourceService = sourceWindow.MultipleTabService;
				var tabs = sourceService.getTabsArray(sourceBrowser);
				// Don't redo when tabs are modified (for safety)
				if (tabs.length != originalCount)
					return false;

				var remoteWindow = (remoteId ? aInfo.manager.getWindowById(remoteId) : null ) || aRemoteWindow;

				tabs = tabs.filter(function(aTab, aIndex) {
						return indexes.indexOf(aIndex) > -1;
					});
				sourceService.importTabsToNewWindowInternal(tabs, remoteWindow);

				aInfo.manager.addEntry(
					'TabbarOperations',
					remoteWindow,
					remoteHistoryEntry
				);
			},

			'TabbarOperations',
			sourceWindow,
			historyEntry
		);

		aTabs = null;
		sourceWindow = null;

		return aRemoteWindow;
	},
 
	importTabsToNewWindowInternal : function MTS_importTabsToNewWindowInternal(aTabs, aWindow) 
	{
		var max = aTabs.length;
		if (!max) return [];
		var b = this.getTabBrowserFromChild(aTabs[0]);

		// for Firefox 3.0, we have to use old method.
		if (!b.__multipletab__canDoWindowMove)
			return this.importTabsToNewWindowInternalOld(aTabs, aWindow);

		var allSelected = true;
		var selectionState = aTabs.map(function(aTab) {
				var selected = this.isSelected(aTab);
				if (!selected) allSelected = false;
				return selected;
			}, this);

		var selectAfter = this.getPref('extensions.multipletab.selectAfter.move');

		aWindow.removeEventListener('load', arguments.callee, false);
		aWindow.MultipleTabService.duplicatingTabs = true;
		aWindow['piro.sakura.ne.jp'].stopRendering.stop();

//		aWindow.setTimeout(function() {
			var remoteService = aWindow.MultipleTabService;
			var remoteBrowser = aWindow.gBrowser;
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
							)
							remoteService.setSelection(aTab, true);
					}
					else {
						remoteService.makeTabUnrecoverable(aTab);
						remoteBrowser.removeTab(aTab);
					}
				});
			aWindow['piro.sakura.ne.jp'].stopRendering.start();
			delete allSelected;
			delete selectionState;
			delete remoteBrowser;
			delete importedTabs;
			delete aWindow;
//		}, 0);

		return importedTabs;
	},
 
	// for Firefox 3.0
	importTabsToNewWindowInternalOld : function MTS_importTabsToNewWindowInternalOld(aTabs, aWindow) 
	{
		if (!aTabs) return [];

		var aTabs = Array.slice(aTabs);
		if (!aTabs.length) return [];

		var selectAfter = this.getPref('extensions.multipletab.selectAfter.move');

		aWindow['piro.sakura.ne.jp'].stopRendering.stop();

		var sv = aWindow.MultipleTabService;
		var b = sv.browser;
		var importedTabs = sv.importTabsTo(aTabs, b);
		sv.getTabsArray(b)
			.forEach(function(aTab) {
				if (importedTabs.indexOf(aTab) < 0) {
					sv.makeTabUnrecoverable(aTab);
					b.removeTab(aTab);
				}
			});

		aWindow.focus();
		aWindow['piro.sakura.ne.jp'].stopRendering.start();

		return importedTabs;
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
					sourceService.makeTabUnrecoverable(aTab);
					sourceBrowser.removeTab(aTab);
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
 
	toggleTabsLocked : function MTS_toggleTabsLocked(aTabs, aNewState) 
	{
		if (aNewState === void(0))
			aNewState = !tabs.every(this._isTabLocked);

		aTabs.forEach(function(aTab) {
			if (aNewState != this._isTabLocked(aTab))
				gBrowser.lockTab(aTab);
		}, this);
	},
	_isTabLocked : function MTS__isTabLocked(aTab)
	{
		return aTab.hasAttribute('locked');
	},
   
/* Move and Duplicate multiple tabs on Drag and Drop */ 
	
	moveBundledTabsOf : function MTS_moveBundledTabsOf(aMovedTab, aEvent) 
	{
		var b = this.getTabBrowserFromChild(aMovedTab);
		var count = this.getTabs(b).snapshotLength;
		var oldPosition = aEvent.detail;
		var newPosition = aMovedTab._tPos;
		var oldSelectedIndex = -1;
		var newSelectedIndex = -1;
		var oldPositions;
		var newPositions;

		var self = this;
		var entry;
		window['piro.sakura.ne.jp'].operationHistory.doUndoableTask(
			function() {
				var movedTabs = self.getSelectedTabs(b);

				oldSelectedIndex = movedTabs.indexOf(b.selectedTab);
				oldPositions = self.getOriginalPositions(movedTabs, aMovedTab, oldPosition);

				self.rearrangeBundledTabsOf(aMovedTab, oldPosition, movedTabs);

				newPosition = aMovedTab._tPos;
				newPositions = movedTabs.map(function(aTab, aIndex) {
						if (aTab.selected) newSelectedIndex = aIndex;
						return aTab._tPos;
					})
					.sort();

				b.mTabDropIndicatorBar.collapsed = true; // hide anyway!
			},

			'TabbarOperations',
			window,
			(entry = {
				name   : 'multipletab-moveBundledTabs',
				label  : this.bundle.getString('undo_moveBundledTabsOf_label'),
				onUndo : function(aInfo) {
					// Don't undo when tabs are modified (for safety)
					if (self.getTabs(b).snapshotLength != count)
						return false;
					self.moveTabsByIndex(b, newPositions, oldPositions);
					b.selectedTab = self.getTabAt(oldPositions[oldSelectedIndex], b) ||
									b.selectedTab;
				},
				onRedo : function(aInfo) {
					if (self.getTabs(b).snapshotLength != count)
						return false;
					self.moveTabsByIndex(b, oldPositions, newPositions);
					b.selectedTab = self.getTabAt(newPositions[newSelectedIndex], b) ||
									b.selectedTab;
				}
			})
		);

		this.moveHistoryEntryBefore(entry, 'undotab-moveTab');

		aEvent = null;
		aMovedTab = null;
	},
 
	importBundledTabsOf : function MTS_importBundledTabsOf(aNewTab, aSourceTab) 
	{
		var targetBrowser = this.getTabBrowserFromChild(aNewTab);

		if (!targetBrowser.__multipletab__canDoWindowMove) {
			this.duplicateBundledTabsOf(aNewTab, aSourceTab, true);
			retrurn;
		}

		var oldPosition = aSourceTab._tPos;
		var newPosition = aNewTab._tPos;
		var oldSelectedIndex = -1;
		var newSelectedIndex = -1;
		var oldPositions;
		var newPositions;

		var sourceId;
		var targetId = window['piro.sakura.ne.jp'].operationHistory.getWindowId(window);
		var sourceBrowser;
		var importedTabsCount = 0;
		var sourceTabsCount   = 0;
		var targetTabsCount   = this.getTabs(targetBrowser).snapshotLength - 1;

		var isAllTabsMove;
		var shouldSelectAfter = this.getPref('extensions.multipletab.selectAfter.move');

		var targetEntry = {
				name   : 'multipletab-importBundledTabs',
				label  : this.bundle.getString('undo_importBundledTabsOf_target_label'),
				getTargetWindow : function(aInfo) {
					var targetWindow = aInfo.manager.getWindowById(targetId);
					if (!targetWindow ||
						!targetBrowser ||
						!targetBrowser.parentNode) {
						targetBrowser = null;
						sourceBrowser = null;
						return null;
					}
					return targetWindow;
				},
				getTabsFromPositions : function(aService, aTabBrowser, aPositions) {
					return aService.getTabsArray(aTabBrowser)
							.filter(function(aTab, aIndex) {
								return aPositions.indexOf(aIndex) > -1;
							});
				},
				getSourceBrowser : function(aSourceWindow) {
					if (!sourceBrowser || !sourceBrowser.parentNode) {
						sourceBrowser = null;
						return aSourceWindow.gBrowser;
					}
					return sourceBrowser
				},
				restoreOneTab : function(aService, aSourceTabBrowser, aTargetTabBrowser, aOldPosition, aNewPosition) {
					let sourceTab = aService.getTabAt(aOldPosition, aSourceTabBrowser);
					let baseTabs = aService.importTabsTo(sourceTab, aTargetTabBrowser);
					aTargetTabBrowser.moveTabTo(baseTabs[0], aNewPosition);
				},
				onUndo : function(aInfo) {
					var targetWindow = this.getTargetWindow(aInfo);
					if (!targetWindow) return false;

					var importedTabs;
					var targetService = targetWindow.MultipleTabService;
					var sourceWindow = aInfo.manager.getWindowById(sourceId);
					if (isAllTabsMove || !sourceWindow) {
						// When the source window is already closed, we have to open new window
						// from imported tabs.
						let continuation = aInfo.getContinuation();
						importedTabs = this.getTabsFromPositions(targetService, targetBrowser, newPositions);
						sourceWindow = targetService.splitWindowFromTabs(importedTabs);
						sourceWindow.addEventListener('load', function() {
							sourceWindow.removeEventListener('load', arguments.callee, false);
							sourceId = aInfo.manager.getWindowId(sourceWindow);
							sourceWindow.setTimeout(function() {
								continuation();
							}, 10);
						}, false);
						return;
					}

					var sourceService = sourceWindow.MultipleTabService;
					var sourceBrowser = this.getSourceBrowser(sourceWindow);

					aInfo.manager.syncWindowHistoryFocus({
						currentEntry : this,
						name    : 'TabbarOperations',
						entries : [sourceEntry, targetEntry],
						windows : [sourceWindow, targetWindow]
					});

					// Don't undo when tabs are modified (for safety)
					var offset = aInfo.processed ? 1 : 0 ;
					if (sourceService.getTabs(sourceBrowser).snapshotLength - offset != sourceTabsCount - importedTabsCount)
						return false;

					targetWindow['piro.sakura.ne.jp'].stopRendering.stop();
					sourceWindow['piro.sakura.ne.jp'].stopRendering.stop();

					// Restore tab position changed by onUndo() for the parent entry
					if (aInfo.processed)
						this.restoreOneTab(sourceService, sourceBrowser, targetBrowser, oldPosition, newPosition);
					importedTabs = this.getTabsFromPositions(targetService, targetBrowser, newPositions);

					var sourceTabs = sourceService.importTabsTo(importedTabs, sourceBrowser);
					sourceService.moveTabsByIndex(
						sourceBrowser,
						sourceTabs.map(function(aTab) {
							return aTab._tPos;
						}),
						oldPositions
					);

					var selected = sourceService.getTabAt(oldPositions[oldSelectedIndex], sourceBrowser);
					if (selected)
						sourceBrowser.selectedTab = selected;

					targetWindow['piro.sakura.ne.jp'].stopRendering.start();
					sourceWindow['piro.sakura.ne.jp'].stopRendering.start();
				},
				onRedo : function(aInfo) {
					var targetWindow = this.getTargetWindow(aInfo);
					var sourceWindow = aInfo.manager.getWindowById(sourceId);
					if (!targetWindow || !sourceWindow) return false;

					var targetService = targetWindow.MultipleTabService;
					var sourceService = sourceWindow.MultipleTabService;
					var sourceBrowser = this.getSourceBrowser(sourceWindow);

					aInfo.manager.syncWindowHistoryFocus({
						currentEntry : this,
						name    : 'TabbarOperations',
						entries : [sourceEntry, targetEntry],
						windows : [sourceWindow, targetWindow]
					});

					// Don't redo when tabs are modified (for safety)
					var offset = aInfo.processed ? 1 : 0 ;
					if (sourceService.getTabs(sourceBrowser).snapshotLength + offset != sourceTabsCount)
						return false;

					targetWindow['piro.sakura.ne.jp'].stopRendering.stop();
					sourceWindow['piro.sakura.ne.jp'].stopRendering.stop();

					// Restore tab position changed by onRedo() for the parent entry
					if (aInfo.processed)
						this.restoreOneTab(sourceService, targetBrowser, sourceBrowser, newPosition, oldPosition);

					var sourceTabs = this.getTabsFromPositions(sourceService, sourceBrowser, oldPositions);
					var importedTabs = targetService.importTabsTo(sourceTabs, targetBrowser);
					targetService.moveTabsByIndex(
						targetBrowser,
						importedTabs.map(function(aTab) {
							return aTab._tPos;
						}),
						newPositions
					);

					var selected = targetService.getTabAt(newPositions[newSelectedIndex], targetBrowser);
					if (selected)
						targetBrowser.selectedTab = selected;

					if (isAllTabsMove) {
						targetService.closeOwner(sourceBrowser);
						sourceBrowser = null;
					}
					else {
						sourceWindow['piro.sakura.ne.jp'].stopRendering.start();
					}
					targetWindow['piro.sakura.ne.jp'].stopRendering.start();
				}
			};
		var sourceEntry = {
				__proto__ : targetEntry,
				label     : this.bundle.getString('undo_importBundledTabsOf_source_label')
			};

		window['piro.sakura.ne.jp'].operationHistory.doUndoableTask(
			function(aInfo) {
				var targetService = window.MultipleTabService;

				var info = {};
				var sourceTabs = targetService.getBundledTabsOf(aSourceTab, info);
				var sourceBaseIndex = sourceTabs.indexOf(aSourceTab);
				oldPositions = targetService.getOriginalPositions(sourceTabs, aSourceTab, oldPosition);

				var otherSourceTabs = sourceTabs.slice(0);
				otherSourceTabs.splice(otherSourceTabs.indexOf(aSourceTab), 1);

				var sourceWindow  = info.sourceWindow;
				var sourceService = sourceWindow.MultipleTabService;
				sourceBrowser = info.sourceBrowser;
				sourceId = aInfo.manager.getWindowId(sourceWindow);
				sourceTabsCount = sourceService.getTabs(sourceBrowser).snapshotLength;
				importedTabsCount = sourceTabs.length;

				oldSelectedIndex = sourceTabs.indexOf(sourceBrowser.selectedTab);

				isAllTabsMove = sourceTabsCount == otherSourceTabs.length;

				targetBrowser.movingSelectedTabs = true;
				targetService.clearSelection(targetBrowser);
				sourceService.clearSelection(sourceBrowser);

				window['piro.sakura.ne.jp'].stopRendering.stop();
				sourceWindow['piro.sakura.ne.jp'].stopRendering.stop();
				aInfo.manager.doUndoableTask(
					function(aInfo) {
						var importedTabs = targetService.importTabsTo(otherSourceTabs, targetBrowser);
						importedTabs.splice(sourceBaseIndex, 0, aNewTab);
						targetService.rearrangeBundledTabsOf(aNewTab, importedTabs);
						newPositions = importedTabs.map(function(aTab) {
								if (shouldSelectAfter)
									targetService.setSelection(aTab, true);
								return aTab._tPos;
							})
							.sort();
						newPosition = aNewTab._tPos;
						newSelectedIndex = newPositions.indexOf(newPosition);
					},
					'TabbarOperations',
					sourceWindow,
					sourceEntry
				);

				if (isAllTabsMove) {
					targetService.closeOwner(sourceBrowser);
					sourceBrowser = null;
				}
				else {
					sourceWindow['piro.sakura.ne.jp'].stopRendering.start();
				}

				targetService.setSelection(aNewTab, shouldSelectAfter);
				window['piro.sakura.ne.jp'].stopRendering.start();
				targetBrowser.movingSelectedTabs = false;
			},

			'TabbarOperations',
			window,
			targetEntry
		);

		this.moveHistoryEntryBefore(targetEntry, 'undotab-importTab');
		this.moveHistoryEntryBefore(targetEntry, 'undotab-onDrop-importTab');
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
		var sourceId;
		var targetId = window['piro.sakura.ne.jp'].operationHistory.getWindowId(window);
		var sourceBrowser;
		var targetBrowser = this.getTabBrowserFromChild(aNewTab);
		var duplicatedTabsCount = 0;
		var sourceTabsCount = 0;
		var targetTabsCount = this.getTabs(targetBrowser).snapshotLength - 1;

		var isMove = (
				aMayBeMove &&
				this.getTabBrowserFromChild(aSourceTab) != this.getTabBrowserFromChild(aNewTab)
			);
		var isAllTabsMove;
		var shouldSelectAfter = this.getPref(isMove ?
				'extensions.multipletab.selectAfter.move' :
				'extensions.multipletab.selectAfter.duplicate'
			);

		var targetEntry = {
				name   : isMove ?
							'multipletab-moveBundledTabs' :
							'multipletab-duplicateBundledTabs',
				label  : this.bundle.getString(isMove ?
							'undo_importBundledTabsOf_target_label' :
							'undo_duplicateTabs_label'
						),
				onUndo : function(aInfo) {
				},
				onRedo : function(aInfo) {
				}
			};
		var sourceEntry = {
				__proto__ : targetEntry,
				label  : this.bundle.getString(isMove ?
							'undo_duplicateBundledTabsOf_source_label' :
							'undo_duplicateTabs_label'
						),
			};

		window['piro.sakura.ne.jp'].operationHistory.doUndoableTask(
			function(aInfo) {
				var targetWindow = window;
				var targetService = targetWindow.MultipleTabService;

				var info = {};
				var sourceTabs = targetService.getBundledTabsOf(aSourceTab, info);

				var targetBrowser = targetService.getTabBrowserFromChild(aNewTab);
				var sourceWindow  = info.sourceWindow;
				var sourceService = sourceWindow.MultipleTabService;
				sourceBrowser = info.sourceBrowser;
				sourceId = aInfo.manager.getWindowId(sourceWindow);
				sourceTabsCount = sourceService.getTabs(sourceBrowser).snapshotLength;
				duplicatedTabsCount = sourceTabs.length;

				isAllTabsMove = isMove && sourceService.getTabs(sourceBrowser).snapshotLength == sourceTabs.length;

				var sourceBaseIndex = sourceTabs.indexOf(aSourceTab);
				var otherTabs = sourceTabs.slice(0);
				otherTabs.splice(sourceBaseIndex, 1);

				sourceService.clearSelection(sourceBrowser);
				targetService.clearSelection(targetBrowser);

				var otherSourceTabs = sourceTabs.slice(0);
				otherSourceTabs.splice(otherSourceTabs.indexOf(aSourceTab), 1);

				var targetContinuation = aInfo.getContinuation();
				var targetTask = function() {
						targetBrowser.duplicatingSelectedTabs = true;
						targetBrowser.movingSelectedTabs = true;

						var duplicatedTabs = targetService.importTabsTo(otherTabs, targetBrowser, !isMove);
						duplicatedTabs.splice(sourceBaseIndex, 0, aNewTab);
						targetService.rearrangeBundledTabsOf(aNewTab, duplicatedTabs);

						if (shouldSelectAfter)
							duplicatedTabs.forEach(function(aTab) {
								targetService.setSelection(aTab, true);
							});

						if (isAllTabsMove) {
							targetService.closeOwner(sourceBrowser);
							sourceBrowser = null;
						}

						targetBrowser.movingSelectedTabs = false;
						targetBrowser.duplicatingSelectedTabs = false;
						targetBrowser.mTabDropIndicatorBar.collapsed = true; // hide anyway!

						delete info.sourceBrowser;
						delete info.sourceWindow;
						info = null;

						targetContinuation();
					};

				if (targetWindow != sourceWindow) {
					aInfo.manager.doUndoableTask(
						function(aInfo) {
							var sourceContinuation = aInfo.getContinuation();
							targetWindow.setTimeout(function() {
								targetTask();
								sourceContinuation();
							}, 0);
						},
						'TabbarOperations',
						sourceWindow,
						sourceEntry
					);
				}
				else {
					targetWindow.setTimeout(targetTask, 0);
				}
			},

			'TabbarOperations',
			window,
			targetEntry
		);

		this.moveHistoryEntryBefore(targetEntry, 'undotab-duplicateTab');
	},
 
	tearOffSelectedTabsFromRemote : function MTS_tearOffSelectedTabsFromRemote() 
	{
		var remoteTab = window.arguments[0];
		var info = {};
		var tabs = this.getBundledTabsOf(remoteTab, info);
		if (tabs.length) {
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
		if (aTab.linkedBrowser.parentNode.__SS_data &&
			aTab.linkedBrowser.parentNode.__SS_data._tabStillLoading &&
			aTab.getAttribute('busy') != 'true')
			aTab.linkedBrowser.parentNode.__SS_data._tabStillLoading = false;
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
	},
  
/* Save/Load Prefs */ 
	
	get Prefs() 
	{
		if (!this._Prefs) {
			this._Prefs = Components.classes['@mozilla.org/preferences;1'].getService(Components.interfaces.nsIPrefBranch);
		}
		return this._Prefs;
	},
	_Prefs : null,
 
	getPref : function MTS_getPref(aPrefstring, aInterface) 
	{
		try {
			if (aInterface) {
				return this.Prefs.getComplexValue(aPrefstring, aInterface);
			}

			switch (this.Prefs.getPrefType(aPrefstring))
			{
				case this.Prefs.PREF_STRING:
					return decodeURIComponent(escape(this.Prefs.getCharPref(aPrefstring)));
					break;
				case this.Prefs.PREF_INT:
					return this.Prefs.getIntPref(aPrefstring);
					break;
				default:
					return this.Prefs.getBoolPref(aPrefstring);
					break;
			}
		}
		catch(e) {
		}

		return null;
	},
 
	setPref : function MTS_setPref(aPrefstring, aNewValue) 
	{
		var pref = this.Prefs ;
		var type;
		try {
			type = typeof aNewValue;
		}
		catch(e) {
			type = null;
		}

		switch (type)
		{
			case 'string':
				pref.setCharPref(aPrefstring, unescape(encodeURIComponent(aNewValue)));
				break;
			case 'number':
				pref.setIntPref(aPrefstring, parseInt(aNewValue));
				break;
			default:
				pref.setBoolPref(aPrefstring, aNewValue);
				break;
		}
		return true;
	},
 
	clearPref : function MTS_clearPref(aPrefstring) 
	{
		try {
			this.Prefs.clearUserPref(aPrefstring);
		}
		catch(e) {
		}

		return;
	},
 
	addPrefListener : function MTS_addPrefListener(aObserver) 
	{
		var domains = ('domains' in aObserver) ? aObserver.domains : [aObserver.domain] ;
		try {
			var pbi = this.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
			for (var i = 0; i < domains.length; i++)
				pbi.addObserver(domains[i], aObserver, false);
		}
		catch(e) {
		}
	},
 
	removePrefListener : function MTS_removePrefListener(aObserver) 
	{
		var domains = ('domains' in aObserver) ? aObserver.domains : [aObserver.domain] ;
		try {
			var pbi = this.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
			for (var i = 0; i < domains.length; i++)
				pbi.removeObserver(domains[i], aObserver, false);
		}
		catch(e) {
		}
	}
  
}; 

window.addEventListener('load', MultipleTabService, false);
window.addEventListener('DOMContentLoaded', MultipleTabService, false);
  
