# Contributing to FestNet

## Branches

- `main` — always working. No direct pushes; merge through pull requests.
- One feature branch per piece of work, prefixed with your component:
  - `feature/c1-<topic>` — Health Monitoring (Rizvi)
  - `feature/c2-<topic>` — Emergency Alerts (Manubasha)
  - `feature/c3-<topic>` — Location & Crowd (Pemarathna)
  - `feature/c4-<topic>` — Hydration & Wellness (Bandara)
  - `chore/<topic>` / `docs/<topic>` — shared work

## Work inside your own folders

Each component has its own folders (see the ownership table in [README.md](README.md)). Stay in
them where you can, so the four of you rarely edit the same file.

## Shared contract changes need team review

These files are used by everyone. Change them only in a PR that **at least one other member reviews**:

| File | Why |
|---|---|
| `docs/database/schema.md` | the data contract |
| `Backend/functions/src/shared/*` | TS mirror of the contract (Functions, Dashboard, scripts) |
| `MobileApp/lib/models/*`, `MobileApp/lib/core/constants/*` | Dart mirror of the contract |
| `Backend/database.rules.json` | security rules for the whole database |
| `tests/test_data/sample_latest.json` | reference payload |
| The firmware upload JSON | what every app reads |

Adding a field? Update `schema.md`, the TS types, the Dart model and the sample payload **in the
same PR**. Make new fields optional so older firmware keeps working.

## Secrets

Never commit:
- Wi-Fi passwords, Firebase account passwords (keep them in the firmware's `secrets.h`, which is gitignored)
- `serviceAccount*.json`, `.env`, `.env.local`
- `google-services.json`, `GoogleService-Info.plist`, `MobileApp/lib/firebase_options.dart`

Check `git status` before every commit. If a secret was committed, tell the team and **rotate it** — deleting the file doesn't remove it from git history.

## Commit messages

`<component>: <what changed>`, for example `c1: add HRV RMSSD calculation` or `shared: add gps.speedMps to schema`.
