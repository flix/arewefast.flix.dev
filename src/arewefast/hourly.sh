#!/bin/bash
set -e

rm -rf /home/flix/build/flix
rm -rf /home/flix/build/benchmark_build

cd /home/flix/build/

/usr/bin/git clone -q https://github.com/flix/flix.git

cd /home/flix/build/

mkdir -p /home/flix/build/log

/usr/bin/node /home/flix/build/index.js localhost flix flix build &> /home/flix/build/log/build.log
/usr/bin/node /home/flix/build/index.js localhost flix flix test &> /home/flix/build/log/test.log
/usr/bin/node /home/flix/build/index.js localhost flix flix throughput &> /home/flix/build/log/throughput.log
/usr/bin/node /home/flix/build/index.js localhost flix flix phases &> /home/flix/build/log/phases.log
/usr/bin/node /home/flix/build/index.js localhost flix flix incremental &> /home/flix/build/log/incremental.log
/usr/bin/node /home/flix/build/index.js localhost flix flix codesize &> /home/flix/build/log/codesize.log
/usr/bin/node /home/flix/build/index.js localhost flix flix memory &> /home/flix/build/log/memory.log
/usr/bin/node /home/flix/build/index.js localhost flix flix commits &> /home/flix/build/log/commits.log
/usr/bin/node /home/flix/build/index.js localhost flix flix benchmarks &> /home/flix/build/log/benchmarks.log

rm -rf /tmp/flix-package-*
