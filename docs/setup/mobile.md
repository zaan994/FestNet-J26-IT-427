# Mobile app setup (Flutter)

For participants and volunteers.

## One-time setup

The repo contains `lib/`, `test/` and `pubspec.yaml`. The platform folders (`android/`, `ios/`, …) are
generated on your machine:

```bash
# Prerequisites: Flutter SDK (stable), Firebase CLI (npm i -g firebase-tools), then:
dart pub global activate flutterfire_cli

cd MobileApp
flutter create . --org lk.sliit.festnet --project-name festnet --platforms android,ios
flutterfire configure --project festnetproject      # generates lib/firebase_options.dart
flutter pub get
flutter run
```

`flutter create .` does not overwrite existing files in `lib/`. The generated `lib/firebase_options.dart`,
`google-services.json` and `GoogleService-Info.plist` are gitignored, so every member runs
`flutterfire configure` once.

The first time you commit after `flutter create`, include the generated `android/` and `ios/`
folders so teammates get the same native project (one member does this, then everyone pulls).

Android: set `minSdkVersion 23` in `android/app/build.gradle` if the build asks for it (Firebase requirement).

## Structure

```
lib/
├── main.dart, app.dart
├── core/           config, constants (DB paths, thresholds), errors, routing (go_router), theme, utils
├── models/         DeviceLatest, UserProfile, enums — mirrors docs/database/schema.md
├── services/       AuthService, DatabaseService (thin Firebase wrappers)
├── repositories/   UserRepository (profile, pairing), DeviceRepository (live band data)
├── providers/      Riverpod providers (auth, profile, paired band, clock)
├── shared/         widgets, dialogs, extensions
└── features/       one folder per area — work inside your own
    ├── authentication/     shared — login / register
    ├── home/               shared — bottom navigation shell
    ├── profile_settings/   shared — profile, pair band
    ├── health_monitoring/  C1 — live vitals
    ├── health_analysis/    C1 — history charts
    ├── emergency/          C2
    ├── festival_location/  C3
    └── heat_wellness/      C4
```

## Flow

Register (participant) → Profile → **Pair band** (e.g. `FESTNET_001`; it must exist in `deviceIndex/`) →
the Health tab shows the band's live status.

## Tests

```bash
flutter test
flutter analyze
```
