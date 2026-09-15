# Dashboard setup (React + Vite + TypeScript)

For organisers and the medical team.

```bash
cd Dashboard
npm install
cp .env.example .env.local     # fill in the Firebase web app config
npm run dev                    # http://localhost:5173
```

Web config: Firebase console → Project settings → *Your apps* → Web app (create one if needed).

## Signing in

Only `organiser` and `medical` roles can open the dashboard. Create your account with the admin CLI:

```bash
cd Backend/scripts
npm run admin -- user --email you@x.com --password ****** --name "You" --role organiser
```

## Structure

```
src/
├── app/           App + router (routes for every component)
├── config/        Firebase initialisation
├── constants/     sidebar navigation (shows each page's owner)
├── hooks/         useAuth, useBands (live band list), useRealtimeValue, useNow
├── services/      Firebase access (auth, devices)
├── layouts/       DashboardLayout (sidebar)
├── components/    shared UI: common/, charts/, maps/, tables/, alerts/
├── features/      one folder per area — work inside your own
│   ├── event_overview/       shared — live band table (foundation)
│   ├── live_health/          C1
│   ├── emergency_command/    C2
│   ├── responder_management/ C2
│   ├── crowd_monitoring/     C3 (react-leaflet installed)
│   ├── heat_wellness/        C4
│   └── reports_analytics/    C4
├── types/         re-exports the shared contract + UI view models
└── utils/         formatting helpers
```

The data contract is imported from `Backend/functions/src/shared` through the **`@shared`** alias:

```ts
import { paths } from "@shared/paths";
import type { DeviceLatest } from "@/types";
```

Charts use **Recharts**, maps use **react-leaflet**, and styling uses **Tailwind** (`card`, `btn-primary`
and `input` helpers are in `src/styles/index.css`).
