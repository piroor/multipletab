/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

import * as Constants from '../../common/constants.js';
import * as Common from '../../common/common.js';
import * as Commands from '../../common/commands.js';
import * as Permissions from '../../common/permissions.js';
import * as DragSelection from '../../common/drag-selection.js';
import MenuUI from '../../extlib/MenuUI.js';
import Options from '../../extlib/Options.js';
import RichConfirm from '../../extlib/RichConfirm.js';
import ShortcutCustomizeUI from '../../extlib/ShortcutCustomizeUI.js';
import TabFavIconHelper from '../../extlib/TabFavIconHelper.js';
import TabIdFixer from '../../extlib/TabIdFixer.js';
import l10n from '../../extlib/l10n.js';
import * as ContextMenu from './context-menu.js';

window.Constants = Constants;
window.Common = Common;
window.Commands = Commands;
window.Permissions = Permissions;
window.DragSelection = DragSelection;
window.MenuUI = MenuUI;
window.Options = Options;
window.RichConfirm = RichConfirm;
window.ShortcutCustomizeUI = ShortcutCustomizeUI;
window.TabFavIconHelper = TabFavIconHelper;
window.TabIdFixer = TabIdFixer;
window.l10n = l10n;
window.ContextMenu = ContextMenu;

window.log = Common.log;
window.notify = Common.notify;
window.wait = Common.wait;
window.configs = Common.configs;

