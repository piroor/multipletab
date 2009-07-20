// 0 = default, 1 = select tab, 2 = switch tab
pref("extensions.multipletab.tabdrag.mode",      1);
pref("extensions.multipletab.tabdrag.delay",     400);
pref("extensions.multipletab.tabdrag.autopopup", true);
pref("extensions.multipletab.tabdrag.autoclear", true);
pref("extensions.multipletab.tabdrag.moveMultipleTabs", true);
// 0 = default, 1 = toggle selection
pref("extensions.multipletab.tabclick.mode", 1);
pref("extensions.multipletab.selectionStyle", "auto");
pref("extensions.multipletab.useEffectiveTLD", true);

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
pref("extensions.multipletab.show.multipletab-selection-splitWindow", true);
pref("extensions.multipletab.show.multipletab-selection-printTabs", true);
pref("extensions.multipletab.show.multipletab-selection-freezeTabs", false);
pref("extensions.multipletab.show.multipletab-selection-protectTabs", true);
pref("extensions.multipletab.show.multipletab-selection-lockTabs", true);

pref("extensions.multipletab.show.multipletab-context-removeLeftTabs",  true);
pref("extensions.multipletab.show.multipletab-context-removeRightTabs", true);
pref("extensions.multipletab.show.multipletab-context-removeAll",       true);
pref("extensions.multipletab.show.multipletab-context-removeSimilar",   true);
pref("extensions.multipletab.show.multipletab-context-duplicate",       true);
pref("extensions.multipletab.show.multipletab-context-clipboard",       true);
pref("extensions.multipletab.show.multipletab-context-clipboardAll",    true);
pref("extensions.multipletab.show.multipletab-context-saveTabs",        true);

// 0 = URI, 1 = title+URI, 2 = HTML Link, -1 = select
pref("extensions.multipletab.clipboard.formatType", -1);
pref("extensions.multipletab.clipboard.linefeed", "\r\n");
pref("extensions.multipletab.clipboard.format.0", "%URL%");
pref("extensions.multipletab.clipboard.format.1", "%TITLE%%EOL%%URL%");
pref("extensions.multipletab.clipboard.format.2", "<a href=\"%URL_HTMLIFIED%\">%TITLE_HTMLIFIED%</a>");
pref("extensions.multipletab.clipboard.formats", "");
// 0 = single file, 1 = complete (include embedded files), 2 = plain Text, -1 = select
pref("extensions.multipletab.saveTabs.saveType", 1);


pref("extensions.multipletab@piro.sakura.ne.jp.name", "chrome://multipletab/locale/multipletab.properties");
pref("extensions.multipletab@piro.sakura.ne.jp.description", "chrome://multipletab/locale/multipletab.properties");
