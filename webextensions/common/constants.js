/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const kCOMMAND_PULL_SELECTION_INFO = 'multipletab:pull-selection-info';
const kCOMMAND_PUSH_SELECTION_INFO = 'multipletab:push-selection-info';
const kCOMMAND_PULL_ACTIVE_CONTEXT_MENU_INFO = 'multipletab:pull-active-context-menu-info';
const kCOMMAND_SELECTION_MENU_ITEM_CLICK = 'multipletab:selection-menu-item-click';
const kCOMMAND_UNREGISTER_FROM_TST = 'multipletab:unregister-from-tst';
const kCOMMAND_NOTIFY_PANEL_SHOWN = 'multipletab:notify-panel-shown';


const kMTHAPI_GET_TAB_SELECTION   = 'get-tab-selection';
const kMTHAPI_SET_TAB_SELECTION   = 'set-tab-selection';
const kMTHAPI_CLEAR_TAB_SELECTION = 'clear-tab-selection';
const kMTHAPI_ADD_SELECTED_TAB_COMMAND    = 'add-selected-tab-command';
const kMTHAPI_REMOVE_SELECTED_TAB_COMMAND = 'remove-selected-tab-command';
const kMTHAPI_INVOKE_SELECTED_TAB_COMMAND = 'selected-tab-command';


const kTST_ID = 'treestyletab@piro.sakura.ne.jp';

const kTSTAPI_REGISTER_SELF        = 'register-self';
const kTSTAPI_UNREGISTER_SELF      = 'unregister-self';
const kTSTAPI_PING                 = 'ping';
const kTSTAPI_NOTIFY_READY         = 'ready';
const kTSTAPI_NOTIFY_TAB_CLICKED   = 'tab-clicked';
const kTSTAPI_NOTIFY_TABBAR_CLICKED = 'tabbar-clicked';
const kTSTAPI_NOTIFY_TAB_DRAGREADY = 'tab-dragready';
const kTSTAPI_NOTIFY_TAB_DRAGSTART = 'tab-dragstart';
const kTSTAPI_NOTIFY_TAB_DRAGENTER = 'tab-dragenter';
const kTSTAPI_NOTIFY_TAB_DRAGEXIT  = 'tab-dragexit';
const kTSTAPI_NOTIFY_TAB_DRAGEND   = 'tab-dragend';
const kTSTAPI_ADD_TAB_STATE        = 'add-tab-state';
const kTSTAPI_REMOVE_TAB_STATE     = 'remove-tab-state';
const kTSTAPI_CONTEXT_MENU_OPEN       = 'fake-contextMenu-open';
const kTSTAPI_CONTEXT_MENU_CREATE     = 'fake-contextMenu-create';
const kTSTAPI_CONTEXT_MENU_UPDATE     = 'fake-contextMenu-update';
const kTSTAPI_CONTEXT_MENU_REMOVE     = 'fake-contextMenu-remove';
const kTSTAPI_CONTEXT_MENU_REMOVE_ALL = 'fake-contextMenu-remove-all';
const kTSTAPI_CONTEXT_MENU_CLICK      = 'fake-contextMenu-click';
