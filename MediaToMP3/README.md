# Media to MP3 (Android)

Convert local video/audio files you own (or are authorized to use) to MP3 on your phone,
save them to `Music/MediaToMP3/`, and play them with the built-in player.

- **Kotlin**, minSdk 26 (Android 8.0), targetSdk 36, applicationId `com.example.mediatomp3`
- **FFmpeg** via FFmpegKit (`io.github.maitrungduc1410:ffmpeg-kit-audio`, libmp3lame) — extracts the first audio
  stream and encodes MP3 at 128 / 192 / 320 kbps. Inputs: MP4, MKV, MOV, AVI, WEBM, M4A, WAV, AAC, FLAC, OGG, MP3, …
- **Storage**: MediaStore + `RELATIVE_PATH` on Android 10+ (no storage permission needed), public Music folder on 8/9
- **Player**: foreground `MediaPlayer` service with `MediaSession` → notification + lock-screen controls
  (play / pause / stop / seek), keeps playing when you leave the app; pauses on headphone unplug / audio focus loss
- **UI**: dark (#090909) / neon green, plain Android views (no AndroidX)
- No downloading from YouTube or other sites, no DRM circumvention — local files only.

## Build

The build does not use the Android Gradle Plugin; `app/build.gradle.kts` drives
aapt2 → Kotlin → D8 → zipalign → apksigner directly, so it only needs a small toolchain:

```bash
tools/bootstrap-sdk.sh          # once: platform jars, D8, aapt2/zipalign/apksigner
./gradlew assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk` (signed with `app/debug.keystore`).
A prebuilt copy is kept in `dist/app-debug.apk`.

## Install on a phone

1. Copy `app-debug.apk` to the phone (USB, Google Drive, e-mail, …) or run `adb install -r app-debug.apk`.
2. Open it from the Files app; allow "Install unknown apps" for that app when Android asks.
3. Tap **Install**. The APK contains ARM libraries (arm64-v8a / armeabi-v7a) — all normal phones.
