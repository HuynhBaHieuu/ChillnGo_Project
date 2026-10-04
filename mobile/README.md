# ChillnGo — Mobile

Flutter app for Android and iOS. It has every screen of the web app, laid out
for phones:

- Newsfeed, Discover (search, regions, interests) and the welcome page.
- Journeys: read, write and edit (days, stops, maps, photos), drafts, clone, merge.
- Check-ins, profiles, follows and notifications.
- Livestreams: go live, watch, comment, react, rewind, replays.
- Your Activity, and the admin area for staff accounts.

It talks to the same API as the web (`../server`). Like the web, it still reads
seed journeys, likes, comments and bookmarks from JSON fixtures:
`assets/mocks/` is a copy of `web/src/mocks/`, so copy them again when those change.

## Requirements

- Flutter 3.47 (Dart 3.13) or newer.
- Android Studio with the Flutter and Dart plugins, and an emulator or a phone
  with USB debugging. The first build downloads Android SDK Platform 37 if it is missing.
- iOS only: a Mac with Xcode and CocoaPods.

## Running it with `npm run dev`

From the project root, `npm run dev` starts the API, the web app and this app
together. For the app it:

1. Uses an Android phone connected over USB (with USB debugging on), or an
   emulator that is already open. On a phone it also runs
   `adb reverse tcp:4000 tcp:4000`, so the app reaches the API.
2. Otherwise opens the first emulator of Android Studio's Device Manager and
   waits for it to start. The emulator stays open after Ctrl+C.
3. Runs `flutter run`, with `--dart-define-from-file=.env` when `mobile/.env` exists.

Type `r` then Enter in that terminal to hot-reload, `R` then Enter to restart.

| Variable | Use |
| --- | --- |
| `CHILLNGO_AVD` | The emulator to open, by its name in `emulator -list-avds`. |
| `CHILLNGO_DEVICE` | The device to use when several are connected, by its serial in `adb devices`. |

**Memory.** The emulator takes 2.5 to 5 GB, and the Android build takes a few
more. On a 16 GB computer that is close to the limit, and running out once
froze the whole computer. So the script:

- Does not open an emulator with less than 4 GB free. Close apps or connect a phone.
- Stops the mobile app, but not the server and web, if free memory stays under 0.7 GB.

What helps:

- Use a phone over USB, which costs the computer almost nothing.
- Use a lighter emulator, such as Android 15 "Google APIs" without the Play Store.
- Close apps you are not using.
- In VS Code, stop the Java extension from importing `mobile/android`, which
  otherwise starts about 3 GB of Gradle processes. Add
  `"java.import.gradle.enabled": false` and `"gradle.autoDetect": "off"` to
  `.vscode/settings.json`, then reload the window.

## Running it from Android Studio

1. Start the API: `npm run dev` in `../server` (port 4000).
2. In Android Studio, open the `mobile/` folder (File > Open). Do not open
   `mobile/android`, which is only the Android part.
3. Run `flutter pub get`, or click "Pub get" in the banner.
4. Optional: copy `.env.example` to `.env` and fill in what you have. Then in
   Run > Edit Configurations > main.dart, set Additional run args to
   `--dart-define-from-file=.env`.
5. Pick a device and press Run.

From a terminal: `flutter run --dart-define-from-file=.env`.

## Reaching the API

| Device | Default address | What to do |
| --- | --- | --- |
| Android emulator | `http://10.0.2.2:4000` | Nothing: 10.0.2.2 is the computer. |
| Android phone on USB | `http://localhost:4000` | Run `adb reverse tcp:4000 tcp:4000`, again after each reconnect. |
| Phone on Wi-Fi | — | Use `http://<computer's LAN address>:4000`, in `.env` or in the app. |
| iOS simulator | `http://localhost:4000` | Nothing. |

To change the address on the phone itself, use Menu > "Máy chủ API", or the
link under the login form. The app checks `/api/health` before saving it.

Android allows plain `http` so the API can run on your computer during
development. A production API should use `https`.

## Configuration (`.env`)

| Key | Used for | Without it |
| --- | --- | --- |
| `API_URL` | The API's address. | The defaults above. |
| `WEB_URL` | Shared links point to the website. | Shared links open the app (`chillngo://app/...`). |
| `MAPBOX_TOKEN` | Map tiles, place search, road routes. Same as the web's `VITE_MAPBOX_TOKEN`. | OpenStreetMap tiles, no place search, no road routes. |
| `GOOGLE_WEB_CLIENT_ID` | Google sign-in. Same as the server's `GOOGLE_CLIENT_ID`. | No Google button. |
| `GOOGLE_IOS_CLIENT_ID` | Google sign-in on iOS. | No Google button on iOS. |

## Google sign-in

