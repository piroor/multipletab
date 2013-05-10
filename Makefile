PACKAGE_NAME = multipletab

.PHONY: all xpi clean

all: xpi

xpi: buildscript/makexpi.sh
	cp buildscript/makexpi.sh ./
	./makexpi.sh -n $(PACKAGE_NAME) -o
	rm ./makexpi.sh

buildscript/makexpi.sh:
	git submodule update --init

clean:
	rm multipletab.xpi multipletab_noupdate.xpi sha1hash.txt
