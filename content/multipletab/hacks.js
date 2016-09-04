MultipleTabService.overrideExtensionsOnPreInit = function MTS_overrideExtensionsOnPreInit() {

	// Tab Groups
	if ('TG_Tab_SSTabRestoring_Event' in window) {
		window.__multipletab__TG_Tab_SSTabRestoring_Event = window.TG_Tab_SSTabRestoring_Event;
		window.TG_Tab_SSTabRestoring_Event = function(...aArgs) {
			if (MultipleTabService.duplicatingTabs)
				return;
			return window.__multipletab__TG_Tab_SSTabRestoring_Event(...aArgs);
		};
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

	// DragNDrop Toolbars
	// https://addons.mozilla.org/firefox/addon/dragndrop-toolbars/
	if ('globDndtb' in window && globDndtb.setTheStuff) {
		let self = this;
		let reinitTabbar = function() {
				if (!self.initialized)
					return;
				self.destroyTabbar(gBrowser);
				window.setTimeout(function() {
					self.initTabbar(gBrowser);
				}, 100);
			};
		globDndtb.__multipletab__setOrder = globDndtb.setOrder;
		globDndtb.setOrder = function() {
			reinitTabbar();
			return this.__multipletab__setOrder.apply(this, arguments);
		};
		globDndtb.__multipletab__setTheStuff = globDndtb.setTheStuff;
		globDndtb.setTheStuff = function() {
			var result = this.__multipletab__setTheStuff.apply(this, arguments);
			if (this.dndObserver &&
				this.dndObserver.onDrop &&
				!this.dndObserver.__multipletab__onDrop) {
				this.dndObserver.__multipletab__onDrop = this.dndObserver.onDrop;
				this.dndObserver.onDrop = function(aEvent, aDropData, aSession) {
					var toolbar = document.getElementById(aDropData.data);
					if (toolbar.getElementsByAttribute('id', 'tabbrowser-tabs').length)
						reinitTabbar();
					return this.__multipletab__onDrop.apply(this, arguments);
				};
			}
			return result;
		};
	}

};

MultipleTabService.overrideExtensionsOnInit = function MTS_overrideExtensionsOnInit() {

	// Tab Groups
	if ('TG_Group_DnD_Observer' in window) {
		eval('TG_Group_DnD_Observer.onDrop = '+
			TG_Group_DnD_Observer.onDrop.toSource().replace(
				/(TG_Move_To_Group\([^\)]+\))/,
				'var info = {};' +
				'var tabs = MultipleTabService.getBundledTabsOf(tab, info);' +
				'if (tabs.length) {' +
				'  tabs.forEach(function(tab) {' +
				'    $1;' +
				'  });' +
				'  return;' +
				'}'
			)
		);
		this.registerClearTabValueKey('tg_gname');
		this.registerClearTabValueKey('tg_gid');
		this.registerClearTabValueKey('tg_gselected');
		this.registerClearTabValueKey('tg_tselected');
	}

	// Linkwad
	if (document.getElementById('linkwad_toolbar')) {
		if ('sessionObserver' in window) {
			sessionObserver.__multipletab__onDrop = sessionObserver.onDrop;
			sessionObserver.onDrop = function(..aArgs) {
				var info = {};
				var tabs = MultipleTabService.getBundledTabsOf(arguments[2].sourceNode, info);
				if (tabs.length) {
					var wadid = aArgs[0].target.getAttribute('wad_id');
					tabs.forEach(function(aTab) {
						addURLtoSession(aTab.linkedBrowser.currentURI.spec, wadid);
					});
					return;
				}
				return sessionObserver.onDrop(...aArgs);
			};
		}
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
	if (this.prefs.getPref(TMPWarnPref)) {
		let checked = { value : false };
		this.ensureWorkWithTMP(checked);
		if (checked.value)
			this.prefs.setPref(TMPWarnPref, false);
	}

	// Tab Utilities Fixed
	{
		let moveToWindow = document.getElementById('context_moveToWindow');
		if (moveToWindow) {
			let splitItem = document.getElementById('multipletab-selection-splitWindow');
			moveToWindow = moveToWindow.cloneNode(true);
			moveToWindow.id += '__multipletab__selection';
			moveToWindow.setAttribute('multipletab-available', 'MultipleTabService.prefs.getPref("extensions.tabutils.menu.context_moveToWindow")');
			splitItem.parentNode.insertBefore(moveToWindow, splitItem)
		}
	}
};

(function() {
	if (!('gBrowser' in window))
		return;

	const BACKUP = 'extensions.multipletab.compatibility.TMP.backup.';
	const CHOICE = 'extensions.multipletab.compatibility.TMP.choice';
	const TMPAccelClick = 'extensions.tabmix.ctrlClickTab';
	const TMPShiftClick = 'extensions.tabmix.shiftClickTab';
	const SelfAccelClick = 'extensions.multipletab.tabclick.accel.mode';
	const SelfShiftClick = 'extensions.multipletab.tabclick.shift.mode';

	MultipleTabService.ensureWorkWithTMP = function(aChecked) {
		if (
			(
				'TM_checkClick' in window || // old version TMP
				'TabmixTabbar' in window // newer TMP
			) &&
			(
				(
					this.prefs.getPref(TMPAccelClick) != 0 &&
					this.prefs.getPref(SelfAccelClick) != 0
				) ||
				(
					this.prefs.getPref(TMPShiftClick) != 0 &&
					this.prefs.getPref(SelfShiftClick) != 0
				)
			)
			) {
			switch (Services.prompt.confirmEx(
					null,
					this.bundle.getString('compatibility_TMP_warning_title'),
					this.bundle.getString(/mac/i.test(navigator.platform) ? 'compatibility_TMP_warning_text_mac' : 'compatibility_TMP_warning_text' ) + '\n'+
						this.bundle.getString('compatibility_TMP_warning_text_note'),
					(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
					(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1) +
					(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_2),
					this.bundle.getString('compatibility_TMP_warning_use_multipletab'),
					this.bundle.getString('compatibility_TMP_warning_use_TMP'),
					this.bundle.getString('compatibility_TMP_warning_keep'),
					aChecked ? this.bundle.getString('compatibility_TMP_warning_never') : null ,
					aChecked
				))
			{
				case 0:
					this.prefs.setPref(BACKUP+TMPAccelClick, this.prefs.getPref(TMPAccelClick));
					this.prefs.setPref(BACKUP+TMPShiftClick, this.prefs.getPref(TMPShiftClick));
					this.prefs.setPref(TMPAccelClick, 0);
					this.prefs.setPref(TMPShiftClick, 0);
					this.prefs.setPref(CHOICE, 0);
					break;
				case 1:
					this.prefs.setPref(BACKUP+SelfAccelClick, this.prefs.getPref(SelfAccelClick));
					this.prefs.setPref(BACKUP+SelfShiftClick, this.prefs.getPref(SelfShiftClick));
					this.prefs.setPref(SelfAccelClick, 0);
					this.prefs.setPref(SelfShiftClick, 0);
					this.prefs.setPref(CHOICE, 1);
					break;
				default:
					this.prefs.setPref(CHOICE, 2);
					break;
			}
		}
	};

	var namespace = {};
	Components.utils.import(
		'resource://multipletab-modules/prefs.js',
		namespace
	);
	var prefs = namespace.prefs;
	namespace = void(0);
	var restoreTMPPrefs = function() {
			var choice = prefs.getPref(CHOICE);
			var backupAccelPref = prefs.getPref(BACKUP+TMPAccelClick);
			var backupShiftPref = prefs.getPref(BACKUP+TMPShiftClick);
			prefs.clearPref(CHOICE);
			prefs.clearPref(BACKUP+TMPAccelClick);
			prefs.clearPref(BACKUP+TMPShiftClick);
			if (choice == 0) {
				if (backupAccelPref !== null) prefs.setPref(TMPAccelClick, backupAccelPref);
				if (backupShiftPref !== null) prefs.setPref(TMPShiftClick, backupShiftPref);
			}
		};
	var restoreMTHPrefs = function() {
			var choice = prefs.getPref(CHOICE);
			var backupAccelPref = prefs.getPref(BACKUP+SelfAccelClick);
			var backupShiftPref = prefs.getPref(BACKUP+SelfShiftClick);
			prefs.clearPref(CHOICE);
			prefs.clearPref(BACKUP+SelfAccelClick);
			prefs.clearPref(BACKUP+SelfShiftClick);
			if (choice == 1) {
				if (backupAccelPref !== null) prefs.setPref(SelfAccelClick, backupAccelPref);
				if (backupShiftPref !== null) prefs.setPref(SelfShiftClick, backupShiftPref);
			}
		};
	new window['piro.sakura.ne.jp'].UninstallationListener({
		id : 'multipletab@piro.sakura.ne.jp',
		onuninstalled : restoreTMPPrefs,
		ondisabled : restoreTMPPrefs
	});
	new window['piro.sakura.ne.jp'].UninstallationListener({
		id : '{dc572301-7619-498c-a57d-39143191b318}', // Tab Mix Plus
		onuninstalled : restoreMTHPrefs,
		ondisabled : restoreMTHPrefs
	});
})();

MultipleTabService.overrideExtensionsOnDelayedInit = function MTS_overrideExtensionsOnDelayedInit() {
};
