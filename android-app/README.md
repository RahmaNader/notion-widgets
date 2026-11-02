# Multi Timer for Android

The Multi Timer widget packaged as an Android app with [Capacitor](https://capacitorjs.com). It uses the same code as `../multi-timer`, plus a small native bridge (`../multi-timer/js/native.js`) that only runs inside the app.

## Install on your phone
1. On the phone, open **https://github.com/RahmaNader/notion-widgets/releases/latest** and download **MultiTimer.apk**.
2. Open the downloaded file. The first time, Android asks you to allow installing apps from your browser (or Files); allow it, then tap **Install**.
3. Open Multi Timer and tap **Turn on** in the banner (or Settings → Alert settings → Alarm notifications) so alarms ring when the app is closed. Allow notifications and, if asked, **Alarms & reminders**.
4. If alarms arrive late on your phone: Android Settings → Apps → Multi Timer → Battery → **Unrestricted**.

**Updating:** each change to `multi-timer/` or `android-app/` on `master` builds a new release. Install the new APK over the old one; your timers are kept.

**Moving boards from the browser widget:** in the browser, Menu → Export boards (.mt); send the file to your phone; in the app, Menu → Import spreadsheet / CSV and pick the file.

## What's different from the web widget
- **Data** is stored in the app (and mirrored to Android's app preferences), so it stays until you uninstall the app or clear its data. Use Export boards (.mt) for backups.
- **Alarms** ring when the app is closed or the phone is locked: when the app goes to the background it schedules exact Android alarms for every running timer (including each interval/pomodoro step and count-up milestone). Notifications have **Stop** and **+1 min** buttons. While the app is open, the in-app alarm rings instead.
- **Keep screen on**, vibration, the back button and the status bar use native Android features.
- **Exports** (.mt, Excel, history) open the Android share sheet, so you can save them to Files, Drive, email…
- Works offline: fonts, icons, styles and the Excel library are bundled.

## Build it yourself
GitHub Actions builds it (`.github/workflows/android.yml`). Locally you need Node 22, JDK 21 and the Android SDK (platform 36):

```bash
cd android-app
npm ci
node build-web.mjs        # copies ../multi-timer into www/ with offline assets
npx cap sync android
cd android && ./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk
```

## Signing (one-time setup)
Android only installs an update over an existing app when both are signed with the same key, so the app has its own private signing key. It is never stored in this repository; GitHub Actions reads it from two repository secrets:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_B64` | the keystore file, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |

Optional: `ANDROID_KEY_ALIAS` (default `multitimer`) and `ANDROID_KEY_PASSWORD` (default: same as the keystore password).

Add them under GitHub → repository **Settings → Secrets and variables → Actions → New repository secret**, then run the workflow again (Actions → Multi Timer Android app → Run workflow). Until the secrets exist, CI still builds the APK to check it, but does not publish a release.

To create a new key yourself: `keytool -genkeypair -keystore multitimer.jks -alias multitimer -keyalg RSA -keysize 2048 -validity 15000`, then `base64 -w0 multitimer.jks` for the first secret. Keep a copy of the keystore somewhere safe: losing it means future versions can't update the installed app (you'd have to export your boards, uninstall, and reinstall).
