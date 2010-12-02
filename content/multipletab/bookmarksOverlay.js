var MultipleTabBookmarkService = { 
	
	init : function MTBS_init() 
	{
		if ('PlacesControllerDragHelper' in window &&
			'onDrop' in PlacesControllerDragHelper) {
			eval('PlacesControllerDragHelper.onDrop = '+
				PlacesControllerDragHelper.onDrop.toSource().replace(
					// for Firefox 3.5 or later
					'var doCopy =',
					'var multipleTabsProxy = dt = new MultipleTabDOMDataTransferProxy(dt, insertionPoint); $&'
				).replace( // for Tree Style Tab (save tree structure to bookmarks)
					'PlacesUIUtils.ptm.doTransaction(txn);',
					<![CDATA[
						if ('_tabs' in multipleTabsProxy &&
							'TreeStyleTabBookmarksService' in window)
							TreeStyleTabBookmarksService.beginAddBookmarksFromTabs(multipleTabsProxy._tabs);
						$&
						if ('_tabs' in multipleTabsProxy &&
							'TreeStyleTabBookmarksService' in window)
							TreeStyleTabBookmarksService.endAddBookmarksFromTabs();
					]]>
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
	}
 
}; 

window.addEventListener('load', MultipleTabBookmarkService, false);
  
// for Firefox 3.5 or later
function MultipleTabDOMDataTransferProxy(aDataTransfer, aInsertionPoint) 
{
	// Don't proxy it because it is not a drag of tabs.
	if (!aDataTransfer.mozTypesAt(0).contains(TAB_DROP_TYPE))
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
				return window['piro.sakura.ne.jp'].tabsDragUtils.getCurrentURIOfTab(tab) ||
						'about:blank' ;
		}

		return this._apply('mozGetDataAt', [aFormat, 0]);
	},

	get mozUserCancelled() { return this._source.mozUserCancelled; }
 
}; 
  
