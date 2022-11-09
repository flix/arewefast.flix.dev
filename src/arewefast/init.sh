#!/usr/bin/env bash

# create a local mysql database called `flix`
mysql -e "CREATE DATABASE flix"

# run the table making script
mysql "flix" < ./tables.sql