MultipleTabService.overrideExtensionsOnPreInit = function() {

	// Tab Groups
	if ('TG_Tab_SSTabRestoring_Event' in window) {
		eval('window.TG_Tab_SSTabRestoring_Event = '+
			window.TG_Tab_SSTabRestoring_Event.toSource().replace(
				'{',
				<><![CDATA[$&
					if (MultipleTabService.duplicatingTabs) return;
				]]></>
			)
		);
		this.registerDuplicatedTabPostProcess(function(aTab, aIndex) {
			var groups = document.getElementById('TG-GroupList');
			TG_Add_To_Group(aTab, groups.selectedItem);
			gBrowser.moveTabTo(aTab, aIndex);
		});
	}

};

MultipleTabService.overrideExtensionsOnInit = function() {

	// Tab Groups
	if ('TG_Group_DnD_Observer' in window) {
		eval('TG_Group_DnD_Observer.onDrop = '+
			TG_Group_DnD_Observer.onDrop.toSource().replace(
				/(TG_Move_To_Group\([^\)]+\))/,
				<><![CDATA[
					var info = {};
					var tabs = MultipleTabService.getBundledTabsOf(tab, info);
					if (tabs.length) {
						tabs.forEach(function(tab) {
							$1;
						});
						return;
					}
				]]></>
			)
		);
		this.registerClearTabValueKey('tg_gname');
		this.registerClearTabValueKey('tg_gid');
		this.registerClearTabValueKey('tg_gselected');
		this.registerClearTabValueKey('tg_tselected');
	}

	// Linkwad
	if (document.getElementById('linkwad_toolbar')) {
		if ('sessionObserver' in window)
			eval('sessionObserver.onDrop = '+
				sessionObserver.onDrop.toSource().replace(
					'{',
					<><![CDATA[$&
						var info = {};
						var tabs = MultipleTabService.getBundledTabsOf(arguments[2].sourceNode, info);
						if (tabs.length) {
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
