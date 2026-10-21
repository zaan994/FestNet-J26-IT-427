# C2 — responder flow (mobile app + dashboard)

## Roles
| Role | Granted by | Where they work |
|---|---|---|
| Medical responder | operator / deviceAdmin (`setEventStaff`, `role=medicalResponder`) | dashboard + app Respond tab |
| Secondary responder | `role=secondaryResponder` | dashboard + app (receives escalations) |
| Volunteer | `role=volunteer` (stored in `eventVolunteers`, not event staff) | app Respond tab only |
| Event operator | `role=eventOperator` | dashboard (+ app) |

```powershell
npm run admin staff email=vol1@example.com event=<eventId> role=volunteer
npm run admin staff email=sec1@example.com event=<eventId> role=secondaryResponder
```

## App (Flutter) — what it does
1. On sign-in, `staffEvents/{uid}` + `volunteerEvents/{uid}` decide whether the **Respond** tab is shown.
2. Push registration: permission → FCM token → `emergency/responders/{uid}/tokens/{key}`
   (`{token, platform, updatedAt: server time}`); refreshed tokens replace the old one; sign-out
   removes this phone's token and sets `onDuty: false`.
3. On-duty switch → `emergency/responders/{uid}/onDuty`. While on duty and the app is open, the
   position is written at most every 20 s (`lat, lng, accuracyM, locationUpdatedAt`).
   Background location is not collected.
4. Alerts list = `emergency/inbox/{uid}` (minimal data). Actions are commands
   (`commands/{uid}/{id}`): `acknowledgeAlert`, `markAlertInProgress` ("On my way"), and for event
   staff `resolveAlert` with a note. Directions open Google Maps.
5. Tapping a notification opens the Respond tab.

## Dashboard
* **Emergency Command** — all alerts of the event, severity / source / status / band filters,
  escalation and upgrade badges, trigger values, notification counts and rounds, latency, audit
  trail, watch list, outcome review for health alerts.
* **My Response** — duty switch, browser location sharing, web push on/off, alerts sent to me.
* Header badge with the number of unacknowledged alerts; foreground pushes appear as a banner.

## Setup
* Web push: create a Web Push key pair (Firebase console → Project settings → Cloud Messaging) and set
  `VITE_FIREBASE_VAPID_KEY` in `Dashboard/.env.local`.
* Android: permissions are in `android/app/src/main/AndroidManifest.xml` (location, notifications,
  camera). iOS additionally needs `NSLocationWhenInUseUsageDescription`, `NSCameraUsageDescription`
  and push capability with an APNs key uploaded to Firebase.
* The backend sends pushes from the worker (`npm run worker`) or the Cloud Functions — no client ever
  holds FCM credentials.

## Verification status
Automated tests use a fake sender. Real delivery (phone locked, browser tab closed) must be checked on
the target devices and recorded in `docs/TEST-RESULTS.md`.
