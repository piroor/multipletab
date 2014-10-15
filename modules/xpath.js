var EXPORTED_SYMBOLS = ['evaluateXPath', 'getArrayFromXPathResult'];

var Ci = Components.interfaces;

var NSResolver = { 
	lookupNamespaceURI : function lookupNamespaceURI(aPrefix)
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
};

function evaluateXPath(aExpression, aContext, aType) {
	if (!aType) aType = Ci.nsIDOMXPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
	try {
		var doc = aContext.ownerDocument || aContext.document || aContext;
		var xpathResult = doc.evaluate(
				aExpression,
				aContext || document,
				NSResolver,
				aType,
				null
			);
	}
	catch(e) {
		return {
			singleNodeValue : null,
			snapshotLength  : 0,
			snapshotItem    : function snapshotItem() {
				return null
			}
		};
	}
	return xpathResult;
}

function getArrayFromXPathResult(aXPathResult, ...aExtraArgs) {
	if (typeof aXPathResult == 'string') {
		let allArgs = [aXPathResult].concat(aExtraArgs);
		aXPathResult = evaluateXPath.apply(this, allArgs);
	}
	var max = aXPathResult.snapshotLength;
	var array = new Array(max);
	if (!max) return array;

	for (var i = 0; i < max; i++)
	{
		array[i] = aXPathResult.snapshotItem(i);
	}

	return array;
}
