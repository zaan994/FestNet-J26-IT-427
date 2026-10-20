# FestNet — Smart Wearable Mesh Network Device for Festival Crowd Safety Monitoring

SLIIT IT4010 Research Project · **J26-IT-427** · Supervisor: Ms. Thisara Shyamalee · Co-supervisor: Ms. Poorna Panduwawala

FestNet is a wearable band (ESP32 + sensors) for festival attendees. The band uploads **raw**
sensor data to Firebase; a trusted backend derives health information, an operator dashboard
serves event staff, and a Flutter app serves attendees.

> **Research prototype — not a medical device.** The Health Risk Indicator (HRI) is experimental
> and unvalidated; it is not a diagnosis and never replaces medical staff. Demo data is labelled
> **DEMO ONLY**.

## Components & ownership

| # | Component | Owner | Backend | Dashboard | Mobile |
|---|---|---|---|---|---|
| C1 | Real-Time Health Monitoring | Rizvi M.Z.M. (IT23305564) | `health/`, `hri/`, `services/` | Live Health, Band detail, HRI Analytics | My Health, HRI explanation |
| C2 | Emergency Alert System | Manubasha K.D.C. (IT23282322) | `services/emergencies.ts` (shared with C1) | Emergency Command | SOS |
| C3 | Location & Crowd Tracking | Pemarathna P.A.J. (IT23378452) | `triggers/crowd.ts` | Crowd Monitoring | Map |
| C4 | Hydration & Wellness | Bandara W.M.T.N. (IT23377158) | `triggers/wellness.ts` | Heat & Wellness, Reports | Wellness |

## Repository layout
```
Firmware/   Arduino sketch (raw uploader; docs/FestNet_ESP32_Firmware_v0_3_1.ino is the current reference)
Backend/    database.rules.json · functions/ (shared contract, C1 processing, HRI, trusted services, tests)
            scripts/ (admin CLI, local worker, band simulator)
Dashboard/  React + Vite + TypeScript + Tailwind operator dashboard
MobileApp/  Flutter attendee app
docs/       architecture, database schema, research method, setup guides
```

## Documentation
* Architecture, roles, workflows, scaling: [docs/architecture/overview.md](docs/architecture/overview.md)
* Data contract: [docs/database/schema.md](docs/database/schema.md)
* C1 method, HRI and evaluation plan: [docs/research/c1-health-monitoring.md](docs/research/c1-health-monitoring.md)
* Privacy: [docs/privacy.md](docs/privacy.md)
* Setup: [Backend](docs/setup/backend.md) · [Dashboard](docs/setup/dashboard.md) · [Mobile](docs/setup/mobile.md) · [Firmware](docs/setup/firmware.md)

## Quick start (PowerShell)
```powershell
cd Backend\scripts;  npm install;  npm run admin config;  npm run admin role email=<you> role=deviceAdmin
npm run admin demo email=<you>       # optional DEMO ONLY data
npm run worker                       # trusted backend (or deploy Cloud Functions)
# new terminal
cd Dashboard;  npm install;  npm run dev
```

## Status (C1 v2)
| Part | State |
|---|---|
| Firmware | v0.3.1 raw uploader (`latest` + 2-s PPG/IMU chunks), no on-band health calculation |
| Backend | rules with 5 roles + per-event isolation, trusted request queues, C1 processor, explainable HRI, assignments + claim codes, SOS/HRI lifecycle + audit, research export; unit + emulator tests written |
| Dashboard | 7 C1/shared pages, light/dark palette, QR workflow |
| Mobile | 6 attendee screens, claim-code linking, press-and-hold SOS, light/dark palette |
| Validation | **not yet performed** — see the evaluation plan |
