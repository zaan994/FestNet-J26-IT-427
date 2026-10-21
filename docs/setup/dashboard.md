# Dashboard setup (React + Vite + TypeScript)

For event operators, medical responders, device administrators and research administrators.

```powershell
cd Dashboard
npm install
Copy-Item .env.example .env.local   # fill in the Firebase web app config (placeholders only in git)
npm run dev                         # http://localhost:5173
npm test                            # display-rule tests (vitest + Testing Library)
npm run build                       # type-check + production build
```

Privileged buttons only work while the trusted backend runs (`npm run worker` in
`Backend/scripts`, or the deployed Cloud Functions) — see [backend.md](backend.md).

## Signing in
Any account with a staff role can sign in: `deviceAdmin` / `researchAdmin` (global) or
`eventOperator` / `medicalResponder` (per event). Bootstrap the first admin with the CLI
(`npm run admin role email=... role=deviceAdmin`), then manage everything else from the UI.

## Pages

| Page | Who | What |
|---|---|---|
| Event Overview | event staff | live vs historical counts, recent emergencies |
| Live Health (C1) | event staff | filterable / sortable / paginated table: valid BPM only, SpO2 "Not validated", surface temp, activity, HRI + confidence, freshness, GPS freshness, SOS |
| Band detail (C1) | event staff | derived values, HRI explanation, trends (10 min / 1 h / 6 h, current assignment only), sensors detected vs valid, signal & upload counters |
| Emergency Command | event staff (deviceAdmin: unassigned bucket) | SOS P1 before HRI P2, acknowledge / assign / in progress / resolve / reopen with notes, HRI review labels, audit trail |
| Event & Devices | operator / deviceAdmin | QR assignment workflow, return / cancel, one-time claim codes, participants (pseudonymous, consent), inventory, event status, attendee info, staff |
| HRI Analytics (C1) | event staff / researchAdmin | data quality per assignment, review-label summary, active rule set, de-identified research export (CSV) |
| Access & Audit | deviceAdmin / operator | global roles, audit log |

The whole UI is scoped to the event chosen in the top bar; nothing subscribes across events.

## Structure
```
src/
├── app/                 App providers + router
├── hooks/               useAuth (roles), useEventContext, useEventData (bounded queries),
│                        useEventDevices (live rows), useCommand, useConnection
├── services/commands.ts queues privileged requests for the backend
├── components/common/   Badges, States, InfoTip, Pagination, Qr, StatTile, SegmentedControl …
├── components/health/   Metrics (display rules), HriPanel
├── features/            overview, live_health, device_detail, emergency_command, management,
│                        hri_analytics, access_audit (+ C3/C4 placeholders)
└── utils/               format, deviceRow (pure, tested)
```
The data contract is imported from `Backend/functions/src/shared` via the `@shared` alias.
Colours are CSS-variable tokens (`src/styles/index.css`) for light and dark mode.
