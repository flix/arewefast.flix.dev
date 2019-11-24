#!/bin/bash
echo -n "0,success,"
cat /home/iostream/flix/flix*.txt | grep `date -I` | grep -c "success"
