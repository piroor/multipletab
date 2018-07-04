# History

 - master/HEAD
   * Behave like tab selection on Google Chrome and lately Firefox. (One of rest selected tabs is activated when the active tab is unselected, Ctrl-Shift-Click adds tabs between two last clicked tabs to the selection.)
   * Support per-window selection.
 - 2.0.13 (2018.5.30)
   * Add ability to switch color scheme to Dark theme.
   * Make configuration categories collapsible.
   * Close the fake context menu immediately when any item is clicked.
   * Keyboard operations affects correctly for the fake context menu even if the cursor is on any separator.
   * Save cached external addons correctly.
 - 2.0.12 (2018.5.16)
   * Execute command in the fake context menu, by an access key without Enter, when there is no other command with same access key.
 - 2.0.11 (2018.5.14)
   * Reduce flicking of tab selection while dragging.
   * Show icon for the root contest menu item.
   * Handle keyboard operations around the fake context menu and fake confirmation dialog on `keydown`. This behavior is same to native UI.
   * Show menu label correctly even if it has an access key.
   * Features require special permissions now work again. (regression)
 - 2.0.10 (2018.3.7)
   * Make compatible to Tree Style Tab 2.4.17 and later.
 - 2.0.9 (2018.2.11)
   * Reformat keys of localized messages matching to the [spec](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/i18n/Locale-Specific_Message_reference#Member_details).
 - 2.0.8 (2018.2.11)
   * Implement "suspend" and "resume" for selected tabs. ("suspend" is available only on Firefox 59 and later.)
   * Keyboard shortcuts for commands are now customizable on Firefox 60 and later. (No keyboard shortcut is defined by default.)
   * Better behavior and keyboard operation handling of fake context menu.
   * Don't apply indent for `%TST_INDENT(...)%` when tree of tabs are partially selected.
   * Reformat keys of localized messages matching to the [spec](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/i18n/Locale-Specific_Message_reference#Member_details).
 - 2.0.7 (2018.2.1)
   * Add [`%TST_INDENT(...)%` placeholder for the "Copy to Clipboard" command](https://github.com/piroor/multipletab/issues/185#issuecomment-361820213).
   * Add ability to restore default items for "Copy to Clipboard" keeping user-defined items.
   * Add a new option to prevent opening menu after tab selection by dragging started with long press.
   * Synchronize most of configurations via the Firefox Sync.
 - 2.0.6 (2018.1.25)
   * Add "Create New Group" command for selected tabs (requires [Tree Style Tab](https://addons.mozilla.org/firefox/addon/tree-style-tab/).)
   * Make some permissions optional.
   * Control visibility of the menu item "Mute Tabs" correctly.
 - 2.0.5 (2017.12.1)
   * Add new command "Move Tabs to Other Window".
   * Don't move scroll position when a text is copied to the clipboard.
   * On Tree Style Tab's sidebar, selected tabs are now draggable to move.
   * Use white icon for the toolbar button on the "Dark" theme.
   * Item selection behavior in the toolbar button panel becomes more natural like generic list UI.
   * Don't open menu by right cick when there is no selection.
   * Show menu-like UI with more menu-like appearance.
   * Don't reopen menu after outside area is clicked.
   * Copy plain text data more safely.
 - 2.0.4 (2017.11.15)
   * Implement "bookmark selected tabs" command.
   * Implement "move selected tabs to new window" command.
   * Add Markdown format to default "copy to clipboard" formats.
 - 2.0.3 (2017.10.14)
   * Command(⌘)-Click correctly toggles selection on macOS.
   * Allow to drag selected tabs on Tree Style Tab's sidebar.
   * Allow to select multiple tabs by simple click on checkboxes in the toolbar panel.
   * Open Tree Style Tab's fake context menu on dragend after updated menu items are completely applied.
 - 2.0.2 (2017.10.13)
   * Treat Command(⌘)-Click same as Ctrl-Click on macOS.
 - 2.0.1 (2017.10.13)
   * Support Ctrl-Click and Shift-Click on the panel.
   * Add an option to activate "Select and Do" panel even if Tree Style Tab is available.
 - 2.0 (2017.10.13)
   * Rebuilt on WebExtensions.
 - 0.8.2017061501
   * Works on Nightly 56.0a1.
   * Drop support for Firefox 51 and older versions.
   * Allow to drop multiple local files to the tab bar, on Firefox 52 and later.
   * Fix German label for `config.useEffectiveTLD.enabled` (thanks to Ulf Rompe!)
 - 0.8.2016111701
   * Unpin selected tabs more safely.
   * Now you can duplicate the current tab by Shift-Click or Middle-Click on the menu item.
 - 0.8.2016090602
   * Remove needless codes
 - 0.8.2016090601
   * Tear off dragged selected tabs on Firefox 47 and later correctly.
   * Fix regression around animation of non-dragged tabs.
 - 0.8.2016090501
   * Fix regression around drag and drop of non-tab objects onto the tab bar.
 - 0.8.2016090401
   * Drop support for obsolete (already unpublished) addons: "Print All Tabs" and old "Tab Groups".
   * "Save selected tabs into a folder" feature works correctly again on Firefox 51 and later.
 - 0.8.2016083001
   * Add a new command for selected tabs: Remove Selected Tabs from Bookmarks.
   * Better compatibility around "duplicate selected tabs" feature, with other addons.
   * Set selection of tabs more correctly by Shift-Click, when there is any invisible tab hidden by Tree Style Tab addon or others.
   * Re-encode spaces into `%20` to not break URIs copied from tabs (by Infocatcher. Thanks!)
   * `ru` locale is updated (by Infocatcher. Thanks!)
 - 0.8.2015113001
   * Add "Mute/Unmute Tabs" features for all/selected tabs.
   * Support Tab Utilities Fixed's "Move to Window" menu for selected tabs.
   * The feature "Bookmark selected tabs" and the property dialog of bookmark folders now work correctly.
   * [`ru` locale is updated by Netanyahu. Thanks!](https://github.com/piroor/multipletab/pull/104)
 - 0.8.2015111101
   * "Invert Selection" works correctly when the selection menu is closed automatically.
   * [`ru` locale is updated by Infocatcher. Thanks!](https://github.com/piroor/multipletab/pull/102)
 - 0.8.2015111001
   * Works on Firefox 40 and later.
   * Add "Select Similar Tabs" to the tab context menu and "Invert Selection" to the selection menu,
   * The feature "Bookmark selected tabs" and the property dialog of bookmark folders now work correctly.
   * Message from content area are correctly handled even if tabs' remoteness is dynamically changed.
 - 0.8.2015030601
   * Clicking operation on a closebox of a tab is now cancelable by releasing after dragout, like other generic buttons. ([Selection of ready-to-close tabs is started after the mouse pointer lands on the second tab's closebox.](https://github.com/piroor/multipletab/issues/22#issuecomment-77101283))
 - 0.8.2015022701
   * Works again on Firefox 36 and later.
   * Place duplicated tabs next to the source tabs.
   * Duplicate selected tabs by ctrl-drag-and-drop in same window correctly.
   * Duplicate ctrl-drag-and-dropped tabs from another window correctly.
   * Never show warning for closing multiple tabs if the number of closing tabs are less than the maximum number of restorable tabs.
   * Fix UI for `extensions.multipletab.tabdrag.delay` preference. ([By Infocatcher](https://github.com/piroor/multipletab/pull/84). Thanks!)
 - 0.8.2014102201
   * Drop support for Firefox 30 and older versions.
   * Works correctly on the multi-process mode (E10S).
   * Add an option to enable/disable the feature: "Close tabs if closeboxes in tabs are selected by dragging."
   * Toggle locked state of selected tabs correctly.
   * Works on Nightly 33.0a1 with the preference `dom.compartment_per_addon`=`true`.
 - 0.7.2014050101
   * Fix too small feedback square for ready-to-close tabs with Australis on Linux.
 - 0.7.2014043001
   * Better compatibility with Tab Mix Plus. (regression)
 - 0.7.2014042701
   * Works on Firefox 31.0a1.
   * Drop support for Firefox 23 and olders.
   * Improved: Pending tabs are not loaded if it is not needed when you choose "copy URI of tabs" menu item.
 - 0.7.2013100801
   * Support "Close Tabs to Right" feature on Firefox 24 and later. Multiple Tab Handler's own feature is disabled if it is provided by Firefox itself.
   * Works on Firefox 25 and later.
 - 0.7.2013052901
   * Improved: Show unnamed tab groups in the "Move to Group" popup.
   * Improved: Add support of rich text format for the "copy to clipboard" feature. Now "%RT%" keyboard means "copy the result as a rich text HTML to the clipboard". (by Yue Hu (ximellon). Thanks!)
   * Improved: Make help topics readable, about placeholders for "Copy URIs of Tabs" (by Infocatcher. Thanks!)
   * Modified: Update codes around [session store API](http://dutherenverseauborddelatable.wordpress.com/2013/05/23/add-on-breakage-continued-list-of-add-ons-that-will-probably-be-affected/).
 - 0.7.2013040601
   * Fixed: Move all selected tabs to a newly opened window correctly on Firefox 19 and later.
   * Update "ru" locale (by Infocatcher)
   * Update "zh-TW" locale (by HJL)
   * Modified: "jar" archive is no longer included.
 - 0.7.2012122901
   * Works on Nightly 20.0a1.
   * Improved: A new special character pattern "%TAB%" (means a horizontal tab character) is available for "copy selected tabs" feature.
   * Improved: Support "suspend tabs" and "resume tabs" commands with [Suspend Tab](http://piro.sakura.ne.jp/xul/_suspendtab.html.en) and [UnloadTab](https://addons.mozilla.org/firefox/addon/unloadtab/).
   * Fixed: "Save selected tabs" works correctly again. (regression)
   * Fixed: Move selected tabs by drag and drop correctly even if the dragging action is started on a not-primary selected tab.
   * Fixed: Move selected tabs to a new window correctly when they are dropped outside of the window, on lately versions of Firefox.
 - 0.7.2012111301
   * Fixed: "Reload selected tabs" works correctly.
   * Fixed: "Save selected tabs" works correctly on lately Nightly.
   * Fixed: "Save selected tabs" sometimes failed on Windows. Now it works stably.
 - 0.7.2012111001
   * Updated for Nightly 19.0a1.
   * Drop support for versions older than Firefox 10.
   * Improved: Dragged multiple tabs are now animated (on Firefox 17 beta and later.)
   * Fixed: To-be-restored tabs were lost by multiple tabs operations (ex. new window from selected tabs.) Now they are restored safely.
   * Fixed: Hide "Move to Group" menu item on tabs, if user don't use Panorama
   * Fixed: Shift-click could select wrong tabs.
 - 0.7.2012020901
   * Updated for Nightly 13.0a1.
   * Drop support for Firefox 3.6.
   * Fixed: Some menu items in the context menu for selected tabs couldn't be hidden by user preferences.
   * Fixed: We couldn't create bookmarks from selected tabs on lately Nightly.
 - 0.6.2011120101
   * Improved: Dragging on closeboxes in tabs can be started with delay. (The delay can be customized via the secret preference "extensions.multipletab.tabdrag.close.delay". Default value is "0".)
   * Improved: Now, after Multiple Tab Handler or Tab Mix Plus is uninstalled or disabled, MTH restores previous preferences about Ctrl/Shift-Click on tabs for each addon.
   * Fixed: Tab selection is cleared (just like file selection) when one of selected tabs is clicked.
   * Fixed: Closeboxes in tabs were wrongly sensitive on outside 1px.
 - 0.6.2011092901
   * Note: This version (and older versions) is incompatible to Firefox 8 or later due to the [bug 455694](https://bugzilla.mozilla.org/show_bug.cgi?id=455694) and [674925](https://bugzilla.mozilla.org/show_bug.cgi?id=674925).
   * Improved: Now you can cancel dragging operation (to select tabs) by the ESC key.
   * Improved: Selection behavior becomes similar to the one for range selection of text and so on. Old versions simply toggled the selected state by hovering on each tab.
   * Fixed: "Close Left (Above) Tabs" don't close pinned tabs.
   * Fixed: "Close Left (Above) Tabs" and "Close Right (Below) Tabs" were wrongly disabled when there are some tabs in other groups of Panorama.
   * ru-RU locale is updated by Netanyahu.
 - 0.6.2011082901
   * Note: This version (and older versions) is incompatible to Firefox 8 or later due to the [bug 455694](https://bugzilla.mozilla.org/show_bug.cgi?id=455694) and [674925](https://bugzilla.mozilla.org/show_bug.cgi?id=674925).
   * Improved: Implicitly selection behavior for the current tab can be customizable.
   * Improved: Warning for closing multiple tabs can be costomized by the new pref "extensions.multipletab.warnOnCloseMultipleTabs". ( `-1` =use "browser.tabs.warnOnClose",  `0` =no warning,  `1` =show warning)
   * Improved: New place holders for meta info:  `%AUTHOR%` ,  `%AUTHOR_HTMLIFIED%` ,  `%DESCRIPTION%` ,  `%DESCRIPTION_HTMLIFIED%` ,  `%KEYWORDS%` , and  `%KEYWORDS_HTMLIFIED%` .
   * Fixed: Failed to drag single tab if a tab is selected.
   * Fixed: Some tabs were not selected by quick select. (Thanks titoBouzout!)
   * Fixed: Context menu on the content are was unexpectedly blocked.
   * Modified: Menu labels in the selection menu are shorten. (ja-JP locale)
   * ru-RU locale is updated by Netanyahu.
 - 0.6.2011051101
   * Improved: Multiple Tab Handler can completely ignore Ctrl(Command)-Click on tabs by the preference.
   * Fixed: "Close Other Tabs" should not close pinned tabs.
   * Fixed: Ctrl(Command)-Click on the current tab didn't select the tab itself.
   * Fixed: On Firefox 4, dropped tabs onto toolbar items in the tab bar were unexpectedly ignored.
   * Fixed: Works with [Locationbar2](https://addons.mozilla.org/firefox/addon/locationbar%C2%B2/).
   * Fixed: When [Personal Titlebar](https://addons.mozilla.org/firefox/addon/personal-titlebar/) is installed, initializing process was wrongly called twice.
   * Fixed: Compatibility issue about TabDNDObserver of Tab Mix Plus gone.
   * Updated: French locale is available, translated by Jean-Philippe Fleury.
   * Updated: zh-CN locale is updated by hzhbest.
 - 0.6.2011020301
   * Fixed: Tabs can't be dragged if there is Tab Mix Plus.
   * Improved: Works with [Personal Titlebar](https://addons.mozilla.org/firefox/addon/personal-titlebar/).
   * Improved: Works with [DragNDrop Toolbars](https://addons.mozilla.org/firefox/addon/dragndrop-toolbars/).
 - 0.6.2011011701
   * Improved: For Minefield, "Pin as App Tab", "Unpin Tab" and "Move to Group" are available for selected tabs.
   * Fixed: On Minefield, tab selection is cleared when the Panorama is activated.
 - 0.6.2011011102
   * Modified: API changing. You can get values via  `getData()`  from events fired with old names (without "nsDOM" prefix).
 - 0.6.2011011101
   * Fixed: The popup for selected tabs was unexpectedly when you switch to a background tab.
   * Modified: Highlighted closeboxes in "to-be-closed" tabs are less prominent.
   * Modified: API changing. API based on DOM Events are now sent as DataContainerEvent as new event types with "nsDOM" prefix, due to security restrictions on Minefield. (You can still use old API based on property access, but it doesn't work on Firefox 4 (and later) in some cases. Instead, you should use  `aEvent.getData(property name)`  to get the value from the event object.)
 - 0.6.2010121701
   * Improved: Tabs under different user's home (pages under different /~username/ ) are handled as "different website". (To disable this new feature, set extensions.multipletab.checkUserHome=false )
   * Modified: Use "multiselected" instaead of "multipletab-selected". (For compatibility, old attribute is still available.)
   * Fixed: Tabs can't be dragged if there is Tab Mix Plus.
   * Fixed: Some entries in the ru-RU locale are reverted to the previous version.
 - 0.6.2010120202
   * Fixed: When multiple tabs are dropped into a bookmarks tree, they are bookmarked correctly.
   * Improved: On Minefield, to-be-restored tabs can be bookmarked by drag and drop.
 - 0.6.2010120201
   * Modified: On Firefox 3.6 or olders on Windows, the cursor while multiple tabs are dragged is shown with default drag-and-drop style. (due to a bug of Firefox itself: Firefox cannot show a drag feedback image for dragging of multiple items via HTML5 drag and drop events.)
   * Fixed: Styles for closeboxes of to-be-closed tabs were too annoying.
 - 0.6.2010120101
   * Drop support for Firefox 3.0.
   * Improved: Implementations are updated based on HTML5 Drag and Drop API. Now Multiple Tab Handler sets multiple data to the data transfer and provides drag feedback image for multiple tabs.
   * Improved: Now a custom event "MultipleTabHandler:TabsDragStart" is fired just before Multiple Tab Handler start to drag multiple tabs. By canceling it (you can call preventDefault() of the event) you can override behaviors for dragging of multiple tabs.
   * Fixed: Configuration dialog of Menu Editor can be opened correctly.
   * Fixed: Closeboxes of to-be-closed tabs are highlighted more clearly.
 - 0.5.2010111401
   * Following up changes about tabs on Minefield.
   * Fixed: On Minefield, sessions are restored correctly.
 - 0.5.2010070301
   * Fixed: Checkboxes for other addons are correctly initialized on Minefield 4.0b2pre.
   * Fixed: Works correctly even if Tree Style Tab is not installed. (regression on 0.5.2010062901)
 - 0.5.2010062901
   * Fixed: Auto-scrolling while dragging on the tab bar works correctly on Minefield 3.7a6pre.
   * ru-RU locale is updated by L'Autour.
 - 0.5.2010043001
   * Improved: On a poor PC, just clicking a background tab (for switching to the tab) never starts selecting of the clicked tab. In old versions, clicking on background tabs started selecting of tabs even if you don't want to do it because Firefox can take time between mousedown and mouseup.
   * Fixed: "multipletab-available" attribute without preference key "extensions.multipletab.show.*" works correctly.
 - 0.5.2010040201
   * Updated for the bug: [Bug 554991  - allow tab context menu to be modified by normal XUL overlays](https://bugzilla.mozilla.org/show_bug.cgi?id=554991)
 - 0.5.2010032901
   * Fixed: es-ES locale was broken.
 - 0.5.2010032801
   * Improved: Works on Minefield 3.7a4pre.
   * Fixed: Dragging of multiple tabs into the bookmarks sidebar creates multiple bookmarks correctly.
   * Fixed: The URI of unloaded tabs by [BarTab](https://addons.mozilla.org/firefox/addon/67651) is correctly saved.
   * es-ES locale is updated by tito.
   * ru-RU locale is updated by Netanyahu.
   * it-IT locale is updated by Godai71.
 - 0.5.2010020801
   * Modified: Now, "Close Similar Tabs" closes the specified tab too.
   * Improved: New feature "Close Other Similar Tabs" is available. It works like as "Close Similar Tabs" in older versions.
   * Fixed: "Save Tabs" works correctly.
   * Fixed: Combination with [BarTap](https://addons.mozilla.org/firefox/addon/67651) works correctly.
 - 0.5.2010020301
   * Improved: Tapped tabs by [BarTap](https://addons.mozilla.org/firefox/addon/67651) are just loaded when you choose "reload" action.
   * Fixed: Obsolete entry was possibly left to the "undo close tab" history, on Firefox 3.6.
   * zh-CN locale is updated by hzhbest.
   * ru-RU locale is updated by Netanyahu.
 - 0.5.2010012001
   * Fixed: Floating panels (ex. [Echofon](https://addons.mozilla.org/firefox/addon/5081)) stay open even if multiple tabs are closed.
   * Fixed: Broken drag-and-drop of bookmarks disappeared when works with [Tree Style Tab](http://piro.sakura.ne.jp/xul/_treestyletab.html.en).
   * Improved: "Lock tab" for selected tabs is available when [Super Tab Mode](https://addons.mozilla.org/firefox/addon/13288) is installed.
   * Improved: "Lock", "protect" and "freeze" for selected tabs are available when [Tab Utilities](https://addons.mozilla.org/firefox/addon/59961) is installed.
   * it-IT locale is updated by Godai71.
   * hu-HU locale is updated by Mikes Kaszmán István.
 - 0.5.2010011601
   * Improved: When selected tabs are dropped to bookmarks menu or tree, then multiple bookmarks are created for selected tabs.
   * Improved: Behavior of shift-click on tabs becomes customizable.
   * Improved: When Tab Mix Plus is installed, Multiple Tab Handler confirms which addon should handle ctrl-click and shift-click on tabs.
   * Fixed: "$1" in titles and URIs of selected tabs broke copied text.
   * Fixed: With Tree Style Tab, whole of expanded tree which had "collapsed" state internally were wrongly selected.
   * Improved:  `MultipleTabHandlerTabsClosing`  DOM event is fired when multiple tabs are being closed, and  `MultipleTabHandlerTabsClosed`  DOM event is fired just after tabs are closed.
   * Improved: Now you can undo/redo operations for multiple tabs by [Undo Tab Operations](https://addons.mozilla.org/firefox/addon/58033/).
   * de-DE locale is available, translated by mpeters and saskia_br.
   * pl-PL locale is available, translated by Jacek Chrząszcz.
   * ru-RU locale is updated by Netanyahu.
   * it-IT locale is updated by Godai71.
 - 0.5.2009110501
   * Works on Minefield and Firefox 3.6.
   * Drop Firefox 2 support.
   * Fixed: More safer code.
   * Fixed: Mismatch of real tab state vs. stored session disappeared.
   * Fixed: For indented tabs, mousemove events are ignored if they are fired on blank areas.
 - 0.4.2009073101
   * Improved: Tree structure of [Tree Style Tab](http://piro.sakura.ne.jp/xul/_treestyletab.html.en) is saved to the bookmarks.
   * Fixed: "Bookmark selected tabs" and "Bookmark all tabs" work correctly even if Tab Mix Plus is installed.
   * hu-HU locale is updated by Mikes Kaszmán István
 - 0.4.2009072001
   * Improved: Formats of copied texts becomes customizable. (compatible to [Copy URL+](https://addons.mozilla.org/firefox/addon/129))
 - 0.3.2009071601
   * Improved: "Lock Tab", "Protect Tab" and "Freeze Tab" are available for selected tabs, when Tab Mix Plus is installed.
   * Fixed: Dragging on tabs works correctly for multi-row tab bar of Tab Mix Plus.
   * Fixed: Vertical autoscroll is available for multi-row tab bar of Tab Mix Plus.
   * Fixed: For Firefox 3.5, all-tabs-dragging is ignored correctly.
   * zh-CN locale, translated by hzhbest is available.
 - 0.3.2009062901
   * Fixed: Tabs moved between windows are correctly selected/unselected by user preference, on Firefox 3.0.
   * Fixed: Throbber in tabs is correctly shown with Firefox 3.5 on Mac OS X.
   * it-IT locale is updated by Godai71
   * zh-TW locale is updated by Tsprajna
   * hu-HU locale is updated by Mikes Kaszmán István
 - 0.3.2009062301
   * Fixed: The number of closed tabs is shown correctly.
   * Improved: The order to close selected tabs becomes customizable.
   * Improved: Auto-select behavior for tab duplication and moving tab between windows becomes customizable.
   * Updated: it-IT locale update (I forgot to update an entry!)
 - 0.3.2009051501
   * hu-HU locale is updated by Mikes Kaszmán István
 - 0.3.2009051301
   * Improved: Works with [Menu Editor](https://addons.mozilla.org/firefox/addon/710) more usefully. (Tab selection menu becomes customizable and Menu Editor can be opened from the configuration dialog of Multiple Tab Handler.)
   * Improved: For developers, you can insert new menu items to the tab context menu not only with  `multipletab-insertbefore`  but also  `multipletab-insertafter` .
   * Improved: For developers, you can specify insertion position of tab context menu items by XPath expressions, in  `multipletab-insertbefore`  or  `multipletab-insertafter` .
   * Modified: The order of inserted items in the tab context menu changed.
   * Modified: By the API, menu items provided by Multiple Tab Handler will be inserted to the tab context menu at first. After it, menu items of other extensions will be done.
 - 0.3.2009051101
   * Improved: Linefeed characters of copied texts to the clipboard are suitable for each platform. (CR+LF for Windows, LF for Linux and Mac OS X)
   * Fixed: Duplication of tabs after another duplication work correctly.
   * zh-TW locale is updated by Tsprajna.
 - 0.3.2009043002
   * Works on Minefield.
 - 0.3.2009043001
   * Fixed: With [Split Browser](http://piro.sakura.ne.jp/xul/_splitbrowser.html.en), the window isn't closed even if the last tab in the main pane is moved to another window from an window which have some panes.
 - 0.3.2009042901
   * Improved: "Close Other Tabs" is available for selected tabs. It will close unselected tabs and keep selected tabs open.
   * Improved: "Similar tabs" detection is now based on Effective TLD list of Firefox 3.
   * Improved: Some special characters in URIs or page titles are replaced to their entity references, for "HTML style" copying.
   * Fixed: Wrongly selection for all of tabs (not only duplicated one) after tabs duplicating disappeared.
   * zh-TW locale is available. (translated by Tsprajna)
 - 0.3.2009040901
   * Improved: Auto-scroll for tab draggings is available.
 - 0.3.2009040201
   * Works on Minefield again.
 - 0.3.2009032501
   * Modified: Selected tabs are highlighted even if other addons apply custom styles to tabs.
 - 0.3.2009021201
   * Modified: Some internal operations are optimized.
 - 0.3.2008122801
   * Fixed: Tabs keep their selection after clicks on buttons in the tab bar.
   * Added: ru-RU locale is available. (by L'Autour)
   * Updated: it-IT locale is updated. (by Godai71)
 - 0.3.2008120401
   * Improved: "Print Selected Tabs" is available if [Print All Tabs](https://addons.mozilla.org/firefox/addon/5142) is installed.
   * Improved: You can start to select tabs from spaces of indented tabs if [Tree Style Tab](http://piro.sakura.ne.jp/xul/_treestyletab.html.en) is installed.
   * Updated: Hungarian locale is updated by Mikes Kaszmán István.
 - 0.3.2008120201
   * Improved: "Save selected tabs" feature is available.
   * Fixed: The dragged tab itself is correctly selected while mousedown.
   * Improved: Dragging selected tabs and dropping them out of the window tears off them as a new window, on Minefield 3.1b3pre.
 - 0.3.2008111401
   * Modified: Useless checkboxes are automatically disabled by selected mode of tab dragging action.
   * Updated: Italian locale is updated by Godai71.
   * Updated: Spanish locale is updated by tito.
   * Updated: Hungarian locale is updated by Mikes Kaszmán István.
 - 0.3.2008101801
   * Improved: Auto-opening of the popup menu after selecting tabs by dragging can be disabled.
   * Fixed: Groupboxes for menu item checkboxes are expanded in the configuration dialog.
 - 0.3.2008101701
   * Improved: On Minefield 3.1b2pre, multiple tabs are moved from an window to another by drag and drop, without reloading.
   * Improved: On Minefield 3.1b2pre, selected tabs moves to split new window without reloading.
   * Improved: When you drag and drop multiple tabs from an window to another, they are duplicated only if "Ctrl" key (on Mac OS X, "Command" key) is pressed. Otherwise tabs are just moved.
   * Fixed: "Bookmark Selected Tabs" feature works with Tab Mix Plus.
   * Fixed: Some context menu items are hidden by settings correctly.
 - 0.2.2008101501
   * Fixed: Collapsed tabs are correctly closed with [Tree Style Tab](http://piro.sakura.ne.jp/xul/_treestyletab.html.en).
   * Fixed: Works with [Menu Edit](https://addons.mozilla.org/firefox/addon/710). Menu items of tab context menu are not duplicated anymore.
   * Fixed: Selected tabs are correctly bookmarked even if Tab Mix Plus is installed.
   * Fixed: "Close Left Tabs" and "Close Right Tabs" are disabled correctly if there is no left/right tabs.
   * Fixed: Context menu items for multiple tabs are correctly hidden for single tab.
 - 0.2.2008050601
   * Italian locale is updated.
 - 0.2.2008050201
   * Fixed: Selected tabs are bookmarked in a new folder correctly on Firefox 3.
 - 0.2.2008040701
   * Modified: Duplicated tabs are selected automatically.
   * Modified: Appearance in Firefox 3 is changed a little.
 - 0.2.2008031001
   * Fixed: "Duplicate Selected Tabs" works correctly.
   * Fixed: Selected tabs are not deselected after a submenu is hidden.
   * Spanish locale is available. (by tito, Thanks!)
   * Works on Minefield 3.0b5pre.
 - 0.2.2008022801
   * Fixed: "Duplicate Seelcted Tabs" and "Move to New Window" work correctly with [Tab Groups](http://paranoid-androids.com/tabgroups/).
 - 0.2.2008022701
   * Improved: In [Linkwad](https://addons.mozilla.org/ja/firefox/addon/3263) and [Tab Groups](http://paranoid-androids.com/tabgroups/), you can move multiple tabs from a group to another by drag and drop.
 - 0.2.2008022502
   * Fixed: Wrongly shown indicator on the tab bar disappeared after you drag multiple selection tabs.
   * Fixed: Order of moved or duplicated tabs which are made by drag and drop of multiple selection tabs are same as before dragging.
 - 0.2.2008022501
   * Updated: Hungarian locale is updated. (by Mikes Kaszmán István)
 - 0.2.2008022402
   * Improved: Duplicating or moving (from another Firefox window) of multiple tabs are available on Firefox 3.
   * Fixed: Selected tabs are correctly highlighted on Firefox 3.
 - 0.2.2008022401
   * Improved: You can drag and drop multiple tabs which are selected.
   * Modified: "duplicateTab" method is added to gBrowser if it doesn't have the method.
 - 0.2.2007111801
   * Improved: With [Tree Style Tab](http://piro.sakura.ne.jp/xul/_treestyletab.html.en), collapsed children tabs are selected if the parent tab is selected.
 - 0.2.2007111301
   * Fixed: Closing multiple tabs by dragging closeboxes works correctly even if Tab Mix Plus is available.
 - 0.2.2007110601
   * Improved: If the drag action is canceled before start dragging, tab selection is cleared and the popup menu doesn't appear.
   * Fixed: Delay is available for tab switching by dragging.
   * Modified: A delay is used for tab selecting or switching by default.
 - 0.2.2007110501
   * Improved: Format of copied text from tabs can be chosen from menu.
   * Improved: Delay is avialable for tab dragging. You can select/switch tabs by dragging after a delay.
   * Added: Italian locale is available. (made by Godai71.Extenzilla)
 - 0.1.2007103101
   * Fixed: Works with [ImgLikeOpera](https://addons.mozilla.org/firefox/addon/1672) and [Session Fix](https://addons.mozilla.org/firefox/addon/4542) correctly.
   * Modified: Selected tabs will be highlighted with their border if [ColorfulTabs](https://addons.mozilla.org/firefox/addon/1368) or [ChromaTabs](https://addons.mozilla.org/firefox/addon/3810) is installed.
 - 0.1.2007102501
   * Improved: "Bookmark Selected Tabs" works on Minefield.
 - 0.1.2007061801
   * Fixed: Obsolete separators disappeared from the popup menu for selected tabs and the context menu of tabs.
   * Fixed: A typo in the English locale disappeared.
 - 0.1.2007060601
   * Improved: New features, "Copy URI" and "Close Silimar Tabs" are available.
   * Updated: Hungarian locale is updated.
 - 0.1.2007050701
   * Fixed: Tabs can be moved by dragging on it, not only the favicon but the tab.
   * Fixed: Typo in Japanese locale is corrected.
 - 0.1.2007050601
   * Fixed: Some API become to work correctly.
 - 0.1.2007042601
   * Fixed: Popup menu is shown at the correct position.
 - 0.1.2007042501
   * Fixed: Works with [All-in-One Gestures](https://addons.mozilla.org/firefox/addon/12) correctly.
 - 0.1.2007042003
   * Improved: "Duplicate Tab" is available.
   * Improved: Implementation to open tabs in new window is improved. It works more quickly.
 - 0.1.2007042002
   * Improved: Icon is available.
   * Improved: "Close All Tabs" is avialable for the context memn on tabs.
   * Improved: "Bookmark Selected Tabs" is available for selection menu.
   * Fixed: Warning dialog disappeared for "Reload Selected Tab".
 - 0.1.2007042001
   * Released.
