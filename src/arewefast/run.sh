#!/usr/bin/fish

cd /home/flix/build

# Clean
rm -rf /home/flix/build/flix

# Current time
set NOW (date '+%s')

# Git Clone
set GIT_B (date '+%s')
git clone https://github.com/flix/flix.git
set GIT_D (date '+%s')
set GIT_E (math $GIT_D - $GIT_B)
mysql -D flix -e "INSERT INTO build (task, time, duration) VALUES('clone', FROM_UNIXTIME($NOW), $GIT_E)"

# Change Directory
cd /home/flix/build/flix

# Gradle Build
set GRADLE_BUILD_B (date '+%s')
./gradlew classes testClasses
set GRADLE_BUILD_D (date '+%s')
set GRADLE_BUILD_E (math $GRADLE_BUILD_D - $GRADLE_BUILD_B)
mysql -D flix -e "INSERT INTO build (task, time, duration) VALUES('build', FROM_UNIXTIME($NOW), $GRADLE_BUILD_E)"

# Gradle Test
set GRADLE_TEST_B (date '+%s')
./gradlew test
set GRADLE_TEST_D (date '+%s')
set GRADLE_TEST_E (math $GRADLE_TEST_D - $GRADLE_TEST_B)
mysql -D flix -e "INSERT INTO build (task, time, duration) VALUES('test', FROM_UNIXTIME($NOW), $GRADLE_TEST_E)"

# --Xbenchmark-phases
./gradlew run -q --args="--Xbenchmark-phases" > data.csv
mysql -D flix -e "LOAD DATA LOCAL INFILE 'data.csv' INTO TABLE phase FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' SET time = NOW()"

# --Xbenchmark-throughput
./gradlew run -q --args="--Xbenchmark-throughput" > data.csv
mysql -D flix -e "LOAD DATA LOCAL INFILE 'data.csv' INTO TABLE throughput FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n' SET time = NOW()"
