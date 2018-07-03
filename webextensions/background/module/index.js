/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

import * as Constants from '../../common/module/constants.js';
import * as Common from '../../common/module/common.js';
import * as Commands from '../../common/module/commands.js';
import TabIdFixer from '../../extlib/TabIdFixer.js';

window.Constants = Constants;
window.Common = Common;
window.Commands = Commands;
window.TabIdFixer = TabIdFixer;

window.log = Common.log;
window.notify = Common.notify;
window.wait = Common.wait;
window.configs = Common.configs;

