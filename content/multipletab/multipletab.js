var MultipleTabService = { 
	PREFROOT : 'extensions.multipletab@piro.sakura.ne.jp',

	tabDragMode : -1,
	TAB_DRAG_MODE_DEFAULT : 0,
	TAB_DRAG_MODE_SELECT  : 1,
	TAB_DRAG_MODE_SWITCH  : 2,

	tabClickMode : -1,
	TAB_CLICK_MODE_DEFAULT : 0,
	TAB_CLICK_MODE_TOGGLE  : 1,

	kSELECTION_STYLE : 'multipletab-selection-style',
	kSELECTED        : 'multipletab-selected',
	kREADY_TO_CLOSE  : 'multipletab-ready-to-close',
	kINSERT_BEFORE   : 'multipletab-insertbefore',

	kSELECTION_MENU        : 'multipletab-selection-menu',
	kCONTEXT_MENU_TEMPLATE : 'multipletab-tabcontext-menu-template',

	NSResolver : {
		lookupNamespaceURI : function(aPrefix)
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
	evaluateXPath : function(aExpression, aContext, aType)
	{
		if (!aType) aType = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
		try {
			var xpathResult = document.evaluate(
					aExpression,
					aContext,
					this.NSResolver,
					aType,
					null
				);
		}
		catch(e) {
			return {
				singleNodeValue : null,
				snapshotLength  : 0,
				snapshotItem    : function() {
					return null
				}
			};
		}
		return xpathResult;
	},

	get SessionStore() {
		if (!this._SessionStore) {
			this._SessionStore = Components.classes['@mozilla.org/browser/sessionstore;1'].getService(Components.interfaces.nsISessionStore);
		}
		return this._SessionStore;
	},
	_SessionStore : null,
	 
/* Utilities */ 
	 
	isEventFiredOnTabIcon : function(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[@class="tab-icon"]',
				aEvent.originalTarget || aEvent.target,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue ? true : false ;
	},
 
	getCloseboxFromEvent : function(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ",@class," "), " tab-close-button")]',
				aEvent.originalTarget || aEvent.target,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	isDisabled : function() 
	{
		return (document.getElementById('cmd_CustomizeToolbars').getAttribute('disabled') == 'true');
	},
 
	get browser() 
	{
		return gBrowser;
	},
 
	getArrayFromXPathResult : function(aXPathResult) 
	{
		var max = aXPathResult.snapshotLength;
		var array = new Array(max);
		if (!max) return array;

		for (var i = 0; i < max; i++)
		{
			array[i] = aXPathResult.snapshotItem(i);
		}

		return array;
	},
 
	getSelectedTabs : function(aTabBrowser) 
	{
		return this.getArrayFromXPathResult(this.evaluateXPath(
				'descendant::xul:tab[@'+this.kSELECTED+' = "true"]',
				(aTabBrowser || this.browser).mTabContainer
			));
	},
 
	getReadyToCloseTabs : function(aTabBrowser) 
	{
		return this.getArrayFromXPathResult(this.evaluateXPath(
				'descendant::xul:tab[@'+this.kREADY_TO_CLOSE+' = "true"]',
				(aTabBrowser || this.browser).mTabContainer
			));
	},
 
	getLeftTabsOf : function(aTab) 
	{
		return this.getArrayFromXPathResult(this.evaluateXPath(
				'preceding-sibling::xul:tab',
				aTab
			));
	},
 
	getRightTabsOf : function(aTab) 
	{
		return this.getArrayFromXPathResult(this.evaluateXPath(
				'following-sibling::xul:tab',
				aTab
			));
	},
 
	getSimilarTabsOf : function(aCurrentTab, aTabs) 
	{
		var resultTabs = [];
		if (!aCurrentTab) return resultTabs;

		if (!aTabs)
			aTabs = this.getTabBrowserFromChildren(aCurrentTab).mTabContainer.childNodes;

		try {
			var currentDomain = aCurrentTab.linkedBrowser.currentURI.host;
		}
		catch(e) {
			return resultTabs;
		}

		Array.prototype.slice.call(aTabs).forEach(function(aTab) {
			if (aTab == aCurrentTab) return;
			try {
				if (aTab.linkedBrowser.currentURI.host == currentDomain)
					resultTabs.push(aTab);
			}
			catch(e) {
			}
		});
		return resultTabs;
	},
 
	getTabFromEvent : function(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:tab',
				aEvent.originalTarget || aEvent.target,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getTabBrowserFromChildren : function(aTab) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:tabbrowser',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	get allowMoveMultipleTabs() 
	{
		return this.getPref('extensions.multipletab.tabdrag.moveMultipleTabs');
	},
 
	fireDuplicateEvent : function(aNewTab, aSourceTab) 
	{
		var event = document.createEvent('Events');
		event.initEvent('MultipleTabHandler:TabDuplicate', true, false);
		event.sourceTab = aSourceTab;
		aNewTab.dispatchEvent(event);
	},
  
/* Initializing */ 
	 
	init : function() 
	{
		if (!('gBrowser' in window)) return;

		window.addEventListener('mouseup', this, true);

		window.removeEventListener('load', this, false);

		this.addPrefListener(this);
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.tabdrag.mode');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.tabclick.mode');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.selectionStyle');

		this.initTabBrowser(gBrowser);

		window.setTimeout(function(aSelf) { aSelf.delayedInit(); }, 0, this);
	},
	delayedInit : function()
	{
		if ('SessionFix' in window) {
			eval('gBrowser.warnAboutClosingTabs = '+
				gBrowser.warnAboutClosingTabs.toSource().replace(
					'{',
					'{ var sessionKey = document.getElementById("sessionfix-bundle").getString("sessionKey"); '
				).replace(
					'var numTabs = ',
					'var numTabs = this.__multipletab__closedTabsNum || '
				).replace(
					'if (numWindows > 1)',
					'if (numWindows > 1 || this.__multipletab__closedTabsNum)'
				)
			);
		}

		if (!('duplicateTab' in gBrowser)) {
			gBrowser.duplicateTab = function(aTab) {
				MultipleTabService.duplicateTabs([aTab]);
				MultipleTabService.fireDuplicateEvent(this.mTabContainer.lastChild, aTab);
				return this.mTabContainer.lastChild;
			};
		}
	},
	 
	initTabBrowser : function(aTabBrowser) 
	{
		aTabBrowser.addEventListener('TabOpen', this, true);
		aTabBrowser.addEventListener('TabClose', this, true);
		aTabBrowser.addEventListener('TabMove', this, true);
		aTabBrowser.addEventListener('MultipleTabHandler:TabDuplicate', this, true);
		aTabBrowser.mTabContainer.addEventListener('draggesture', this, true);
		aTabBrowser.mTabContainer.addEventListener('mouseover',   this, true);
		aTabBrowser.mTabContainer.addEventListener('mousemove',   this, true);
		aTabBrowser.mTabContainer.addEventListener('mousedown',   this, true);

		eval(
			'aTabBrowser.warnAboutClosingTabs = '+
			aTabBrowser.warnAboutClosingTabs.toSource().replace(
				'var numTabs = ', 'var numTabs = this.__multipletab__closedTabsNum || '
			)
		);

/*
		eval(
			'aTabBrowser.onDragStart = '+
			aTabBrowser.onDragStart.toSource().replace(
				'aXferData.data.addDataForFlavour("text/unicode", URI.spec);',
				<><![CDATA[
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
				]]></>
			).replace(
				/(aXferData.data.addDataForFlavour\("text\/html", [^\)]+\);)/,
				<><![CDATA[
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
				]]></>
			)
		);
*/

		if ('duplicateTab' in aTabBrowser) {
			eval(
				'aTabBrowser.duplicateTab = '+
				aTabBrowser.duplicateTab.toSource().replace(
					'{',
					'{ var newTab;'
				).replace(
					/return /g,
					'newTab = '
				).replace(
					/(\}\)?)$/,
					<><![CDATA[
						MultipleTabService.fireDuplicateEvent(newTab, aTab);
						return newTab;
					$1]]></>
				)
			);
		}

		this.initTabBrowserContextMenu(aTabBrowser);

		var tabs = aTabBrowser.mTabContainer.childNodes;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.initTab(tabs[i]);
		}

		delete i;
		delete maxi;
		delete tabs;
	},
	 
	initTabBrowserContextMenu : function(aTabBrowser) 
	{
		var id = parseInt(Math.random() * 65000);
		var tabContextMenu = document.getAnonymousElementByAttribute(aTabBrowser, 'anonid', 'tabContextMenu');
		var template = document.getElementById(this.kCONTEXT_MENU_TEMPLATE);
		var items = template.childNodes;
		var item;
		var refNode;
		for (var i = 0, maxi = items.length; i < maxi; i++)
		{
			item = items[i].cloneNode(true);
			if (item.getAttribute('id'))
				item.setAttribute('id', item.getAttribute('id')+'-tabbrowser'+id);

			try {
				eval('refNode = '+item.getAttribute(this.kINSERT_BEFORE));
			}
			catch(e) {
				refNode = null;
			}

			if (refNode)
				tabContextMenu.insertBefore(item, refNode);
			else
				tabContextMenu.appendChild(item);
		}

		tabContextMenu.addEventListener('popupshowing', this, false);
	},
  
	initTab : function(aTab) 
	{
		aTab.addEventListener('mousemove', this, true);
	},
  	
	destroy : function() 
	{
		this.destroyTabBrowser(gBrowser);
		window.addEventListener('mouseup', this, true);

		window.removeEventListener('unload', this, false);

		this.removePrefListener(this);

		var tabs = gBrowser.mTabContainer.childNodes;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.destroyTab(tabs[i]);
		}

		var tabContextMenu = document.getAnonymousElementByAttribute(gBrowser, 'anonid', 'tabContextMenu');
		tabContextMenu.removeEventListener('popupshowing', this, false);
	},
	
	destroyTabBrowser : function(aTabBrowser) 
	{
		aTabBrowser.removeEventListener('TabOpen', this, true);
		aTabBrowser.removeEventListener('TabClose', this, true);
		aTabBrowser.removeEventListener('TabMove', this, true);
		aTabBrowser.removeEventListener('MultipleTabHandler:TabDuplicate', this, true);
		aTabBrowser.mTabContainer.removeEventListener('draggesture', this, true);
		aTabBrowser.mTabContainer.removeEventListener('mouseover',   this, true);
		aTabBrowser.mTabContainer.removeEventListener('mousemove',   this, true);
		aTabBrowser.mTabContainer.removeEventListener('mousedown',   this, true);

		var tabContextMenu = document.getAnonymousElementByAttribute(aTabBrowser, 'anonid', 'tabContextMenu');
		tabContextMenu.removeEventListener('popupshowing', this, false);
	},
 
	destroyTab : function(aTab) 
	{
		this.setSelection(aTab, false);
		if (!this.hasSelection())
			this.selectionModified = false;

		aTab.removeEventListener('mousemove', this, true);
	},
   
