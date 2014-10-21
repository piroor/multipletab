(function(global) {
	var DEBUG = false;
	function mydump(aMessage) {
		if (DEBUG)
			dump('multipletab content utils: '+aMessage +'\n');
	}
	mydump('CONTENT SCRIPT LOADED');

	var Cc = Components.classes;
	var Ci = Components.interfaces;
	var Cu = Components.utils;
	var Cr = Components.results;

	var { MultipleTabHandlerConstants } = Cu.import('resource://multipletab-modules/constants.js', {});
	var { saveDocumentAs, saveDocumentInto } = Components.utils.import('resource://multipletab-modules/saveDocument.js', {});

	function free() {
		cleanup =
			Cc = Ci = Cu = Cr =
			MultipleTabHandlerConstants =
			messageListener =
			mydump =
				undefined;
	}

	var messageListener = function(aMessage) {
		mydump('CONTENT MESSAGE LISTENED');
		mydump(JSON.stringify(aMessage.json));
		switch (aMessage.json.command)
		{
			case MultipleTabHandlerConstants.COMMAND_SHUTDOWN:
				global.removeMessageListener(MultipleTabHandlerConstants.MESSAGE_TYPE, messageListener);
				free();
				return;

			case MultipleTabHandlerConstants.COMMAND_REQUEST_MAKE_BLANK:
				if (content.location)
					content.location.replace('about:blank');
				return;

			case MultipleTabHandlerConstants.COMMAND_REQUEST_SAVE_DOCUMENT_AS_FILE:
				saveDocumentAs(content.document, null, {
					referrerURI : aMessage.json.params.referrerURI,
					saveType    : aMessage.json.params.saveType
				});
				return;

			case MultipleTabHandlerConstants.COMMAND_REQUEST_SAVE_DOCUMENT_INTO_DIRECTORY:
				saveDocumentInto(content.document, aMessage.json.params.folder, {
					name        : aMessage.json.params.name,
					referrerURI : aMessage.json.params.referrerURI,
					saveType    : aMessage.json.params.saveType,
					delay       : aMessage.json.params.delay
				});
				return;
		}
	};
	global.addMessageListener(MultipleTabHandlerConstants.MESSAGE_TYPE, messageListener);
})(this);
