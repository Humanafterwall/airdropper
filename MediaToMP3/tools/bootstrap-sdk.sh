#!/usr/bin/env bash
# Installs the minimal Android toolchain this project needs into $SDK (default /opt/android-sdk):
#   - platform jars (compile against API 36, link resources against API 34)
#   - D8/R8 (dexer) from Google's R8 release bucket
#   - aapt2, zipalign, apksigner from the distro packages (Debian/Ubuntu)
# Use it where the full Android SDK / Android Gradle Plugin cannot be downloaded.
set -euo pipefail
SDK="${1:-${ANDROID_HOME:-/opt/android-sdk}}"
R8_VERSION="8.13.19"

fetch() { # url out
  for i in 1 2 3 4 5 6; do
    if curl -fsSL -m 600 -o "$2.part" "$1"; then mv "$2.part" "$2"; return 0; fi
    echo "retry $i: $1" >&2; sleep $((i * 5))
  done
  return 1
}

if ! command -v aapt2 >/dev/null || ! command -v zipalign >/dev/null || ! command -v apksigner >/dev/null; then
  sudo_cmd=""; [ "$(id -u)" -ne 0 ] && sudo_cmd="sudo"
  $sudo_cmd apt-get update
  $sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get install -y aapt zipalign apksigner
fi

for api in 34 36; do
  mkdir -p "$SDK/platforms/android-$api"
  [ -s "$SDK/platforms/android-$api/android.jar" ] || \
    fetch "https://raw.githubusercontent.com/Sable/android-platforms/master/android-$api/android.jar" \
          "$SDK/platforms/android-$api/android.jar"
done

mkdir -p "$SDK/build-tools/r8"
[ -s "$SDK/build-tools/r8/r8lib.jar" ] || \
  fetch "https://storage.googleapis.com/r8-releases/raw/$R8_VERSION/r8lib.jar" "$SDK/build-tools/r8/r8lib.jar"

echo "sdk.dir=$SDK" > "$(dirname "$0")/../local.properties"
echo "Android toolchain ready in $SDK"
