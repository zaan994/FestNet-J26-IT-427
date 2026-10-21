# C1 v2 — implementation plan (Intelligent Real-Time Health Monitoring)

Scope: the full C1 requirement (operator dashboard, attendee app, assignment/QR workflow,
explainable HRI, trusted backend, security rules, privacy, tests, docs) against firmware
`docs/FestNet_ESP32_Firmware_v0_3_1.ino`.

## Gap analysis of the existing C1 build (commit 80e65f9)

| Requirement | Existing build | Action |
|---|---|---|
| MLX90614 = surface/object temperature | `coreEstC` = skin + 3.5 °C shown as body temp | remove core estimate everywhere; label "surface/object temperature" |
| BPM / SpO2 only when calculated + validated | SpO2 from uncalibrated R-curve shown as a number | BPM shown with quality grade; SpO2 computed only as an experimental internal value, **not displayed** unless `config/hri.spo2.displayEnabled` |
| Explainable, quality-aware, experimental HRI | anomaly rules + severity | new `hri/` engine: score/null, status, confidence, factors, missing inputs, flags, version, `experimental: true` |
| Telemetry bound to active assignment | per-device history | `deviceIndex.currentAssignmentId`; history under `healthHistory/{assignmentId}` |
| No claiming by typing a device ID | "Pair band" by ID | one-time claim token (QR + short code), redeemed server-side |
| Durable SOS lifecycle + audit | log stub | `emergencies/{eventId}/{alertId}` + `emergencyAudit`, device + app SOS, idempotent |
| Roles + per-event isolation | organiser/medical/participant | attendee, eventOperator, medicalResponder (per event), deviceAdmin, researchAdmin (global) |
| Privileged actions server-side | client writes | `commands/{uid}/{id}` queue executed by trusted backend (Cloud Function **or** local worker) |
| Fall from accelerometer | "fall" anomaly | renamed "possible impact"; only contributes with sustained immobility; never an automatic emergency |

## Phases (project stays runnable after each)

1. **Contract** — shared types, telemetry parser (safe for missing/NaN/invalid), paths, roles, rules, theme colours.
2. **Backend** — HRI engine + config, processor v2 (assignment-aware), command handlers (events, devices, participants, assignments, alerts, roles, research export), SOS/claim services, Cloud Function triggers, local worker, unit tests, rules tests.
3. **Dashboard** — event context + connection state; Event Overview, Live Health, Device detail, Emergency Command Centre, Event & Device Management (QR), HRI Analytics, Access & Audit.
4. **Mobile** — claim via QR/code, My Health, HRI explanation, Emergency (press-and-hold SOS with delivery status), My Device, Event info, Privacy & Settings.
5. **Docs** — schema, architecture/data flow, roles & rules, HRI method + evaluation plan, privacy, scaling/cost, README, file list.

## Trusted execution without the Blaze plan

Every privileged operation is a pure-ish TypeScript service taking a `Database` handle.
It runs in two hosts with identical code:

- **Cloud Functions** (`Backend/functions`), when the project is on Blaze.
- **Local worker** (`Backend/scripts`, `npm run worker`), using a service account, for development / demos.

Clients never write privileged state directly. They write *requests*:
`commands/{uid}/{id}`, `sosRequests/{uid}/{id}`, `claimRequests/{uid}/{id}`.
The backend validates them and writes the results back.
