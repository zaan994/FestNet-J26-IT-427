# Mobile app setup (Flutter)

Attendee app (research prototype).

## One-time setup (PowerShell)
```powershell
# Prerequisites: Flutter SDK (stable), Firebase CLI (npm i -g firebase-tools)
dart pub global activate flutterfire_cli

cd MobileApp
flutter create . --org lk.sliit.festnet --project-name festnet --platforms android,ios   # only if android/ is missing
flutterfire configure --project festnetproject      # generates lib/firebase_options.dart (gitignored)
flutter pub get
flutter test
flutter run
```
* Android: `minSdkVersion 23` in `android/app/build.gradle` if asked (Firebase / camera).
* iOS: add `NSCameraUsageDescription` to `ios/Runner/Info.plist` (claim-code scanner).
* `firebase_options.dart`, `google-services.json` and `GoogleService-Info.plist` are gitignored.

## Screens
| Tab | Screen | Notes |
|---|---|---|
| My Health | live derived values | "Not available yet" instead of fabricated values; valid BPM only; SpO2 "Not validated"; surface temperature labelled as not body temperature; freshness; signal quality |
| My Health → Explain | HRI explanation | trend (10 m / 1 h / 6 h), factors, inputs used / missing, confidence, disclaimer |
| SOS | emergency | press-and-hold 2 s; works without a band and offline (queued); shows delivery and staff status |
| My Device | link band | scan or type the **one-time claim code** from staff (never a device ID); sensors detected; freshness |
| Event | event & safety | help points, safety info, contact (eventsPublic); links to C3 map / C4 wellness placeholders |
| Privacy | privacy & settings | what is stored and who sees it, display name, theme |

The app only writes `users/{uid}` (displayName / email / createdAt), `sosRequests` and
`claimRequests`; everything else is read-only and limited by the security rules to the account's
own band, assignment and event.

## Structure
```
lib/
├── core/        config (freshness rule, disclaimer), constants (paths, labels), routing, theme, utils (display rules)
├── models/      DeviceLatest, DeviceHealth/HriResult/HistoryPoint, AttendeeLink, EventPublicInfo, SosRequestStatus
├── repositories/DeviceRepository, AttendeeRepository (claim, SOS), UserRepository
├── providers/   Riverpod providers (link, band, health for current assignment, history, event, SOS, connection)
├── shared/      status widgets, section card, logo, theme selector
└── features/    health_monitoring, health_analysis (HRI), emergency, device, event_info, profile_settings, C3/C4 placeholders
```