/* Event Handling */ 
	
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'mousedown':
				this.lastMouseDownX = aEvent.screenX;
				this.lastMouseDownY = aEvent.screenY;
				this.onTabClick(aEvent);
				break;

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
					!aEvent.currentTarget.movingSelectedTabs
					)
					this.moveBundledTabsOf(aEvent.originalTarget, aEvent);
				break;

			case 'MultipleTabHandler:TabDuplicate':
				if (
					this.isSelected(aEvent.sourceTab) &&
					this.allowMoveMultipleTabs &&
					!aEvent.currentTarget.duplicatingSelectedTabs
					)
					this.duplicateBundledTabsOf(aEvent.originalTarget, aEvent.sourceTab, aEvent);
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
				this.showHideMenuItems(aEvent.target);
				break;
		}
	},
 
	onTabClick : function(aEvent) 
	{
		if (aEvent.button != 0) return;

		var tab = this.getTabFromEvent(aEvent);
		if (tab) {
			var b = this.getTabBrowserFromChildren(tab);
			if (aEvent.shiftKey) {
				var tabs = b.mTabContainer.childNodes;
				var inSelection = false;
				for (var i = 0, maxi = tabs.length; i < maxi; i++)
				{
					if (tabs[i] == b.selectedTab ||
						tabs[i] == tab) {
						inSelection = !inSelection;
						this.setSelection(tabs[i], true);
					}
					else {
						this.setSelection(tabs[i], inSelection);
					}
				}
				aEvent.preventDefault();
				aEvent.stopPropagation();
				return;
			}
			else if (aEvent.ctrlKey || aEvent.metaKey) {
				if (this.tabClickMode != this.TAB_CLICK_MODE_TOGGLE) {
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
					this.delayedDragStartTimer = window.setTimeout(this.delayedDragStart, delay, aEvent);
				}
			}
		}
		if (this.selectionModified && !this.hasSelection())
			this.selectionModified = false;

		if (!tab || !this.isSelected(tab) ||
			!this.allowMoveMultipleTabs)
			this.clearSelection();
	},
	 
	delayedDragStart : function(aEvent) 
	{
		MultipleTabService.clearSelection();
		MultipleTabService.onTabDragStart(aEvent);
		MultipleTabService.tabDragging = false; // cancel "dragging" before we start to drag it really.
		MultipleTabService.delayedDragStartReady = true;
	},
	cancelDelayedDragStart : function()
	{
		if (this.delayedDragStartTimer) {
			window.clearTimeout(this.delayedDragStartTimer);
			this.delayedDragStartTimer = null;
		}
	},
	delayedDragStartTimer : null,
  
	onTabDragStart : function(aEvent) 
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
			this.clearSelectionSub(this.getSelectedTabs(this.getTabBrowserFromChildren(tab)), this.kSELECTED);
			tab.setAttribute(this.kREADY_TO_CLOSE, true);
		}
		else if (
			this.isEventFiredOnTabIcon(aEvent) ||
			this.tabDragMode == this.TAB_DRAG_MODE_DEFAULT
			) {
			return;
		}
		else {
			var delay = this.getPref('extensions.multipletab.tabdrag.delay');
			if (delay > 0 && Date.now() - this.lastMouseDown < delay)
				return
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
 
	onTabDragEnd : function(aEvent) 
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
				this.showSelectionPopup(aEvent, this.getPref('extensions.multipletab.tabdrag.autoclear'));
			}
			else {
				this.clearSelection();
			}
		}
		this.delayedDragStartReady = false;

		this.lastMouseOverTarget = null;
	},
 
	onTabDragEnter : function(aEvent) 
	{
		if (!(
				this.tabDragging ||
				this.tabCloseboxDragging
			) || this.isDisabled())
			return;

		var b = this.getTabBrowserFromChildren(aEvent.originalTarget);
		var arrowscrollbox = b.mTabContainer.mTabstrip;
		if (aEvent.originalTarget == document.getAnonymousElementByAttribute(arrowscrollbox, 'class', 'scrollbutton-up')) {
			arrowscrollbox._startScroll(-1);
		}
		else if (aEvent.originalTarget == document.getAnonymousElementByAttribute(arrowscrollbox, 'class', 'scrollbutton-down')) {
			arrowscrollbox._startScroll(1);
		}
	},
 
	onTabDragOver : function(aEvent) 
	{
		if (!(
				this.tabDragging ||
				this.tabCloseboxDragging
			) || this.isDisabled())
			return;

		if (this.tabDragging) {
			var tab = this.getTabFromEvent(aEvent);
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
					var b = this.getTabBrowserFromChildren(tab);
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

			var tab = this.getTabFromEvent(aEvent);
			if (tab.getAttribute(this.kREADY_TO_CLOSE) == 'true')
				tab.removeAttribute(this.kREADY_TO_CLOSE);
			else
				tab.setAttribute(this.kREADY_TO_CLOSE, true);
		}
	},
  
