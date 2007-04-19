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
 
	getSelectedTabs : function() 
	{
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:tab[@multipletab-selected = "true"]',
					this.browser.mTabContainer,
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
	tabsSelected : function() 
	{
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:tab[@multipletab-selected = "true"]',
					this.browser.mTabContainer,
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
 
	getReadyToCloseTabs : function() 
	{
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:tab[@multipletab-ready-to-close = "true"]',
					this.browser.mTabContainer,
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

		gBrowser.mTabContainer.addEventListener('draggesture', this, true);
		gBrowser.mTabContainer.addEventListener('mouseover',   this, true);
		gBrowser.mTabContainer.addEventListener('mousemove',   this, true);
		gBrowser.mTabContainer.addEventListener('mousedown',   this, true);
		window.addEventListener('mouseup', this, true);

		window.removeEventListener('load', this, false);

		this.addPrefListener(this);
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.tabdrag.mode');
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.tabclick.mode');

		this.updateTabBrowser(gBrowser);
	},
	 
	updateTabBrowser : function(aTabBrowser) 
	{
		var addTabMethod = 'addTab';
		var removeTabMethod = 'removeTab';
		if (aTabBrowser.__tabextensions__addTab) {
			addTabMethod = '__tabextensions__addTab';
			removeTabMethod = '__tabextensions__removeTab';
		}

		var originalAddTab = aTabBrowser[addTabMethod];
		aTabBrowser[addTabMethod] = function() {
			var tab = originalAddTab.apply(this, arguments);
			try {
				MultipleTabService.initTab(tab);
			}
			catch(e) {
			}
			return tab;
		};

		var originalRemoveTab = aTabBrowser[removeTabMethod];
		aTabBrowser[removeTabMethod] = function(aTab) {
			MultipleTabService.destroyTab(aTab);
			var retVal = originalRemoveTab.apply(this, arguments);
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

		this.updateTabBrowserContextMenu(aTabBrowser);

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
	initTab : function(aTab)
	{
		aTab.addEventListener('mousemove', this, true);
	},
	destroyTab : function(aTab)
	{
		aTab.removeEventListener('mousemove', this, true);
	},
	 
	updateTabBrowserContextMenu : function(aTabBrowser) 
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
   
	destroy : function() 
	{
		gBrowser.mTabContainer.removeEventListener('draggesture', this, true);
		gBrowser.mTabContainer.removeEventListener('mouseover',   this, true);
		gBrowser.mTabContainer.removeEventListener('mousemove',   this, true);
		gBrowser.mTabContainer.removeEventListener('mousedown',   this, true);
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
  
/* Event Handling */ 
	
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'mousedown':
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
				this.showHideMenuItems(aEvent.target);
				break;
		}
	},
 
	onTabClick : function(aEvent) 
	{
		if (aEvent.button != 0 || (!aEvent.ctrlKey && !aEvent.metaKey)) return;

		var tab = this.getTabFromEvent(aEvent);
		if (!tab && this.tabClickMode != this.TAB_CLICK_MODE_TOGGLE) return;

		this.toggleTabSelected(tab);
		aEvent.preventDefault();
		aEvent.stopPropagation();
	},
 
	onTabDragStart : function(aEvent) 
	{
		var tab = this.getTabFromEvent(aEvent);
		if (!tab) {
			this.lastMouseOverTarget = null;
			return;
		}

		if (this.isEventFiredOnTabIcon(aEvent)) return;

		if (tab.mOverCloseButton) {
			this.tabCloseboxDragging = true;
			this.lastMouseOverTarget = document.getAnonymousElementByAttribute(tab, 'anonid', 'close-button');
			tab.setAttribute('multipletab-ready-to-close', true);
		}
		else {
			this.tabDragging = true;
			this.lastMouseOverTarget = tab;
			if (this.tabDragMode == this.TAB_DRAG_MODE_SELECT)
				tab.setAttribute('multipletab-selected', true);
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
			if (this.tabsSelected()) {
				this.tabSelectPopupMenu.hidePopup();
				this.tabSelectPopupMenu.showPopup(
					document.documentElement,
					aEvent.screenX - document.documentElement.boxObject.screenX,
					aEvent.screenY - document.documentElement.boxObject.screenY,
					'popup'
				);
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
					this.toggleTabSelected(tab);
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
 
	toggleTabSelected : function(aTab) 
	{
		if (aTab.getAttribute('multipletab-selected') == 'true') {
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
	},
 
	isTabSelected : function(aTab) 
	{
		return aTab.getAttribute('multipletab-selected') == 'true';
	},
  
/* Popup */ 
	 
	get tabSelectPopupMenu() { 
		if (!this._tabSelectPopupMenu) {
			this._tabSelectPopupMenu = document.getElementById('multipletab-selection-menu');
		}
		return this._tabSelectPopupMenu;
	},
	_tabSelectPopupMenu : null,

 
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
 
	getObsoleteSeparators : function(aPopup) 
	{
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:menuseparator[not(following-sibling::*[not(@hidden)]) or not(preceding-sibling::*[not(@hidden)]) or local-name(following-sibling::*[not(@hidden)]) = "menuseparator"]',
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

		separators = this.getObsoleteSeparators(aPopup);
		for (var i = separators.snapshotLength-1; i > -1; i--)
		{
			separators.snapshotItem(i).setAttribute('hidden', true);
		}
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
 
	reloadTabs : function(aTabs) 
	{
		if (!aTabs) return;

		var max = aTabs.length;
		if (!max) return;

		var b = this.getTabBrowserFromChildren(aTabs[0]);

		if (
			max > 1 &&
			!b.warnAboutClosingTabs(false)
			)
			return;

		for (var i = max-1; i > -1; i--)
		{
			b.reloadTab(aTabs[i]);
		}
	},
 
	splitWindowFrom : function(aTabs) 
	{
		if (!aTabs) return;

		var max = aTabs.length;
		if (!max) return;


		// Step 1: get window state

		var b = this.getTabBrowserFromChildren(aTabs[0]);
		var SS = this.SessionStore;

		for (var i = max-1; i > -1; i--)
		{
			SS.setTabValue(aTabs[i], 'multipletab-selected', 'true');
		}

		var state = SS.getWindowState(window);
		eval('state = '+state);
		delete state.windows[0]._closedTabs;
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
							SS.setTabValue(tabs[i], 'multipletab-selected', false);
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
	get SessionStore() { 
		if (!this._SessionStore) {
			this._SessionStore = Components.classes['@mozilla.org/browser/sessionstore;1'].getService(Components.interfaces.nsISessionStore);
		}
		return this._SessionStore;
	},
	_SessionStore : null,
 	
	clearSelection : function() 
	{
		this.clearSelectionSub(this.getSelectedTabs(), 'multipletab-selected');
		this.clearSelectionSub(this.getReadyToCloseTabs(), 'multipletab-ready-to-close');
	},
	clearSelectionSub : function(aTabs, aAttr)
	{
		if (!aTabs || !aTabs.length) return;

		for (var i = aTabs.length-1; i > -1; i--)
		{
			aTabs[i].removeAttribute(aAttr);
			this.SessionStore.deleteTabValue(aTabs[i], aAttr);
		}
	},
  
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
 
