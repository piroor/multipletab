/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const kCOMMAND_PULL_SELECTION_INFO           = 'multipletab:pull-selection-info';
const kCOMMAND_PUSH_SELECTION_INFO           = 'multipletab:push-selection-info';
const kCOMMAND_PULL_ACTIVE_CONTEXT_MENU_INFO = 'multipletab:pull-active-context-menu-info';
const kCOMMAND_SELECTION_MENU_ITEM_CLICK     = 'multipletab:selection-menu-item-click';
const kCOMMAND_UNREGISTER_FROM_TST           = 'multipletab:unregister-from-tst';
const kCOMMAND_NOTIFY_PANEL_SHOWN            = 'multipletab:notify-panel-shown';


const kMTHAPI_READY                       = 'ready';
const kMTHAPI_GET_TAB_SELECTION           = 'get-tab-selection';
const kMTHAPI_SET_TAB_SELECTION           = 'set-tab-selection';
const kMTHAPI_CLEAR_TAB_SELECTION         = 'clear-tab-selection';
const kMTHAPI_ADD_SELECTED_TAB_COMMAND    = 'add-selected-tab-command';
const kMTHAPI_REMOVE_SELECTED_TAB_COMMAND = 'remove-selected-tab-command';
const kMTHAPI_INVOKE_SELECTED_TAB_COMMAND = 'selected-tab-command';

const kNOTIFICATION_DEFAULT_ICON = '/resources/24x24-light.svg';


const kTST_ID = 'treestyletab@piro.sakura.ne.jp';

const kTSTAPI_REGISTER_SELF           = 'register-self';
const kTSTAPI_UNREGISTER_SELF         = 'unregister-self';
const kTSTAPI_PING                    = 'ping';
const kTSTAPI_NOTIFY_READY            = 'ready';
const kTSTAPI_NOTIFY_TAB_CLICKED      = 'tab-clicked'; // for backward compatibility
const kTSTAPI_NOTIFY_TAB_MOUSEDOWN    = 'tab-mousedown';
const kTSTAPI_NOTIFY_TAB_MOUSEUP      = 'tab-mouseup';
const kTSTAPI_NOTIFY_TABBAR_CLICKED   = 'tabbar-clicked'; // for backward compatibility
const kTSTAPI_NOTIFY_TABBAR_MOUSEDOWN = 'tabbar-mousedown';
const kTSTAPI_NOTIFY_TABBAR_MOUSEUP   = 'tabbar-mouseup';
const kTSTAPI_NOTIFY_TAB_DRAGREADY    = 'tab-dragready';
const kTSTAPI_NOTIFY_TAB_DRAGCANCEL   = 'tab-dragcancel';
const kTSTAPI_NOTIFY_TAB_DRAGSTART    = 'tab-dragstart';
const kTSTAPI_NOTIFY_TAB_DRAGENTER    = 'tab-dragenter';
const kTSTAPI_NOTIFY_TAB_DRAGEXIT     = 'tab-dragexit';
const kTSTAPI_NOTIFY_TAB_DRAGEND      = 'tab-dragend';
const kTSTAPI_ADD_TAB_STATE           = 'add-tab-state';
const kTSTAPI_REMOVE_TAB_STATE        = 'remove-tab-state';
const kTSTAPI_GET_TREE_STRUCTURE      = 'get-tree-structure';
const kTSTAPI_SET_TREE_STRUCTURE      = 'set-tree-structure';
const kTSTAPI_BLOCK_GROUPING          = 'block-grouping';
const kTSTAPI_UNBLOCK_GROUPING        = 'unblock-grouping';
const kTSTAPI_CONTEXT_MENU_OPEN       = 'fake-contextMenu-open';
const kTSTAPI_CONTEXT_MENU_CREATE     = 'fake-contextMenu-create';
const kTSTAPI_CONTEXT_MENU_UPDATE     = 'fake-contextMenu-update';
const kTSTAPI_CONTEXT_MENU_REMOVE     = 'fake-contextMenu-remove';
const kTSTAPI_CONTEXT_MENU_REMOVE_ALL = 'fake-contextMenu-remove-all';
const kTSTAPI_CONTEXT_MENU_CLICK      = 'fake-contextMenu-click';
