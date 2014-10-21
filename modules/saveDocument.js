var EXPORTED_SYMBOLS = ['saveDocument', 'saveDocumentIntoDirectory'];

var Ci = Components.interfaces;
var Cc = Components.classes;

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

XPCOMUtils.defineLazyModuleGetter(this, 'MultipleTabHandlerConstants', 'resource://multipletab-modules/constants.js');
XPCOMUtils.defineLazyModuleGetter(this, 'setTimeout', 'resource://gre/modules/Timer.jsm');

XPCOMUtils.defineLazyGetter(this, 'ContentAreaUtils', function() {
	var loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
					.getService(Ci.mozIJSSubScriptLoader);
	var namespace = {};
	loader.loadSubScript('chrome://global/content/contentAreaUtils.js', namespace);
	return namespace;
});

function saveDocumentIntoDirectory(aDocument, aDestDir, aParams) {
	aDestDir = ensureLocalFile(aDestDir);
	var uri = ContentAreaUtils.makeURI(aDocument.defaultView.location.href, null, null);
	var saveType = aParams.saveType;
	var delay = aParams.delay || 200;

	var shouldConvertToText = shouldConvertDocumentToText(aDocument, saveType);
	var fileInfo = new ContentAreaUtils.FileInfo(aParams.name);
	ContentAreaUtils.initFileInfo(
		fileInfo,
		uri.spec,
		aDocument.characterSet,
		aDocument,
		(shouldConvertToText ? 'text/plain' : aDocument.contentType ),
		null
	);
	var base = fileInfo.fileName;
	var extension = shouldConvertToText ? '.txt' : '.'+fileInfo.fileExt ;
	if (base.indexOf(extension) == base.length - extension.length) {
		base = base.substring(0, base.length - extension.length);
	}
	var destFile = aDestDir.clone();
	destFile.append(base + extension);
	destFile.createUnique();

	if (saveType & MultipleTabHandlerConstants.kSAVE_TYPE_TEXT && !shouldConvertToText)
		saveType = MultipleTabHandlerConstants.kSAVE_TYPE_COMPLETE;

	setTimeout(function() {
		destFile.remove(true);
		try {
			documentSave(aDocument, {
				referrerURI : aParams.referrerURI,
				destFile    : destFile,
				saveType    : saveType
			});
		}
		catch(e) {
			Components.utils.reportError(e);
		}
	}, delay);
}

function saveDocument(aDocument, aParams) {
	var uri = ContentAreaUtils.makeURI(aDocument.defaultView.location.href, null, null);
	var saveType = aParams.saveType;

	if (saveType & MultipleTabHandlerConstants.kSAVE_TYPE_TEXT &&
		!shouldConvertDocumentToText(aDocument, saveType))
		saveType = MultipleTabHandlerConstants.kSAVE_TYPE_COMPLETE;

	var autoChosen = null;
	if (aParams.destFile) {
		let destFile = ensureLocalFile(aParams.destFile);
		autoChosen = new ContentAreaUtils.AutoChosen(destFile, uri);
		if (autoChosen && saveType == MultipleTabHandlerConstants.kSAVE_TYPE_TEXT)
			autoChosen.saveAsType = ContentAreaUtils.kSaveAsType_Text;
	}

	ContentAreaUtils.internalSave(
		uri.spec,
		(saveType != MultipleTabHandlerConstants.kSAVE_TYPE_FILE ? aDocument : null ),
		null, // default file name
		null, // content disposition
		aDocument.contentType,
		false, // should bypass cache?
		null, // title of picker
		autoChosen,
		ensureURI(aParams.referrerURI), // referrer
		aDocument, // initiating document
		true, // skip prompt?
		null // cache key
	);
}

function ensureURI(aURIOrSpec) {
	if (!aURIOrSpec)
		return null;

	if (typeof aURIOrSpec != 'string')
		return aURIOrSpec;

	return ContentAreaUtils.makeURI(aURIOrSpec, null, null);
}

function ensureLocalFile(aFileOrPath) {
	if (typeof aFileOrPath != 'string')
		return aFileOrPath;

	let file = Cc['@mozilla.org/file/local;1']
	                .createInstance(Ci.nsILocalFile);
	file.initWithPath(aFileOrPath);
	return file;
}

function shouldConvertDocumentToText(aDocument, aSaveType) {
	return (
		aSaveType == MultipleTabHandlerConstants.kSAVE_TYPE_TEXT &&
		ContentAreaUtils.GetSaveModeForContentType(aDocument, aDocument) & ContentAreaUtils.SAVEMODE_COMPLETE_TEXT
	);
}
