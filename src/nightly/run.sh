#!/usr/bin/fish

cd /home/flix/nightly

rm -rf /home/flix/nightly/flix

git clone https://github.com/flix/flix.git

cd /home/flix/nightly/flix

./gradlew jar

cp build/libs/flix.jar /srv/www/flix.dev/wwwroot/nightly/flix-(date -I).jar

cp build/libs/flix.jar /srv/www/flix.dev/wwwroot/nightly/flix-latest.jar
