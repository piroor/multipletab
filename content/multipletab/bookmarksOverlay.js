MultipleTabBookmarkService = { 
	
	init : function MTBS_init() 
	{
		if ('PlacesControllerDragHelper' in window &&
			'onDrop' in PlacesControllerDragHelper) {
			eval('PlacesControllerDragHelper.onDrop = '+
				PlacesControllerDragHelper.onDrop.toSource().replace(
					// for Firefox 3.0
					'var session = this.getSession();',
					'$& session = new MultipleTabDragSessionProxy(session, insertionPoint);'
				).replace(
					// for Firefox 3.5 or later
					'var dt = this.currentDataTransfer;',
					'$& dt = new MultipleTabDOMDataTransferProxy(dt, insertionPoint);'
				)
			);
		}
	},
 
	willBeInsertedBeforeExistingNode : function MTBS_willBeInsertedBeforeExistingNode(aInsertionPoint) 
	{
		// drop on folder in the bookmarks menu
		if (aInsertionPoint.dropNearItemId === void(0))
			return false;

		// drop on folder in the places organizer
		if (aInsertionPoint._index < 0 && aInsertionPoint.dropNearItemId < 0)
			return false;

		return true;
	},
 
	handleEvent : function MTBS_handleEvent(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'load':
				window.removeEventListener('load', this, false);
				this.init();
				break;
		}
	},
 
}; 

window.addEventListener('load', MultipleTabBookmarkService, false);
  
// for Firefox 3.0
function MultipleTabDragSessionProxy(aSession, aInsertionPoint) 
{
	// Don't proxy it because it is not a drag of tabs.
	if (aSession.numDropItems != 1 ||
		!aSession.sourceNode)
		return aSession;

	var tab = MultipleTabService.getTabFromChild(aSession.sourceNode);
	if (!tab)
		return aSession;

	var tabs = MultipleTabService.getBundledTabsOf(tab);

	// Don't proxy it because there is no selection.
	if (tabs.length < 2)
		return aSession;

	this._source = aSession;
	this._tabs = tabs;

	if (MultipleTabBookmarkService.willBeInsertedBeforeExistingNode(aInsertionPoint))
		this._tabs.reverse();
}

MultipleTabDragSessionProxy.prototype = {
	
	_apply : function MTDSProxy__apply(aMethod, aArguments) 
	{
		return this._source[aMethod].apply(this._source, aArguments);
	},
 
	_setDataToTransferable : function MTDSProxy__setDataToTransferable(aTransferable, aType, aData) 
	{
		try {
			var string = Components.classes['@mozilla.org/supports-string;1']
							.createInstance(Components.interfaces.nsISupportsString);
			string.data = aData;
			aTransferable.setTransferData(aType, string, aData.length * 2);
		}
		catch(e) {
		}
	},
 
	// nsIDragSession 
	get canDrop() { return this._source.canDrop; },
	set canDrop(aValue) { return this._source.canDrop = aValue; },
	get onlyChromeDrop() { return this._source.onlyChromeDrop; },
	set onlyChromeDrop(aValue) { return this._source.onlyChromeDrop = aValue; },
	get dragAction() { return this._source.dragAction; },
	set dragAction(aValue) { return this._source.dragAction = aValue; },

	get numDropItems()
	{
		return this._tabs.length;
	},

	get sourceDocument() { return this._source.sourceDocument; },
	get sourceNode() { return this._source.sourceNode; },
	get dataTransfer() { return this._source.dataTransfer; },

	getData : function MTDSProxy_getData(aTransferable, aIndex)
	{
		var tab = this._tabs[aIndex];
		var uri = tab.linkedBrowser.currentURI;
		if (uri) {
			this._setDataToTransferable(aTransferable, 'text/x-moz-url', uri.spec+'\n'+tab.label);
			this._setDataToTransferable(aTransferable, 'text/unicode', uri.spec);
			this._setDataToTransferable(aTransferable, 'text/html', '<a href="'+uri.spec+'">'+tab.label+'</a>');
		}
		else {
			this._setDataToTransferable(aTransferable, 'text/unicode', 'about:blank');
		}
	},

	isDataFlavorSupported : function MTDSProxy_isDataFlavorSupported()
	{
		return this._apply('isDataFlavorSupported', arguments);
	}
 
}; 
  
// for Firefox 3.5 or later
function MultipleTabDOMDataTransferProxy(aDataTransfer, aInsertionPoint) 
{
	// Don't proxy it because it is not a drag of tabs.
	if (aDataTransfer.mozItemCount != 1 ||
		Array.slice(aDataTransfer.mozTypesAt(0)).indexOf(TAB_DROP_TYPE) < 0)
		return aDataTransfer;

	var tab = aDataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
	var tabs = MultipleTabService.getBundledTabsOf(tab);

	// Don't proxy it because there is no selection.
	if (tabs.length < 2)
		return aDataTransfer;

	this._source = aDataTransfer;
	this._tabs = tabs;

	if (MultipleTabBookmarkService.willBeInsertedBeforeExistingNode(aInsertionPoint))
		this._tabs.reverse();
}

MultipleTabDOMDataTransferProxy.prototype = {
	
	_apply : function MTDOMDTProxy__apply(aMethod, aArguments) 
	{
		return this._source[aMethod].apply(this._source, aArguments);
	},
 
	// nsIDOMDataTransfer 
	get dropEffect() { return this._source.dropEffect; },
	set dropEffect(aValue) { return this._source.dropEffect = aValue; },
	get effectAllowed() { return this._source.effectAllowed; },
	set effectAllowed(aValue) { return this._source.effectAllowed = aValue; },
	get files() { return this._source.files; },
	get types() { return this._source.types; },
	clearData : function MTDOMDTProxy_clearData() { return this._apply('clearData', arguments); },
	setData : function MTDOMDTProxy_setData() { return this._apply('setData', arguments); },
	getData : function MTDOMDTProxy_getData() { return this._apply('getData', arguments); },
	setDragImage : function MTDOMDTProxy_setDragImage() { return this._apply('setDragImage', arguments); },
	addElement : function MTDOMDTProxy_addElement() { return this._apply('addElement', arguments); },
 
	// nsIDOMNSDataTransfer 
	get mozItemCount()
	{
		return this._tabs.length;
	},

	get mozCursor() { return this._source.mozCursor; },
	set mozCursor(aValue) { return this._source.mozCursor = aValue; },

	mozTypesAt : function MTDOMDTProxy_mozTypesAt()
	{
		return this._apply('mozTypesAt', [0]);
	},

	mozClearDataAt : function MTDOMDTProxy_mozClearDataAt()
	{
		this._tabs = [];
		return this._apply('mozClearDataAt', [0]);
	},

	mozSetDataAt : function MTDOMDTProxy_mozSetDataAt(aFormat, aData, aIndex)
	{
		this._tabs = [];
		return this._apply('mozSetDataAt', [aFormat, aData, 0]);
	},

	mozGetDataAt : function MTDOMDTProxy_mozGetDataAt(aFormat, aIndex)
	{
		var tab = this._tabs[aIndex];
		switch (aFormat)
		{
			case TAB_DROP_TYPE:
				return tab;

			case 'text/x-moz-text-internal':
				var uri = tab.linkedBrowser.currentURI;
				return uri ? uri.spec : 'about:blank' ;
		}

		return this._apply('mozGetDataAt', [aFormat, 0]);
	},

	get mozUserCancelled() { return this._source.mozUserCancelled; }
 
}; 
  
