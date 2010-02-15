MultipleTabService.overrideExtensionsOnPreInit = function MTS_overrideExtensionsOnPreInit() {

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

	// Menu Editor
	if ('MenuEdit' in window &&
		'getEditableMenus' in MenuEdit) {
		eval('MenuEdit.getEditableMenus = '+
			MenuEdit.getEditableMenus.toSource().replace(
				/return menus;/g,
				'menus["multipletab-selection-menu"] = MultipleTabService.tabSelectionPopup.getAttribute("label"); $&'
			)
		);
	}

};

MultipleTabService.overrideExtensionsOnInit = function MTS_overrideExtensionsOnInit() {

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

	// Print All Tabs
	if ('PrintAllTabs' in window) {
		eval('PrintAllTabs.onMenuItemCommand = '+
			PrintAllTabs.onMenuItemCommand.toSource().replace(
				'this.getTabsToPrint(printAll)',
				'this.__multipletab__printNodes || $&'
			)
		);
	}

	// Tab Mix Plus
	var TMPWarnPref = 'extensions.multipletab.compatibility.TMP.warnForClickActions';
	if (
		'TM_checkClick' in window &&
		this.getPref(TMPWarnPref) &&
		(
			(
				this.getPref('extensions.tabmix.ctrlClickTab') != 0 &&
				this.getPref('extensions.multipletab.tabclick.accel.mode') != 0
			) ||
			(
				this.getPref('extensions.tabmix.shiftClickTab') != 0 &&
				this.getPref('extensions.multipletab.tabclick.shift.mode') != 0
			)
		)
		) {
		let checked = { value : false };
		switch (this.PromptService.confirmEx(
				null,
				this.bundle.getString('compatibility_TMP_warning_title'),
				this.bundle.getString(/mac/i.test(navigator.platform) ? 'compatibility_TMP_warning_text_mac' : 'compatibility_TMP_warning_text' ) + '\n'+
					this.bundle.getString('compatibility_TMP_warning_text_note'),
				(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_0) +
				(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_1) +
				(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_2),
				this.bundle.getString('compatibility_TMP_warning_use_multipletab'),
				this.bundle.getString('compatibility_TMP_warning_use_TMP'),
				this.bundle.getString('compatibility_TMP_warning_keep'),
				this.bundle.getString('compatibility_TMP_warning_never'),
				checked
			))
		{
			case 0:
				this.setPref('extensions.tabmix.ctrlClickTab', 0);
				this.setPref('extensions.tabmix.shiftClickTab', 0);
				break;
			case 1:
				this.setPref('extensions.multipletab.tabclick.accel.mode', 0);
				this.setPref('extensions.multipletab.tabclick.shift.mode', 0);
				break;
		}
		if (checked.value)
			this.setPref(TMPWarnPref, false);
	}

	// BarTap
	// https://addons.mozilla.org/firefox/addon/67651
	if ('BarTap' in window &&
		'writeBarTap' in BarTap) {
		eval('BarTap.writeBarTap = '+
			BarTap.writeBarTap.toSource().replace(
				'bartap = JSON.stringify',
				'MultipleTabService.backupArgumentURI(aURI, aBrowser); $&'
			)
		);
	}

};

MultipleTabService.overrideExtensionsOnDelayedInit = function MTS_overrideExtensionsOnDelayedInit() {
};
