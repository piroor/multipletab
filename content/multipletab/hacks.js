MultipleTabService.overrideExtensionsOnInit = function() {

	// Linkwad
	if (document.getElementById('linkwad_toolbar')) {
		if ('sessionObserver' in window)
			eval('sessionObserver.onDrop = '+
				sessionObserver.onDrop.toSource().replace(
					'{',
					<><![CDATA[$&
						var tab = arguments[2].sourceNode;
						var sourceWindow, sourceBrowser;
						if (tab &&
							tab.localName == 'tab' &&
							(sourceWindow = tab.ownerDocument.defaultView) &&
							'MultipleTabService' in sourceWindow &&
							(sourceBrowser = sourceWindow.MultipleTabService.getTabBrowserFromChild(tab)) &&
							sourceWindow.MultipleTabService.isSelected(tab)) {
							var tabs = sourceWindow.MultipleTabService.getSelectedTabs(sourceBrowser);
							var wadid = arguments[0].target.getAttribute('wad_id');
							tabs.forEach(function(aTab) {
								addURLtoSession(aTab.linkedBrowser.currentURI.spec, wadid);
							});
							return;
						}
					]]></>
				)
			);
	}

};

MultipleTabService.overrideExtensionsOnDelayedInit = function() {

	if ('SessionFix' in window) {
		eval('gBrowser.warnAboutClosingTabs = '+
			gBrowser.warnAboutClosingTabs.toSource().replace(
				'{',
				'{ var sessionKey = document.getElementById("sessionfix-bundle").getString("sessionKey"); '
			).replace(
				'var numTabs = ',
				'var numTabs = this.__multipletab__closedTabsNum || '
			).replace(
				'if (numWindows > 1)',
				'if (numWindows > 1 || this.__multipletab__closedTabsNum)'
			)
		);
	}

};
