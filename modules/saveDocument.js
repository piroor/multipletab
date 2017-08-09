var EXPORTED_SYMBOLS = ['saveBrowserAs', 'saveDocumentAs', 'saveBrowserInto', 'saveDocumentInto'];

var Ci = Components.interfaces;
var Cc = Components.classes;

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://multipletab-modules/updateInternalSave.js');

XPCOMUtils.defineLazyModuleGetter(this, 'MultipleTabHandlerConstants', 'resource://multipletab-modules/constants.js');
XPCOMUtils.defineLazyModuleGetter(this, 'setTimeout', 'resource://gre/modules/Timer.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');

XPCOMUtils.defineLazyGetter(this, 'CAUtils', function() {
	var loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
					.getService(Ci.mozIJSSubScriptLoader);
	var httpProtocolhandler = Services.io.getProtocolHandler('http')
								.QueryInterface(Ci.nsIHttpProtocolHandler);
	var appVersion = httpProtocolhandler.appVersion + ' (' + httpProtocolhandler.platform + ')';
	var namespace = {
		window    : null,
		navigator : {
			appVersion : appVersion
		}
	};
	loader.loadSubScript('chrome://global/content/contentAreaUtils.js', namespace);
	updateInternalSave(namespace);
	return namespace;
});

function saveBrowserAndDo(aCallback, aBrowser, aOuterWindowID = 0) {
	var persistable = aBrowser.QueryInterface(Ci.nsIFrameLoaderOwner)
						.frameLoader
						.QueryInterface(Ci.nsIWebBrowserPersistable);
	var stack = Components.stack.caller;
	persistable.startPersistence(aOuterWindowID, {
		onDocumentReady : function(aDocument) {
			aCallback(aDocument);
		},
		onError : function(aStatus) {
			throw new Components.Exception(
				'saveBrowserAndDo failed asynchronously in startPersistence',
				aStatus,
				stack
			);
		}
	});
}

function saveBrowserInto(aBrowser, aDestDir, aParams) {
	saveBrowserAndDo(function(aDocument) {
		aParams = aParams || {};
		aParams.uri = aBrowser.currentURI.spec;
		saveDocumentInto(aDocument, aDestDir, aParams);
	}, aBrowser);
}

function saveDocumentInto(aDocument, aDestDir, aParams) {
	aDestDir = ensureLocalFile(aDestDir);
	var uri = CAUtils.makeURI(aParams.uri || aDocument.defaultView.location.href, null, null);
	var saveType = aParams.saveType;
	var delay = aParams.delay || 200;

	var shouldConvertToText = shouldConvertDocumentToText(aDocument, saveType);
	var fileInfo = new CAUtils.FileInfo(aParams.name);
	CAUtils.initFileInfo(
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
	// use CAUtils.uniqueFile instead of desfFile.createUnique()
	// because it sggests more human readable file name.
	destFile = CAUtils.uniqueFile(destFile);
//	destFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0644);

	if (saveType & MultipleTabHandlerConstants.kSAVE_TYPE_TEXT && !shouldConvertToText)
		saveType = MultipleTabHandlerConstants.kSAVE_TYPE_COMPLETE;

	setTimeout(function() {
//		destFile.remove(true);
		try {
			saveDocumentAs(aDocument, destFile, {
				uri         : uri.spec,
				referrerURI : aParams.referrerURI,
				saveType    : saveType
			});
		}
		catch(e) {
			Components.utils.reportError(e);
		}
	}, delay);
}

function saveBrowserAs(aBrowser, aDestDir, aParams) {
	saveBrowserAndDo(function(aDocument) {
		aParams = aParams || {};
		aParams.uri = aBrowser.currentURI.spec;
		saveDocumentAs(aDocument, aDestDir, aParams);
	}, aBrowser);
}

function saveDocumentAs(aDocument, aDestFile, aParams) {
	var uri = CAUtils.makeURI(aParams.uri || aDocument.defaultView.location.href, null, null);
	var saveType = aParams.saveType;

	if (saveType & MultipleTabHandlerConstants.kSAVE_TYPE_TEXT &&
		!shouldConvertDocumentToText(aDocument, saveType))
		saveType = MultipleTabHandlerConstants.kSAVE_TYPE_COMPLETE;

	var autoChosen = null;
	if (aDestFile) {
		aDestFile = ensureLocalFile(aDestFile);
		autoChosen = new CAUtils.AutoChosen(aDestFile, uri);
		if (autoChosen && saveType == MultipleTabHandlerConstants.kSAVE_TYPE_TEXT)
			autoChosen.saveAsType = CAUtils.kSaveAsType_Text;
	}

	CAUtils.internalSave(
		uri.spec,
		(saveType != MultipleTabHandlerConstants.kSAVE_TYPE_FILE ? aDocument : null ),
		aDestFile.leafName, // default file name
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

	return CAUtils.makeURI(aURIOrSpec, null, null);
}

function ensureLocalFile(aFileOrPath) {
	if (typeof aFileOrPath != 'string')
		return aFileOrPath;

	let file = Cc['@mozilla.org/file/local;1']
	                .createInstance(Ci.nsIFile);
	file.initWithPath(aFileOrPath);
	return file;
}

function shouldConvertDocumentToText(aDocument, aSaveType) {
	return (
		aSaveType == MultipleTabHandlerConstants.kSAVE_TYPE_TEXT &&
		CAUtils.GetSaveModeForContentType(aDocument, aDocument) & CAUtils.SAVEMODE_COMPLETE_TEXT
	);
}