#!/bin/bash
echo -n "0,failure,"
cat /home/iostream/flix/flix*.txt | grep `date -I` | grep -c "failure"
