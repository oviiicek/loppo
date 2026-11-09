#!/bin/bash
# Builds the Android app for Google Play: the web game, copied into the Capacitor project, then the bundle (.aab, what
# Google Play takes) and an APK (to install on a phone and try). Both are signed with the upload key from
# android/keystore.properties (never in the repository; see store/GOOGLE_PLAY.md).
#   bash tools/android.sh            → android/app/build/outputs/bundle/release/app-release.aab
#                                      android/app/build/outputs/apk/release/app-release.apk
# Needs Java 21 and the Android SDK (ANDROID_HOME, or /opt/android-sdk with platform 36 and build-tools 36 from
# sdkmanager). Maven Central sometimes answers "too many requests" to a fresh build: the build is tried again.
set -e
cd "$(dirname "$0")/.."
export ANDROID_HOME=${ANDROID_HOME:-/opt/android-sdk}
[ -d "$ANDROID_HOME/platforms" ] || { echo "Android SDK not found in $ANDROID_HOME"; exit 1; }
[ -f android/keystore.properties ] || echo "warning: android/keystore.properties is missing – the release build will not be signed"
npm run build > /dev/null
npx cap sync android > /dev/null
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
for attempt in 1 2 3 4 5; do
  if ./gradlew --no-daemon --max-workers=2 -Dorg.gradle.internal.repository.max.retries=12 -Dorg.gradle.internal.repository.initial.backoff=5000 bundleRelease assembleRelease > build-android.log 2>&1; then
    ls -la app/build/outputs/bundle/release/app-release.aab app/build/outputs/apk/release/app-release.apk
    exit 0
  fi
  echo "build attempt $attempt failed, trying again in a minute (see android/build-android.log)"
  sleep 60
done
tail -30 build-android.log
exit 1
