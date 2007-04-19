var MultipleTabService = { 
	PREFROOT : 'extensions.multipletab@piro.sakura.ne.jp',

	tabDragMode : -1,
	TAB_DRAG_MODE_DEFAULT : 0,
	TAB_DRAG_MODE_SELECT  : 1,
	TAB_DRAG_MODE_SWITCH  : 2,

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
 
	getSelectedTabs : function() 
	{
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:tab[@multipletab-selected = "true"]',
					gBrowser.mTabContainer,
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
 
	getReadyToCloseTabs : function() 
	{
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:tab[@multipletab-ready-to-close = "true"]',
					gBrowser.mTabContainer,
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
		}
		catch(e) {
			return { snapshotLength : 0 };
		}
		return xpathResult;
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
		}
		catch(e) {
			return { snapshotLength : 0 };
		}
		return xpathResult;
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
		window.addEventListener('mouseup', this, true);

		window.removeEventListener('load', this, false);

		this.addPrefListener(this);
		this.observe(null, 'nsPref:changed', 'extensions.multipletab.tabdrag.mode');

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
			if (this.getSelectedTabs().snapshotLength) {
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
					if (tab.getAttribute('multipletab-selected') == 'true') {
						tab.removeAttribute('multipletab-selected');
					}
					else {
						tab.setAttribute('multipletab-selected', true);
					}
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
		for (var i = 0, maxi = nodes.length; i < maxi; i++)
		{
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

		var max = aTabs.snapshotLength;
		if (!max) return;

		var b = this.getTabBrowserFromChildren(aTabs.snapshotItem(0));

		if (
			max > 1 &&
			!b.warnAboutClosingTabs(true, max)
			)
			return;

		for (var i = max-1; i > -1; i--)
		{
			b.removeTab(aTabs.snapshotItem(i));
		}
	},
 
	reloadTabs : function(aTabs) 
	{
		if (!aTabs) return;

		var max = aTabs.snapshotLength;
		if (!max) return;

		var b = this.getTabBrowserFromChildren(aTabs.snapshotItem(0));

		if (
			max > 1 &&
			!b.warnAboutClosingTabs(false)
			)
			return;

		for (var i = max-1; i > -1; i--)
		{
			b.reloadTab(aTabs.snapshotItem(i));
		}
	},
 
	clearSelection : function() 
	{
		this.clearSelectionSub(this.getSelectedTabs(), 'multipletab-selected');
		this.clearSelectionSub(this.getReadyToCloseTabs(), 'multipletab-ready-to-close');
	},
	clearSelectionSub : function(aTabs, aAttr)
	{
		if (!aTabs || !aTabs.snapshotLength) return;

		for (var i = aTabs.snapshotLength-1; i > -1; i--)
		{
			aTabs.snapshotItem(i).removeAttribute(aAttr);
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
 