The phone asks Google for a token addressed to the Web client, so the server
accepts it with no change. Google also requires the app itself to be registered:

1. In the Google Cloud project that holds the server's `GOOGLE_CLIENT_ID`, create
   an OAuth client of type **Android**:
   - Package name: `vn.chillngo.chillngo`.
   - SHA-1: the fingerprint of the key that signs the app. For debug builds, get it with
     `keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android`.
     Each computer has its own debug key, so add one fingerprint per developer.
2. Set `GOOGLE_WEB_CLIENT_ID` to the **Web** client id, not the Android one.
3. iOS:
   - Create an **iOS** client for bundle id `vn.chillngo.chillngo` and put it in `GOOGLE_IOS_CLIENT_ID`.
   - Add its reversed id (`com.googleusercontent.apps.…`) as a second URL scheme
     under `CFBundleURLTypes` in `ios/Runner/Info.plist`.

## iPhone without a Mac

Apple only builds iPhone apps on macOS, so the build runs on GitHub's Macs and
the install runs on Windows:

1. GitHub > Actions > "iOS app (.ipa)" > Run workflow
   (`.github/workflows/ios-ipa.yml`). After 10 to 15 minutes, download
   `ChillnGo-ios` from the run's Artifacts and unzip it to get `ChillnGo.ipa`.
2. On Windows, install iTunes and iCloud from apple.com (not the Microsoft
   Store versions), then [Sideloadly](https://sideloadly.io).
3. Plug in the iPhone, drop `ChillnGo.ipa` on Sideloadly and sign in with your
   Apple ID. It signs and installs the app.
4. On the iPhone: Settings > Privacy & Security > Developer Mode on, then
   Settings > General > VPN & Device Management > trust your Apple ID.
5. In the app, Menu > "Máy chủ API": `http://<the computer's Wi-Fi address>:4000`
   (`ipconfig` shows it), with the phone on the same Wi-Fi.

With a free Apple ID the app opens for 7 days, then install it again (AltStore
instead of Sideloadly can renew it over Wi-Fi), and at most 3 such apps fit at
once. An Apple Developer membership (99 USD a year) makes it last a year.

Optional settings for this build (Mapbox, Google sign-in, API address) come
from repository secrets: `MOBILE_MAPBOX_TOKEN`, `MOBILE_API_URL`,
`MOBILE_WEB_URL`, `MOBILE_GOOGLE_WEB_CLIENT_ID`, `MOBILE_GOOGLE_IOS_CLIENT_ID`
(GitHub > Settings > Secrets and variables > Actions).

## Email links

Verification emails link to the website (`APP_URL` on the server). On the
phone, either open that link, or paste the link or its token into
"Xác nhận email" in the app.

The app also opens `chillngo://app/<path>` links, for example
`chillngo://app/posts/<id>`. To test one on Android:

```bash
adb shell am start -a android.intent.action.VIEW -d "chillngo://app/live"
```

## Livestreams

- Livestreams need LiveKit set up on the server.
- Rewind and replays also need the recording storage (see `../server/README.md`).
- The app asks for the camera and microphone on the "Bắt đầu livestream" screen.
- The emulator's camera is a virtual scene, so test with a real phone.
- Picking a replay cover from a frame of the video works on Android only
  (`MainActivity.kt`). On iOS, upload a photo instead.

## Checks

```bash
flutter analyze
flutter test                 # unit tests in test/
flutter build apk --debug    # build/app/outputs/flutter-apk/app-debug.apk
```

Release builds are still signed with the debug key (`android/app/build.gradle.kts`).
Set up an upload key before publishing to Google Play.

## Project layout

```
lib/
  main.dart, app.dart   start-up, theme, session refresh on resume
  router.dart           every route and the sign-in / staff redirects
  core/                 theme, config, formatting, maps and photo helpers
  data/                 API client, models, mock fixtures, services
  state/                Riverpod providers: session, feed, notifications
  ui/                   shared widgets: buttons, fields, sheets, cards
  features/             one folder per area: feed, discover, post, editor, map,
                        checkin, livestream, profile, itinerary, activity,
                        admin, auth, menu, notifications, welcome
assets/mocks/           fixtures copied from web/src/mocks
android/, ios/          native projects
test/                   unit tests
```

`data/services/` mirrors `web/src/services/`, one service per web service, so
a change on one side is easy to find on the other.

## Troubleshooting

- **"this and base files have different roots"** on Windows: the pub cache and
  the project are on different drives. `android/gradle.properties` already sets
  `kotlin.incremental=false` to avoid it.
- **The app can't reach the API**: check the address under Menu > "Máy chủ API",
  and on a USB phone re-run `adb reverse tcp:4000 tcp:4000`.
- **Google sign-in fails right away**: the Android OAuth client is missing, or
  its SHA-1 doesn't match the key that signed this build.