/* Popup */ 
	
	get tabSelectionPopup() { 
		if (!this._tabSelectionPopup) {
			this._tabSelectionPopup = document.getElementById(this.kSELECTION_MENU);
		}
		return this._tabSelectionPopup;
	},
	_tabSelectionPopup : null,
 
	showSelectionPopup : function(aEvent, aAutoClearSelection) 
	{
		var popup = this.tabSelectionPopup;
		popup.hidePopup();
		popup.autoClearSelection = aAutoClearSelection;
		document.popupNode = gBrowser.mTabContainer;
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
 
	showHideMenuItems : function(aPopup) 
	{
		var nodes = aPopup.childNodes;
		var pref;

		var b   = this.getTabBrowserFromChildren(aPopup) || this.browser;
		var box = b.mTabContainer.mTabstrip || b.mTabContainer ;
		var isVertical = ((box.getAttribute('orient') || window.getComputedStyle(box, '').getPropertyValue('-moz-box-orient')) == 'vertical');

		var label;
		var key;
		var selectType = this.getPref('extensions.multipletab.clipboard.formatType') == this.FORMAT_TYPE_SELECT;

		for (var i = 0, maxi = nodes.length; i < maxi; i++)
		{
			if (
				(isVertical && (label = nodes[i].getAttribute('label-vertical'))) ||
				(!isVertical && (label = nodes[i].getAttribute('label-horizontal')))
				)
				nodes[i].setAttribute('label', label);

			key = nodes[i].getAttribute('id').replace(/-tabbrowser[0-9]+$/, '');
			if (/^(multipletab-(context|selection)-clipboard(All)?)(:select)?$/.test(key)) {
				key  = RegExp.$1
				pref = this.getPref('extensions.multipletab.show.'+key) &&
						(Boolean(RegExp.$4) == selectType);
			}
			else {
				pref = this.getPref('extensions.multipletab.show.'+key);
			}

			if (pref === null) continue;

			if (pref)
				nodes[i].removeAttribute('hidden');
			else
				nodes[i].setAttribute('hidden', true);
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
	
	getSeparators : function(aPopup) 
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
 
	getObsoleteSeparator : function(aPopup) 
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
   
/* Commands */ 
	 
	closeTabs : function(aTabs) 
	{
		if (!aTabs) return;

		var max = aTabs.length;
		if (!max) return;

		var b = this.getTabBrowserFromChildren(aTabs[0]);
		b.__multipletab__closedTabsNum = max;
		if (
			max > 1 &&
			!b.warnAboutClosingTabs(true)
			) {
			b.__multipletab__closedTabsNum = 0;
			return;
		}
		b.__multipletab__closedTabsNum = 0;

		for (var i = max-1; i > -1; i--)
		{
			b.removeTab(aTabs[i]);
		}
	},
 
	closeSimilarTabsOf : function(aCurrentTab, aTabs) 
	{
		if (!aCurrentTab) return;

		var removeTabs = this.getSimilarTabsOf(aCurrentTab, aTabs);
		var max = removeTabs.length;
		var b   = this.getTabBrowserFromChildren(aCurrentTab);
		b.__multipletab__closedTabsNum = max;
		if (
			max > 1 &&
			!b.warnAboutClosingTabs(true)
			) {
			b.__multipletab__closedTabsNum = 0;
			return;
		}
		b.__multipletab__closedTabsNum = 0;

		removeTabs.forEach(function(aTab) {
			b.removeTab(aTab);
		});
	},
 
	reloadTabs : function(aTabs) 
	{
		if (!aTabs) return;

		var b;
		var self = this;
		Array.prototype.slice.call(aTabs).forEach(function(aTab) {
			if (!b) b = self.getTabBrowserFromChildren(aTab);
			b.reloadTab(aTab);
		});
	},
 
	addBookmarkFor : function(aTabs) 
	{
		if (!aTabs) return;

		var b = this.getTabBrowserFromChildren(aTabs[0]);

		if ('PlacesUtils' in window) { // Firefox 3
			PlacesUtils.showMinimalAddMultiBookmarkUI(Array.prototype.slice.call(aTabs).map(function(aTab) {
				return aTab.linkedBrowser.currentURI;
			}));
			return;
		}

		var currentTabInfo;
		var tabsInfo = Array.prototype.slice.call(aTabs).map(function(aTab) {
				var webNav = aTab.linkedBrowser.webNavigation;
				var url    = webNav.currentURI.spec;
				var name   = '';
				var charSet, description;
				try {
					var doc = webNav.document;
					name = doc.title || url;
					charSet = doc.characterSet;
					description = BookmarksUtils.getDescriptionFromDocument(doc);
				}
				catch (e) {
					name = url;
				}
				return {
					name        : name,
					url         : url,
					charset     : charSet,
					description : description
				};
			});

		window.openDialog(
			'chrome://browser/content/bookmarks/addBookmark2.xul',
			'',
			BROWSER_ADD_BM_FEATURES,
			(aTabs.length == 1 ?
				tabsInfo[0] :
				{
					name             : gNavigatorBundle.getString('bookmarkAllTabsDefault'),
					bBookmarkAllTabs : true,
					objGroup         : tabsInfo
				}
			)
		);
	},
 
	duplicateTabs : function(aTabs) 
	{
		if (!aTabs) return;

		var max = aTabs.length;
		if (!max) return;

		var b  = this.getTabBrowserFromChildren(aTabs[0]);
		var SS = this.SessionStore;

		var selectedIndex = -1;
		for (var i = max-1; i > -1; i--)
		{
			SS.setTabValue(aTabs[i], this.kSELECTED, 'true');
			if (aTabs[i] == b.selectedTab)
				selectedIndex = i;
		}
		if (selectedIndex > -1) {
			selectedIndex += b.mTabContainer.childNodes.length;
		}

		var state = SS.getWindowState(window);

		// delete obsolete data
		eval('state = '+state);
		delete state.windows[0]._closedTabs;
		for (var i = state.windows[0].tabs.length-1; i > -1; i--)
		{
			if (!state.windows[0].tabs[i].extData ||
				state.windows[0].tabs[i].extData[this.kSELECTED] != 'true') {
				state.windows[0].tabs.splice(i, 1);
				if (i < state.windows[0].selected)
					state.windows[0].selected--;
			}
			else {
				delete state.windows[0].tabs[i].extData[this.kSELECTED];
			}
		}
		state = state.toSource();

		for (var i = max-1; i > -1; i--)
		{
			SS.deleteTabValue(aTabs[i], this.kSELECTED);
		}

		SS.setWindowState(window, state, false);

		if (selectedIndex > -1)
			b.selectedTab = b.mTabContainer.childNodes[selectedIndex];
	},
 
	splitWindowFrom : function(aTabs) 
	{
		if (!aTabs) return;

		var max = aTabs.length;
		if (!max) return;


		// Step 1: get window state

		var b  = this.getTabBrowserFromChildren(aTabs[0]);
		var SS = this.SessionStore;

		for (var i = max-1; i > -1; i--)
		{
			SS.setTabValue(aTabs[i], this.kSELECTED, 'true');
		}

		var state = SS.getWindowState(window);

		// delete obsolete data
		eval('state = '+state);
		delete state.windows[0]._closedTabs;
		for (var i = state.windows[0].tabs.length-1; i > -1; i--)
		{
			if (!state.windows[0].tabs[i].extData ||
				state.windows[0].tabs[i].extData[this.kSELECTED] != 'true') {
				state.windows[0].tabs.splice(i, 1);
				if (i < state.windows[0].selected)
					state.windows[0].selected--;
			}
		}
		state = state.toSource();


		// Step 2: remove obsolete tabs

		var tab;
		for (var i = max-1; i > -1; i--)
		{
			tab = aTabs[i];
			SS.deleteTabValue(tab, this.kSELECTED);
			if (tab.linkedBrowser.sessionHistory)
				tab.linkedBrowser.sessionHistory.PurgeHistory(tab.linkedBrowser.sessionHistory.count);
			tab.linkedBrowser.contentWindow.location.replace('about:blank');
			tab.setAttribute('collapsed', true);
			tab.__multipletab__shouldRemove = true;
		}
		delete tab;

		window.setTimeout(function() {
			var tabs = b.mTabContainer.childNodes;
			for (var i = tabs.length-1; i > -1; i--)
			{
				if (tabs[i].__multipletab__shouldRemove)
					b.removeTab(tabs[i]);
			}
			delete tabs;
			delete b;
			delete i;
		}, 0);

		return this.openNewWindowWithTabs(state, max);
	},
	
	openNewWindowWithTabs : function(aState, aNumTabs) 
	{
		// Step 3: Restore state in new window

		var SS = this.SessionStore;

		var newWin = window.openDialog(location.href, '_blank', 'chrome,all,dialog=no', 'about:blank');
		var key = this.kSELECTED;
		newWin.addEventListener('load', function() {
			newWin.removeEventListener('load', arguments.callee, false);

			SS.setWindowState(newWin, aState, false);
			delete aState;

			newWin.gBrowser.mStrip.setAttribute('collapsed', true);


			// Step 4: Remove obsolete tabs

			newWin.setTimeout(function() {
				var restored = false;
				var tabs = newWin.gBrowser.mTabContainer.childNodes;
				var count = 0;
				for (var i = tabs.length-1; i > -1; i--)
				{
					if (SS.getTabValue(tabs[i], key)) count++;
				}

				// if this window is not initialized yet, continue after a while.
				if (count < aNumTabs) {
					newWin.setTimeout(arguments.callee, 10);
					return;
				}
				delete count;
				delete aNumTabs;


				for (var i = tabs.length-1; i > -1; i--)
				{
					if (SS.getTabValue(tabs[i], key)) {
						count++;
						continue;
					}
					try {
						if (tabs[i].linkedBrowser.sessionHistory)
							tabs[i].linkedBrowser.sessionHistory.PurgeHistory(tabs[i].linkedBrowser.sessionHistory.count);
					}
					catch(e) {
						dump(e+'\n');
					}
					tabs[i].linkedBrowser.contentWindow.location.replace('about:blank');
					tabs[i].__multipletab__shouldRemove = true;
				}

				window.setTimeout(function() {
					for (var i = tabs.length-1; i > -1; i--)
					{
						try {
							SS.deleteTabValue(tabs[i], key);
						}
						catch(e) {
						}

						if (tabs[i].__multipletab__shouldRemove)
							newWin.gBrowser.removeTab(tabs[i]);
						else
							tabs[i].removeAttribute('collapsed');
					}

					newWin.gBrowser.mStrip.removeAttribute('collapsed');
					newWin.focus();

					delete i;
					delete tabs;
					delete newWin;
					delete SS;
				}, 0);
			}, 0);

			delete tabs;
		}, false);

		return newWin;
	},
  
	copyURIsToClipboard : function(aTabs, aFormat) 
	{
		if (!aTabs) return;

		var clipboard = Components.classes['@mozilla.org/widget/clipboardhelper;1']
								.getService(Components.interfaces.nsIClipboardHelper);
		var self = this;
		var stringToCopy = Array.prototype.slice.call(aTabs).map(function(aTab) {
				return self.formatURIStringForClipboard(aTab.linkedBrowser.currentURI.spec, aTab, aFormat);
			});
		if (stringToCopy.length > 1)
			stringToCopy.push('');
		clipboard.copyString(stringToCopy.join('\r\n'));
	},
	
	FORMAT_TYPE_SELECT  : -1, 
	FORMAT_TYPE_DEFAULT : 0,
	FORMAT_TYPE_MOZ_URL : 1,
	FORMAT_TYPE_LINK    : 2,
 
	formatURIStringForClipboard : function(aURI, aTab, aFormat) 
	{
		var format = aFormat || this.getPref('extensions.multipletab.clipboard.formatType');
		switch (format)
		{
			default:
			case this.FORMAT_TYPE_DEFAULT:
				return aURI;

			case this.FORMAT_TYPE_MOZ_URL:
				return (aTab.linkedBrowser.contentDocument.title || aTab.getAttribute('label'))+
					'\r\n'+aURI;

			case this.FORMAT_TYPE_LINK:
				return [
					'<a href="'+aURI.replace(/"/g, '&quot;')+'">',
					(aTab.linkedBrowser.contentDocument.title || aTab.getAttribute('label')),
					'</a>'
				].join('');
		}
	},
  
	moveBundledTabsOf : function(aMovedTab, aEvent) 
	{
		var b = this.getTabBrowserFromChildren(aMovedTab);
		var tabs = this.getSelectedTabs(b);
		var offset = 0;
		b.movingSelectedTabs = true;
		tabs.forEach(function(aTab) {
			if (aTab == aMovedTab) return;
			var pos = aMovedTab._tPos + (++offset);
			if (pos > aTab._tPos) pos--;
			b.moveTabTo(aTab, pos);
		});
		b.movingSelectedTabs = false;
	},
 
	duplicateBundledTabsOf : function(aNewTab, aSourceTab, aEvent) 
	{
		var b = this.getTabBrowserFromChildren(aNewTab);
		var offset = 0;
		var self = this;
		var tabs, remoteBrowser, remoteService, shouldBeClosed;
		b.duplicatingSelectedTabs = true;
		b.movingSelectedTabs = true;
		if (aNewTab.ownerDocument == aSourceTab.ownerDocument) {
			tabs = this.getSelectedTabs(b);
		}
		else { // moved from another window
			remoteService = aSourceTab.ownerDocument.defaultView.MultipleTabService;
			remoteBrowser = remoteService.getTabBrowserFromChildren(aSourceTab);
			tabs = remoteService.getSelectedTabs(remoteBrowser);
			shouldBeClosed = remoteBrowser.mTabContainer.childNodes.length == tabs.length;
		}
		tabs.forEach(function(aTab) {
			self.setSelection(aTab, false);
			if (aTab == aSourceTab) return;
			var newTab = b.duplicateTab(aTab);
			self.setSelection(newTab, true);
			var pos = aNewTab._tPos + (++offset);
			if (pos > newTab._tPos) pos--;
			b.moveTabTo(newTab, pos);
			if (remoteBrowser) remoteBrowser.removeTab(aTab);
		});
		if (shouldBeClosed) remoteBrowser.ownerDocument.defaultView.close();
		this.setSelection(aNewTab, true);
		b.movingSelectedTabs = false;
		b.duplicatingSelectedTabs = false;
	},
  
/* Tab Selection */ 
	
	hasSelection : function(aTabBrowser) 
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
 
	isSelected : function(aTab) 
	{
		return aTab.getAttribute(this.kSELECTED) == 'true';
	},
 
	setSelection : function(aTab, aState) 
	{
		if (!aState) {
			aTab.removeAttribute(this.kSELECTED);
			try {
				this.SessionStore.deleteTabValue(aTab, this.kSELECTED);
			}
			catch(e) {
			}
		}
		else {
			aTab.setAttribute(this.kSELECTED, true);
			try {
				this.SessionStore.setTabValue(aTab, this.kSELECTED, 'true');
			}
			catch(e) {
			}
		}
		this.selectionModified = true;

		if ('TreeStyleTabService' in window &&
			'getDescendantTabs' in TreeStyleTabService &&
			aTab.getAttribute(TreeStyleTabService.kSUBTREE_COLLAPSED) == 'true') {
			var tabs = TreeStyleTabService.getDescendantTabs(aTab);
			for (var i = 0, maxi = tabs.length; i < maxi; i++)
			{
				this.setSelection(tabs[i], aState);
			}
		}

		return aState;
	},
 
	toggleSelection : function(aTab) 
	{
		return this.setSelection(aTab, aTab.getAttribute(this.kSELECTED) != 'true');
	},
 
	clearSelection : function(aTabBrowser) 
	{
		this.clearSelectionSub(this.getSelectedTabs(aTabBrowser), this.kSELECTED);
		this.clearSelectionSub(this.getReadyToCloseTabs(aTabBrowser), this.kREADY_TO_CLOSE);
		this.selectionModified = false;
	},
	clearSelectionSub : function(aTabs, aAttr)
	{
		if (!aTabs || !aTabs.length) return;

		for (var i = aTabs.length-1; i > -1; i--)
		{
			aTabs[i].removeAttribute(aAttr);
			try {
				this.SessionStore.deleteTabValue(aTabs[i], aAttr);
			}
			catch(e) {
			}
		}
	},
	selectionModified : false,
  
/* Pref Listener */ 
	
	domain : 'extensions.multipletab', 
 
	observe : function(aSubject, aTopic, aPrefName) 
	{
		if (aTopic != 'nsPref:changed') return;

		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.multipletab.tabdrag.mode':
				this.tabDragMode = value;
				break;

			case 'extensions.multipletab.tabclick.mode':
				this.tabClickMode = value;
				break;

			case 'extensions.multipletab.selectionStyle':
				if (value == 'auto') {
					value = ('tabColors' in window || 'CHROMATABS' in window) ? 'border' :
							'color' ;
				}
				document.documentElement.setAttribute(this.kSELECTION_STYLE, value);
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
 
	getPref : function(aPrefstring) 
	{
		try {
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
 
	setPref : function(aPrefstring, aNewValue) 
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
 
	clearPref : function(aPrefstring) 
	{
		try {
			this.Prefs.clearUserPref(aPrefstring);
		}
		catch(e) {
		}

		return;
	},
 
	addPrefListener : function(aObserver) 
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
 
	removePrefListener : function(aObserver) 
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
window.addEventListener('unload', MultipleTabService, false);
 
