#!/usr/bin/env bash

# Takes a directory and other `find` parameters
# and returns the number of lines in files
# matching the description.

# For example:
# $ ./countLines.sh ./myDir -name '*.flix'

set -e

find "$@" -exec cat {} + | wc --lines