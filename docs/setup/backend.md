# Backend setup (Firebase)

Firebase project: **`festnetproject`** (RTDB `https://festnetproject-default-rtdb.firebaseio.com`).

## Prerequisites

- Node.js 22
- Firebase CLI: `npm install -g firebase-tools`, then `firebase login`

## Layout

```
Backend/
├── firebase.json            emulator + deploy config
├── .firebaserc              default project = festnetproject
├── database.rules.json      RTDB security rules (all components)
├── functions/               Cloud Functions (TypeScript)
│   └── src/
│       ├── shared/          ← data contract: schema types, paths, thresholds, geo (pure TS)
│       ├── config/          runtime config (region, DB instance)
│       ├── repositories/    typed admin-SDK data access
│       ├── triggers/        one file per component: health / alerts / crowd / wellness
│       └── index.ts         exports all triggers
└── scripts/                 admin CLI + band simulator (run locally)
```

## Admin CLI & simulator (`Backend/scripts`)

```bash
cd Backend/scripts
npm install
cp .env.example .env        # then set GOOGLE_APPLICATION_CREDENTIALS or the emulator hosts
```

Service account key: Firebase console → Project settings → Service accounts → *Generate new
private key*. Save it as `Backend/scripts/serviceAccount.json` (gitignored). **Never commit it.**

```bash
npm run admin config                                          # thresholds + demo event
npm run admin user email=you@x.com password=****** name=You role=organiser
npm run admin device id=FESTNET_001 email=<band account email>
npm run admin list

npm run process                                               # C1 health processor (local)
npm run simulate                                              # 3 healthy virtual bands
npm run simulate bands=8 scenario=bpm-spike                   # band SIM_001 spikes after 20 s
npm run simulate bands=10 scenario=crowd-walk                 # everyone walks east at ~1.8 m/s
```

> **Use `key=value` options** — they work in every shell, including Windows PowerShell:
> `npm run admin user email=you@x.com password=****** name=You role=organiser`
> `npm run admin device id=FESTNET_001 email=<band account email>`
> `npm run simulate bands=5 scenario=bpm-spike`   ·   `npm run process device=FESTNET_001`
> (`npm run admin -- user --email ...` also works in Git Bash / cmd, but PowerShell swallows the
> bare `--`, npm then eats the `--flags`, and the script reports `Missing email`.)

### C1 health processor (`npm run process`)

The band uploads only raw signals. `npm run process` turns each raw chunk into
`devices/{id}/health`, `history` and `alerts`. It runs the same code as the `processRawChunk`
Cloud Function, but on your machine, so you don't need the Blaze plan. Keep it running while you
use the dashboard or app, and **don't run it while the Cloud Function is deployed** (both would
process every chunk). It also deletes raw chunks older than 5 minutes.

### Simulator

The simulator writes exactly what the real band writes (`latest` + `raw`, with synthetic
PPG / IMU / temperature signals). Run it together with `npm run process` (or the deployed
function) to see computed health data.

Scenarios: `normal | bpm-spike | heatstroke | low-spo2 | fall | sos | no-contact | crowd-walk`.

## Security rules

```bash
cd Backend
firebase deploy --only database
```

⚠ **Before the first deploy**, run `npm run admin -- device ...` for every real band (see
[firmware.md](firmware.md)) and create at least one organiser. Otherwise the band can no longer
write, and nobody can open the dashboard.

## Cloud Functions

Cloud Functions require the **Blaze** (pay-as-you-go) plan. Without it, use `npm run process` for C1.

```bash
cd Backend/functions
npm install
npm run build
npm test              # includes the C1 algorithm tests (synthetic signals)
firebase deploy --only functions
```

| Function | Component | Trigger |
|---|---|---|
| `processRawChunk` | C1 | every new `devices/{id}/raw/{chunk}`. Runs one at a time (`maxInstances: 1`) so chunks are processed in order |
| `pruneHealthHistory` | C1 | hourly; deletes history older than 24 h |
| `onAlertCreated` | C2 (stub) | every new `alerts/{id}` |

## Local emulators (optional)

```bash
cd Backend
firebase emulators:start          # Auth :9099, RTDB :9000, Functions :5001, UI :4000
```

Point the scripts at the emulators (`.env` option B), the dashboard with `VITE_USE_EMULATORS=true`.
