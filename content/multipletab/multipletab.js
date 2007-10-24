var MultipleTabService = { 
	PREFROOT : 'extensions.multipletab@piro.sakura.ne.jp',

	tabDragMode : -1,
	TAB_DRAG_MODE_DEFAULT : 0,
	TAB_DRAG_MODE_SELECT  : 1,
	TAB_DRAG_MODE_SWITCH  : 2,


	tabClickMode : -1,
	TAB_CLICK_MODE_DEFAULT : 0,
	TAB_CLICK_MODE_TOGGLE  : 1,

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
		var tab = this.getTabFromEvent(aEvent);
		if (!tab) return false;

		var icon = document.getAnonymousElementByAttribute(tab, 'class', 'tab-icon');
		var box = icon.boxObject;
		if (aEvent.screenX > box.screenX &&
			aEvent.screenY > box.screenY &&
			aEvent.screenX < box.screenX + box.width &&
			aEvent.screenY < box.screenY + box.height)
			return true;

		return false;
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
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:tab[@multipletab-selected = "true"]',
					(aTabBrowser || this.browser).mTabContainer,
					this.NSResolver, // document.createNSResolver(document.documentElement),
					XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
					null
				);
			return this.getArrayFromXPathResult(xpathResult);
		}
		catch(e) {
		}
		return [];
	},
 
	getReadyToCloseTabs : function(aTabBrowser) 
	{
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:tab[@multipletab-ready-to-close = "true"]',
					(aTabBrowser || this.browser).mTabContainer,
					this.NSResolver, // document.createNSResolver(document.documentElement),
					XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
					null
				);
			return this.getArrayFromXPathResult(xpathResult);
		}
		catch(e) {
		}
		return [];
	},
 
	getLeftTabsOf : function(aTab) 
	{
		try {
			var xpathResult = document.evaluate(
					'preceding-sibling::xul:tab',
					aTab,
					this.NSResolver, // document.createNSResolver(document.documentElement),
					XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
					null
				);
			return this.getArrayFromXPathResult(xpathResult);
		}
		catch(e) {
		}
		return [];
	},
 
	getRightTabsOf : function(aTab) 
	{
		try {
			var xpathResult = document.evaluate(
					'following-sibling::xul:tab',
					aTab,
					this.NSResolver, // document.createNSResolver(document.documentElement),
					XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
					null
				);
			return this.getArrayFromXPathResult(xpathResult);
		}
		catch(e) {
		}
		return [];
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
		var target = aEvent.originalTarget || aEvent.target;
		while (target.localName != 'tab' && target.localName != 'tabs' && target.parentNode)
			target = target.parentNode;

		return (target.localName == 'tab') ? target : null ;
	},
 
	getTabBrowserFromChildren : function(aTab) 
	{
		var target = aTab;
		while (target.localName != 'tabbrowser' && target.parentNode)
			target = target.parentNode;

		return (target.localName == 'tabbrowser') ? target : null ;
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

		this.initTabBrowser(gBrowser);
	},
	 
	initTabBrowser : function(aTabBrowser) 
	{
		aTabBrowser.mTabContainer.addEventListener('draggesture', this, true);
		aTabBrowser.mTabContainer.addEventListener('mouseover',   this, true);
		aTabBrowser.mTabContainer.addEventListener('mousemove',   this, true);
		aTabBrowser.mTabContainer.addEventListener('mousedown',   this, true);

		var addTabMethod = 'addTab';
		var removeTabMethod = 'removeTab';
		if (aTabBrowser.__tabextensions__addTab) {
			addTabMethod = '__tabextensions__addTab';
			removeTabMethod = '__tabextensions__removeTab';
		}

		aTabBrowser.__multipletab__originalAddTab = aTabBrowser[addTabMethod];
		aTabBrowser[addTabMethod] = function() {
			var tab = this.__multipletab__originalAddTab.apply(this, arguments);
			try {
				MultipleTabService.initTab(tab);
			}
			catch(e) {
			}
			return tab;
		};

		aTabBrowser.__multipletab__originalRemoveTab = aTabBrowser[removeTabMethod];
		aTabBrowser[removeTabMethod] = function(aTab) {
			MultipleTabService.destroyTab(aTab);
			var retVal = this.__multipletab__originalRemoveTab.apply(this, arguments);
			try {
				if (aTab.parentNode)
					MultipleTabService.initTab(aTab);
			}
			catch(e) {
			}
			return retVal;
		};

		eval(
			'aTabBrowser.warnAboutClosingTabs = '+
			aTabBrowser.warnAboutClosingTabs.toSource().replace(
				/\)/, ', aNumTabs)'
			).replace(
				/var numTabs = /, 'var numTabs = aNumTabs || '
			)
		);

		this.initTabBrowserContextMenu(aTabBrowser);

		var tabs = aTabBrowser.mTabContainer.childNodes;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.initTab(tabs[i]);
		}

		delete addTabMethod;
		delete removeTabMethod;
		delete i;
		delete maxi;
		delete tabs;
	},
	 
	initTabBrowserContextMenu : function(aTabBrowser) 
	{
		var id = parseInt(Math.random() * 65000);
		var tabContextMenu = document.getAnonymousElementByAttribute(aTabBrowser, 'anonid', 'tabContextMenu');
		var template = document.getElementById('multipletab-tabcontext-menu-template');
		var items = template.childNodes;
		var item;
		var refNode;
		for (var i = 0, maxi = items.length; i < maxi; i++)
		{
			item = items[i].cloneNode(true);
			if (item.getAttribute('id'))
				item.setAttribute('id', item.getAttribute('id')+'-tabbrowser'+id);

			try {
				eval('refNode = '+item.getAttribute('multipletab-insertbefore'));
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

			case 'load':
				this.init();
				break;

			case 'unload':
				this.destroy();
				break;

			case 'popupshowing':
				if (
					aEvent.target.id != 'multipletab-selection-menu' &&
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
				if (this.tabClickMode != this.TAB_CLICK_MODE_TOGGLE) return;

				if (!this.selectionModified && !this.hasSelection())
					this.setSelection(b.selectedTab, true);

				this.toggleSelection(tab);
				aEvent.preventDefault();
				aEvent.stopPropagation();
				return;
			}
		}
		if (this.selectionModified && !this.hasSelection())
			this.selectionModified = false;

		this.clearSelection();
	},
 
	onTabDragStart : function(aEvent) 
	{
		var tab = this.getTabFromEvent(aEvent);
		if (!tab) {
			this.lastMouseOverTarget = null;
			return;
		}

		if (tab.mOverCloseButton) {
			this.tabCloseboxDragging = true;
			this.lastMouseOverTarget = document.getAnonymousElementByAttribute(tab, 'anonid', 'close-button');
			tab.setAttribute('multipletab-ready-to-close', true);
		}
		else if (
			this.isEventFiredOnTabIcon(aEvent) ||
			this.tabDragMode == this.TAB_DRAG_MODE_DEFAULT
			) {
			return;
		}
		else {
			this.tabDragging = true;
			this.lastMouseOverTarget = tab;
			if (this.tabDragMode == this.TAB_DRAG_MODE_SELECT)
				this.setSelection(tab, true);
		}

		aEvent.preventDefault();
		aEvent.stopPropagation();
	},
	tabDragging         : false,
	tabCloseboxDragging : false,
	lastMouseOverTarget    : null,
 
	onTabDragEnd : function(aEvent) 
	{
		if (this.tabCloseboxDragging) {
			this.tabCloseboxDragging = false;
			this.closeTabs(this.getReadyToCloseTabs());
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

			var onClosebox = aEvent.originalTarget.getAttribute('anonid') == 'close-button';
			if (!onClosebox) return;

			var tab = this.getTabFromEvent(aEvent);
			if (tab.getAttribute('multipletab-ready-to-close') == 'true')
				tab.removeAttribute('multipletab-ready-to-close');
			else
				tab.setAttribute('multipletab-ready-to-close', true);
		}
	},
  
/* Popup */ 
	
	get tabSelectionPopup() { 
		if (!this._tabSelectionPopup) {
			this._tabSelectionPopup = document.getElementById('multipletab-selection-menu');
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

		for (var i = 0, maxi = nodes.length; i < maxi; i++)
		{
			if (
				(isVertical && (label = nodes[i].getAttribute('label-vertical'))) ||
				(!isVertical && (label = nodes[i].getAttribute('label-horizontal')))
				)
				nodes[i].setAttribute('label', label);

			pref = this.getPref('extensions.multipletab.show.'+nodes[i].getAttribute('id').replace(/-tabbrowser[0-9]+$/, ''));
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

		if (
			max > 1 &&
			!b.warnAboutClosingTabs(true, max)
			)
			return;

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
		if (
			max > 1 &&
			!b.warnAboutClosingTabs(true, max)
			)
			return;

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
			SS.setTabValue(aTabs[i], 'multipletab-selected', 'true');
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
				state.windows[0].tabs[i].extData['multipletab-selected'] != 'true') {
				state.windows[0].tabs.splice(i, 1);
				if (i < state.windows[0].selected)
					state.windows[0].selected--;
			}
			else {
				delete state.windows[0].tabs[i].extData['multipletab-selected'];
			}
		}
		state = state.toSource();

		for (var i = max-1; i > -1; i--)
		{
			SS.deleteTabValue(aTabs[i], 'multipletab-selected');
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
			SS.setTabValue(aTabs[i], 'multipletab-selected', 'true');
		}

		var state = SS.getWindowState(window);

		// delete obsolete data
		eval('state = '+state);
		delete state.windows[0]._closedTabs;
		for (var i = state.windows[0].tabs.length-1; i > -1; i--)
		{
			if (!state.windows[0].tabs[i].extData ||
				state.windows[0].tabs[i].extData['multipletab-selected'] != 'true') {
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
			SS.deleteTabValue(tab, 'multipletab-selected');
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
					if (SS.getTabValue(tabs[i], 'multipletab-selected')) count++;
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
					if (SS.getTabValue(tabs[i], 'multipletab-selected')) {
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
							SS.deleteTabValue(tabs[i], 'multipletab-selected');
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
  
	copyURIsToClipboard : function(aTabs) 
	{
		if (!aTabs) return;

		var clipboard = Components.classes['@mozilla.org/widget/clipboardhelper;1']
								.getService(Components.interfaces.nsIClipboardHelper);
		var self = this;
		var stringToCopy = Array.prototype.slice.call(aTabs).map(function(aTab) {
				return self.formatURIStringForClipboard(aTab.linkedBrowser.currentURI.spec, aTab);
			});
		if (stringToCopy.length > 1)
			stringToCopy.push('');
		clipboard.copyString(stringToCopy.join('\r\n'));
	},
	
	FORMAT_TYPE_DEFAULT : 0, 
	FORMAT_TYPE_MOZ_URL : 1,
	FORMAT_TYPE_LINK    : 2,
 
	formatURIStringForClipboard : function(aURI, aTab) 
	{
		switch (this.getPref('extensions.multipletab.clipboard.formatType'))
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
   
/* Tab Selection */ 
	 
	hasSelection : function(aTabBrowser) 
	{
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:tab[@multipletab-selected = "true"]',
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
		return aTab.getAttribute('multipletab-selected') == 'true';
	},
 
	setSelection : function(aTab, aState) 
	{
		if (!aState) {
			aTab.removeAttribute('multipletab-selected');
			try {
				this.SessionStore.deleteTabValue(aTab, 'multipletab-selected');
			}
			catch(e) {
			}
		}
		else {
			aTab.setAttribute('multipletab-selected', true);
			try {
				this.SessionStore.setTabValue(aTab, 'multipletab-selected', 'true');
			}
			catch(e) {
			}
		}
		this.selectionModified = true;
		return aState;
	},
 
	toggleSelection : function(aTab) 
	{
		return this.setSelection(aTab, aTab.getAttribute('multipletab-selected') != 'true');
	},
 
	clearSelection : function(aTabBrowser) 
	{
		this.clearSelectionSub(this.getSelectedTabs(aTabBrowser), 'multipletab-selected');
		this.clearSelectionSub(this.getReadyToCloseTabs(aTabBrowser), 'multipletab-ready-to-close');
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
 
