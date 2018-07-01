NPM_MOD_DIR := $(CURDIR)/node_modules
NPM_BIN_DIR := $(NPM_MOD_DIR)/.bin

.PHONY: xpi install_dependency lint format update_extlib install_extlib

all: xpi

install_dependency:
	npm install

lint:
	$(NPM_BIN_DIR)/eslint . --ext=.js --report-unused-disable-directives

format:
	$(NPM_BIN_DIR)/eslint . --ext=.js --report-unused-disable-directives --fix

xpi: update_extlib install_extlib lint
	rm -f ./*.xpi
	zip -r -0 multipletab-we.xpi manifest.json common resources background panel options _locales >/dev/null 2>/dev/null

update_extlib:
	cd .. && git submodule update --init

install_extlib:
	cp ../extlib/webextensions-lib-tab-id-fixer/TabIdFixer.js common/
	cp ../extlib/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js common/
	cp ../extlib/webextensions-lib-rich-confirm/RichConfirm.js common/
	cp ../extlib/webextensions-lib-menu-ui/MenuUI.js common/
	cp ../extlib/webextensions-lib-configs/Configs.js common/
	cp ../extlib/webextensions-lib-options/Options.js options/
	cp ../extlib/webextensions-lib-l10n/l10n.js common/
	cp ../extlib/webextensions-lib-shortcut-customize-ui/ShortcutCustomizeUI.js options/
