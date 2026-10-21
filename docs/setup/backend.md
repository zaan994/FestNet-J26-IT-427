# Backend setup (Firebase)

Firebase project: **`festnetproject`** (RTDB `https://festnetproject-default-rtdb.firebaseio.com`).

## Prerequisites
- Node.js 22
- Firebase CLI: `npm install -g firebase-tools`, then `firebase login`
- A service-account key for the scripts (Firebase console → Project settings → Service accounts →
  *Generate new private key*) saved as `Backend/scripts/serviceAccount.json` (gitignored). **Never commit it.**

## Layout
```
Backend/
├── database.rules.json   RTDB security rules + indexes (roles, per-event isolation, request queues)
├── functions/src/
│   ├── shared/           data contract: schema, paths, thresholds, telemetry parser, HRI config
│   ├── health/           C1 signal processing + processor + store
│   ├── hri/              explainable HRI engine (pure)
│   ├── services/         trusted services: events, devices, participants, assignments, claims,
│   │                     emergencies, research export, roles, command executor, audit
│   ├── triggers/         Cloud Functions wiring (health.ts, alerts.ts)
│   └── config/runtime.ts region / DB instance / service context
├── functions/test/       unit tests + emulator tests (rules, services)
└── scripts/              admin CLI, local worker, band simulator
```

## First-time setup (PowerShell)
```powershell
cd Backend\scripts
npm install
Copy-Item .env.example .env          # GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json

npm run admin config                                             # thresholds + HRI config (experimental)
npm run admin user email=you@example.com password=<choose> name=You
npm run admin role email=you@example.com role=deviceAdmin       # global role
npm run admin device id=FESTNET_001 email=<band account email>  # map the band's login to its device ID
npm run admin migrate                                           # only if you used the foundation build
npm run admin list
```
Then create events, register bands and grant event roles from the dashboard (Event & Devices,
Access & Audit) or with `npm run admin staff email=... event=<eventId> role=eventOperator`.

> Use `key=value` options — they work in PowerShell (a bare `--` is swallowed by PowerShell).

## Running the trusted backend

**Option A — without Blaze (local worker):**
```powershell
cd Backend\scripts
npm run worker      # C1 processing + command / SOS / claim queues + device SOS. Keep it running.
```
**Option B — Blaze plan (Cloud Functions):**
```powershell
cd Backend\functions
npm install
npm run build
firebase deploy --only functions
```
Run **one** of them. Dashboard actions show "No response from the FestNet backend" if neither runs.

| Function | Trigger |
|---|---|
| `processRawChunk` | new `devices/{id}/raw/{chunk}` (in order, `maxInstances: 1`) |
| `pruneHealthHistory` | hourly |
| `onCommandCreated` | new `commands/{uid}/{id}` |
| `onSosRequestCreated` | new `sosRequests/{uid}/{id}` |
| `onClaimRequested` | new `claimRequests/{uid}/{id}` |
| `onDeviceSosPressed` | `devices/{id}/latest/sosPressCount` changed |
| `escalateAlerts` | every minute (Cloud Scheduler) — C2 escalation |

The worker does the same, plus C2 escalation every 30 s. Push notifications are sent with FCM from
whichever host runs (free on the Spark plan); `npm run worker push=off` stores alerts without pushing.

## C2 roles and latency
```powershell
npm run admin staff email=medic@example.com event=<eventId> role=medicalResponder
npm run admin staff email=backup@example.com event=<eventId> role=secondaryResponder
npm run admin staff email=vol@example.com event=<eventId> role=volunteer
npm run latency runs=30 label=worker      # with the worker running; appends to docs/TEST-RESULTS.md
```
Optional overrides of the C2 thresholds: `festnet/config/c2` (see `functions/src/shared/c2Config.ts`).

## Demo data (DEMO ONLY)
```powershell
npm run admin demo email=you@example.com       # DEMO ONLY event, participants, SIM bands, you as operator
npm run simulate bands=5 scenario=normal       # with the worker running
npm run simulate bands=5 scenario=bpm-spike    # also: heatstroke, low-spo2, fall, sos, no-contact, crowd-walk
```
Demo events, bands and participants are flagged `demo: true` and labelled DEMO ONLY in both apps.

## Security rules
```powershell
cd Backend
firebase deploy --only database
```
⚠ Before the first deploy: map every real band in `deviceAuth` (`npm run admin device ...`) and grant
yourself `deviceAdmin`, otherwise the band cannot write and nobody can open the dashboard.

## Tests
```powershell
cd Backend\functions
npm install
npm test                 # unit tests: telemetry parser, HRI engine, processor, workflow blockers
npm run test:emulator    # needs Java + Firebase CLI: security rules + services against the RTDB emulator
```
