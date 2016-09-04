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
	var { documentToCopyText } = Components.utils.import('resource://multipletab-modules/documentToCopyText.js', {});

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

			case MultipleTabHandlerConstants.COMMAND_REQUEST_COPY_TEXT:
				var id = aMessage.json.params.id;
				try {
					var text = documentToCopyText(content.document, {
						format   : aMessage.json.params.format,
						now      : new Date(aMessage.json.params.now),
						uri      : aMessage.json.params.uri,
						title    : aMessage.json.params.title,
						lineFeed : aMessage.json.params.lineFeed
					});
					global.sendAsyncMessage(MultipleTabHandlerConstants.MESSAGE_TYPE, {
						command : MultipleTabHandlerConstants.COMMAND_REPORT_COPY_TEXT,
						id      : id,
						text    : text
					});
				}
				catch(e) {
					global.sendAsyncMessage(MultipleTabHandlerConstants.MESSAGE_TYPE, {
						command : MultipleTabHandlerConstants.COMMAND_REPORT_COPY_TEXT,
						id      : id,
						text    : ''
					});
				}
				return;
		}
	};
	global.addMessageListener(MultipleTabHandlerConstants.MESSAGE_TYPE, messageListener);
})(this);
