// 0 = default, 1 = select tab, 2 = switch tab
pref("extensions.multipletab.tabdrag.mode",      1);
pref("extensions.multipletab.tabdrag.delay",     400);
pref("extensions.multipletab.tabdrag.close",       true);
pref("extensions.multipletab.tabdrag.close.delay", 0);
pref("extensions.multipletab.tabdrag.autopopup", true);
pref("extensions.multipletab.tabdrag.autoclear", true);
pref("extensions.multipletab.tabdrag.moveMultipleTabs", true);
// 0 = default, 1 = change selection
pref("extensions.multipletab.tabclick.accel.mode", 1);
pref("extensions.multipletab.tabclick.shift.mode", 1);
pref("extensions.multipletab.selectionStyle", "auto");
pref("extensions.multipletab.implicitlySelectCurrentTab", true);
pref("extensions.multipletab.useEffectiveTLD", true);
pref("extensions.multipletab.checkUserHost", true);
// -1 = use browser.tabs.warnOnClose
// 0  = no warning
// 1  = show warning
pref("extensions.multipletab.warnOnCloseMultipleTabs", -1);

pref("extensions.multipletab.close.selectedTab.last", true);
// 0=left(top) to right(bottom), 1=right(bottom) to left(top)
pref("extensions.multipletab.close.direction", 1);

pref("extensions.multipletab.selectAfter.duplicate", true);
pref("extensions.multipletab.selectAfter.move", true);

pref("extensions.multipletab.show.multipletab-selection-clipboard", true);
pref("extensions.multipletab.show.multipletab-selection-reloadTabs", true);
pref("extensions.multipletab.show.multipletab-selection-removeTabs", true);
pref("extensions.multipletab.show.multipletab-selection-removeOther", true);
pref("extensions.multipletab.show.multipletab-selection-addBookmark", true);
pref("extensions.multipletab.show.multipletab-selection-saveTabs", true);
pref("extensions.multipletab.show.multipletab-selection-duplicateTabs", true);
pref("extensions.multipletab.show.multipletab-selection-pinTabs", true);
pref("extensions.multipletab.show.multipletab-selection-unpinTabs", true);
pref("extensions.multipletab.show.multipletab-selection-moveToGroup", true);
pref("extensions.multipletab.show.multipletab-selection-splitWindow", true);
pref("extensions.multipletab.show.multipletab-selection-printTabs", true);
pref("extensions.multipletab.show.multipletab-selection-freezeTabs", false);
pref("extensions.multipletab.show.multipletab-selection-protectTabs", true);
pref("extensions.multipletab.show.multipletab-selection-lockTabs", true);
pref("extensions.multipletab.show.multipletab-selection-suspendTabs", true);
pref("extensions.multipletab.show.multipletab-selection-resumeTabs", true);
pref("extensions.multipletab.show.multipletab-selection-invertSelection", true);

pref("extensions.multipletab.show.multipletab-context-removeLeftTabs",  true);
pref("extensions.multipletab.show.multipletab-context-removeRightTabs", true);
pref("extensions.multipletab.show.multipletab-context-removeAll",       true);
pref("extensions.multipletab.show.multipletab-context-removeSimilar",   true);
pref("extensions.multipletab.show.multipletab-context-removeOtherSimilar", true);
pref("extensions.multipletab.show.multipletab-context-duplicate",       true);
pref("extensions.multipletab.show.multipletab-context-clipboard",       true);
pref("extensions.multipletab.show.multipletab-context-clipboardAll",    true);
pref("extensions.multipletab.show.multipletab-context-saveTabs",        true);
pref("extensions.multipletab.show.multipletab-context-selectSimilar", true);

// 0 = URI, 1 = title+URI, 2 = HTML Link, -1 = select
pref("extensions.multipletab.clipboard.formatType", -1);
//pref("extensions.multipletab.clipboard.linefeed", "\r\n");
pref("extensions.multipletab.platform.default.clipboard.linefeed", "\r\n");
pref("extensions.multipletab.platform.WINNT.clipboard.linefeed", "\r\n");
pref("extensions.multipletab.platform.Darwin.clipboard.linefeed", "\n");
pref("extensions.multipletab.platform.Linux.clipboard.linefeed", "\n");
pref("extensions.multipletab.clipboard.format.0", "%URL%");
pref("extensions.multipletab.clipboard.format.1", "%TITLE%%EOL%%URL%");
pref("extensions.multipletab.clipboard.format.2", "%RT%<a href=\"%URL_HTMLIFIED%\">%TITLE_HTMLIFIED%</a>");
pref("extensions.multipletab.clipboard.formats", "");
// 0 = single file, 1 = complete (include embedded files), 2 = plain Text, -1 = select
pref("extensions.multipletab.saveTabs.saveType", 1);
// 0 = blank
// 1 = the title of the first tab
// 2 = always ask
pref("extensions.multipletab.moveTabsToNewGroup.defaultTitle", 1);


pref("extensions.multipletab.compatibility.TMP.warnForClickActions", true);
pref("extensions.multipletab.compatibility.TMP.choice", -1); // -1 = unknown, 0 = MTH, 1 = TMP, 2 = both


pref("extensions.multipletab@piro.sakura.ne.jp.name", "chrome://multipletab/locale/multipletab.properties");
pref("extensions.multipletab@piro.sakura.ne.jp.description", "chrome://multipletab/locale/multipletab.properties");
