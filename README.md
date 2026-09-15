# FestNet — Smart Wearable Mesh Network Device for Festival Crowd Safety Monitoring

SLIIT IT4010 Research Project · **J26-IT-427** · Supervisor: Ms. Thisara Shyamalee · Co-supervisor: Ms. Poorna Panduwawala

FestNet is a wearable band (ESP32 + biometric sensors) that monitors festival attendees and gets
help to them fast. Each band streams health and location data to Firebase. A Flutter app serves
participants and volunteers, and a React dashboard serves organisers and the medical team.

## Components & ownership

| # | Component | Owner | Firmware | Backend | Dashboard | Mobile |
|---|---|---|---|---|---|---|
| C1 | Real-Time Health Monitoring | Rizvi M.Z.M. (IT23305564) | sensors, HR/SpO2/HRV, anomaly detection | `triggers/health.ts` | `features/live_health` | `features/health_monitoring`, `health_analysis` |
| C2 | Emergency Alert System | Manubasha K.D.C. (IT23282322) | SOS button | `triggers/alerts.ts` | `features/emergency_command`, `responder_management` | `features/emergency` |
| C3 | Location & Crowd Tracking | Pemarathna P.A.J. (IT23378452) | GPS | `triggers/crowd.ts` | `features/crowd_monitoring` | `features/festival_location` |
| C4 | Hydration & Wellness | Bandara W.M.T.N. (IT23377158) | — | `triggers/wellness.ts` | `features/heat_wellness`, `reports_analytics` | `features/heat_wellness` |

Shared code is owned by everyone and changes go through team review (see [CONTRIBUTING.md](CONTRIBUTING.md)).

## Repository layout

```
Firmware/     Arduino IDE sketch for the ESP32 band (see docs/setup/firmware.md)
Backend/      Firebase: RTDB security rules, Cloud Functions, admin CLI + band simulator
  functions/src/shared/   ← the shared data contract (types, DB paths, thresholds, geo) used by
                            Functions, Dashboard (@shared alias) and scripts
Dashboard/    React + Vite + TypeScript + Tailwind organiser / medical dashboard
MobileApp/    Flutter app (Riverpod + go_router) for participants & volunteers
docs/         Architecture, database schema, hardware wiring, setup guides
tests/        Integration tests and shared test data (sample payloads)
```

## Where to start

1. Read the data contract: [docs/database/schema.md](docs/database/schema.md)
2. Read the architecture overview: [docs/architecture/overview.md](docs/architecture/overview.md)
3. Set up the part you work on:
   [Backend](docs/setup/backend.md) · [Dashboard](docs/setup/dashboard.md) · [Mobile](docs/setup/mobile.md) · [Firmware](docs/setup/firmware.md)
4. No hardware? Run the band simulator (`Backend/scripts`, `npm run simulate`) to stream realistic data.

## Status

| Part | State |
|---|---|
| Firmware | Single-band sketch reading all sensors and uploading to `/festnet/devices/FESTNET_001/latest` |
| Backend | Rules, shared contract, functions skeleton, admin CLI, simulator |
| Dashboard | Login + role guard, layout, Event Overview (live band table), placeholders for C1–C4 |
| Mobile | Login/register, bottom-nav shell, band pairing, band status, placeholders for C1–C4 |

> **Prototype only — not a certified medical or safety device.** Thresholds and values may differ in real-world testing.
