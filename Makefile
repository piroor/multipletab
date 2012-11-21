PACKAGE_NAME = multipletab

all: xpi

xpi: buildscript/makexpi.sh
	cp buildscript/makexpi.sh ./
	./makexpi.sh -n $(PACKAGE_NAME)
	rm ./makexpi.sh

buildscript/makexpi.sh:
	git submodule update --init
