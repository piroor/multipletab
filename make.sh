#!/bin/sh

appname=multipletab

cp buildscript/makexpi.sh ./
./makexpi.sh -n $appname -o
rm ./makexpi.sh

