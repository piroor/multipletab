PACKAGE_NAME = multipletab

.PHONY: all xpi

all: xpi

xpi:
	cd webextensions && $(MAKE)
	cp webextensions/$(PACKAGE_NAME)*.xpi ./

