/*
 ArrowScrollBox Scroll Helper Library

 Usage:
   XUL:
     <arrowscrollbox id="scrollbox" orient="vertical">
       <vbox>
         <checkbox/>
         <checkbox/>
         <checkbox/>
         <checkbox/>
       </vbox>
     </arrowscrollbox>

  JavaScript:
     var box = document.getElementById('scrollbox');
     var base = box.getElementsByTagName('checkbox')[0];
     new window['piro.sakura.ne.jp'].arrowScrollBoxScrollHelper(box, base);
     // 1st argument: DOMNode or ID of an element
     // 2nd argument: DOMNode, ID of an element, or local name of a child element

 license: The MIT License, Copyright (c) 2009 YUKI "Piro" Hiroshi
   http://github.com/piroor/fxaddonlibs/blob/master/license.txt
 original:
   http://github.com/piroor/fxaddonlibs/blob/master/arrowScrollBoxScrollHelper.js
*/
(function() {
	const currentRevision = 1;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'arrowScrollBoxScrollHelper' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].arrowScrollBoxScrollHelper.prototype.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	var Cc = Components.classes;
	var Ci = Components.interfaces;

	window['piro.sakura.ne.jp'].arrowScrollBoxScrollHelper = function(aArrowScrollBox, aBase)
	{
		this._initArrowScrollBox(aArrowScrollBox);
		this._initBase(aBase);

		this._box.addEventListener('DOMMouseScroll', this, true);
		window.addEventListener('unload', this, false);
	};
	window['piro.sakura.ne.jp'].arrowScrollBoxScrollHelper.prototype = {

		revision : currentRevision,

		kBASE_PIXELS : 10,

		_initArrowScrollBox : function(aArrowScrollBox)
		{
			this._box = aArrowScrollBox;
			if (typeof this._box == 'string')
				this._box = document.getElementById(this._box);

			if (
				!this._box ||
				!(this._box instanceof Ci.nsIDOMElement) ||
				this._box.localName != 'arrowscrollbox'
				)
				throw new Error('arrowscrollbox is required!');
		},

		_initBase : function(aBase)
		{
			this._base = aBase;
			if (typeof this._base == 'string') {
				var num = Number(this._base);
				if (!isNaN(num)) {
					this._base = num;
				}
				else {
					var node = document.getElementById(this._base);
					if (node) {
						this._base = node;
					}
					else {
						node = this._box.getElementsByTagName(this._base);
						if (node && node.length) {
							this._base = node[0];
						}
						else {
							this._base = null;
						}
					}
				}
			}
		},

		handleEvent : function(aEvent)
		{
			switch (aEvent.type)
			{
				case 'unload':
					this._box.removeEventListener('DOMMouseScroll', this, true);
					window.removeEventListener('unload', this, false);
					delete this._base;
					delete this._box;
					return;

				case 'DOMMouseScroll':
					this._onScroll(aEvent);
					break;
			}
		},

		_onScroll : function(aEvent)
		{
			if ('axis' in aEvent &&
				aEvent.axis == aEvent.HORIZONTAL_AXIS &&
				this._box.orient == 'vertical')
				return;

			var baseBox, base;
			if (this._base) {
				if (typeof this._base == 'number')
					base = this._base;
				else if (this._base instanceof Ci.nsIBoxObject)
					baseBox = this._base;
				else if (this._base instanceof Ci.nsIDOMElement)
					baseBox = this._base.boxObject;

				if (baseBox)
					base = baseBox[this._box.orient == 'vertical' ? 'height' : 'width' ];
			}
			if (!base) base = this.kBASE_PIXELS;

			this._box.scrollByPixels(base * aEvent.detail);
			aEvent.stopPropagation();
		}
	};
})();
