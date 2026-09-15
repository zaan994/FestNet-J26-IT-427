# FestNet — Realtime Database Schema (shared contract)

This file is the **single source of truth** for data shared between the four components.
If you change a field here, update all mirrors in the **same** pull request:

| Layer | Mirror file |
|---|---|
| Firmware (Arduino IDE sketch) | `Firmware/` — the JSON built in `uploadToFirebase()` |
| Backend / Dashboard (TS) | `Backend/functions/src/shared/schema.ts` (Dashboard imports it via the `@shared` alias) |
| Mobile (Dart) | `MobileApp/lib/models/*.dart`, `MobileApp/lib/core/constants/*.dart` |
| Example payload | `tests/test_data/sample_latest.json` |

**Apps must tolerate missing fields.** The band firmware grows component by component, so
every reader treats any field not marked ✅ below as optional.

Conventions:
- All data lives under the root node **`/festnet`**.
- Timestamps are **epoch milliseconds (UTC)**. `ts` = device clock (NTP). `serverTs` = Firebase server time (`{".sv":"timestamp"}`). Use `serverTs` to decide whether a band is online.
- Missing / unavailable numeric values are written as `null`, never `0` or `NaN`.
- Enums are lowercase strings.

## Tree

```
/festnet
├── config/
│   └── thresholds              runtime-tunable thresholds (organiser writes)
├── deviceAuth/{authUid}        -> "FESTNET_001"  maps a band's Firebase login to its device node
├── deviceIndex/{deviceId}      { label, addedAt }  list of bands (lets apps list bands without downloading history)
├── devices/{deviceId}/
│   ├── latest                  band writes every 2 s            (owner: C1, all read)
│   ├── history/{pushId}        band writes snapshot every 10 s  (owner: C1)
│   ├── location/{pushId}       GPS trail every 10 s             (owner: C3, reserved)
│   └── meta                    firmware version, owner, event   (shared)
├── users/{uid}                 profile + role                    (shared)
├── alerts/{alertId}            alert lifecycle                   (created by band/C1/SOS, owned by C2)
├── events/{eventId}/           event + zones + crowd analytics   (owner: C3)
└── wellness/{uid}/             hydration log, heat stress, reports (owner: C4)
```

## `devices/{deviceId}/latest`

Written as a whole object (`set`) every `LATEST_UPLOAD_INTERVAL_MS` (2 s).

| Field | Type | Unit / values | Owner | Notes |
|---|---|---|---|---|
| `deviceId` | string | `FESTNET_001` | shared | |
| `fwVersion` | string | semver | shared | |
| `online` | bool | | shared | always `true` when written; staleness via `serverTs` |
| `ts` | number\|null | epoch ms | shared | `null` until NTP sync |
| `serverTs` | number | epoch ms | shared | Firebase server value |
| `uptimeMs` | number | ms | shared | |
| `sosActive` | bool | | C2 | SOS button currently pressed / latched |
| `sensors` | object | `{oled, mlx90614, max30102, mpu6050, gps}` bools | shared | sensor detected at boot |
| `pulseRaw` | object | `{red, ir}` raw ADC counts | C1 | debug / signal quality |
| `vitals.contact` | bool | | C1 | finger/skin contact detected on MAX30102 |
| `vitals.bpm` | number\|null | beats/min | C1 | |
| `vitals.spo2` | number\|null | % | C1 | |
| `vitals.hrv.rmssdMs` | number\|null | ms | C1 | |
| `vitals.hrv.sdnnMs` | number\|null | ms | C1 | |
| `vitals.stress.score` | number\|null | 0–100 | C1 | |
| `vitals.stress.level` | string | `unknown \| low \| medium \| high` | C1 | |
| `temperature.objectC` | number\|null | °C | C1 | MLX90614 object (skin) |
| `temperature.ambientC` | number\|null | °C | C1 | MLX90614 die/ambient |
| `temperature.coreEstC` | number\|null | °C | C1 | estimated core temperature (skin + offset) |
| `motion.ax/ay/az` | number | m/s² | C1 | |
| `motion.gx/gy/gz` | number | deg/s | C1 | |
| `motion.magG` | number | g | C1 | acceleration magnitude |
| `motion.state` | string | `unknown \| active \| still \| fall` | C1 | |
| `motion.stillSec` | number | s | C1 | |
| `gps.fix` | bool | | C3 | |
| `gps.latitude` / `gps.longitude` | number\|null | deg | C3 | |
| `gps.satellites` | number | | C3 | |
| `gps.speedMps` | number\|null | m/s | C3 | |
| `gps.headingDeg` | number\|null | deg | C3 | |
| `anomaly.active` | bool | | C1 | |
| `anomaly.severity` | string | `none \| warning \| danger \| critical` | C1 | |
| `anomaly.types` | string[] | see *Anomaly types* | C1 | |
| `anomaly.since` | number\|null | epoch ms | C1 | |
| `anomaly.latencyUs` | number\|null | µs | C1 | detection latency (research metric) |
| `battery.pct` | number\|null | % | shared | `null` until a fuel gauge is fitted |
| `net.transport` | string | `wifi \| espnow` | shared | |
| `net.rssi` | number\|null | dBm | shared | |

See `tests/test_data/sample_latest.json` for a full example.

### Anomaly types
`bpm_spike`, `low_spo2`, `high_temp`, `stillness`, `fall`, `sos`

### Severity
`none` < `warning` < `danger` < `critical`

## `devices/{deviceId}/history/{pushId}`
Compact snapshot, every `HISTORY_UPLOAD_INTERVAL_MS` (10 s). Indexed on `ts`.
```json
{ "ts": 1760000000000, "bpm": 82, "spo2": 98, "rmssdMs": 41.2, "stressScore": 35,
  "objectC": 34.1, "coreEstC": 37.6, "motionState": "active", "severity": "none" }
```

## `devices/{deviceId}/meta`
```json
{ "fwVersion": "0.1.0", "lastBootTs": 1760000000000, "ownerUid": "<participant uid>|null",
  "eventId": "demo-event", "label": "Band 1" }
```

## `deviceAuth/{authUid}`
String value = the deviceId this Firebase account may write. Created by `Backend/scripts` (`npm run admin -- device ...`).

## `deviceIndex/{deviceId}`
```json
{ "label": "Band 1", "addedAt": 1760000000000 }
```
Written by organisers (dashboard → Event Overview → "Add band") or by the admin script.
Never subscribe to the whole `devices/` node: it contains every band's history.

## `users/{uid}`
```json
{ "name": "Jane", "email": "jane@x.com", "role": "participant",
  "deviceId": "FESTNET_001", "fcmToken": null, "createdAt": 1760000000000 }
```
Roles: `participant` (self-registers) · `volunteer` · `medical` · `organiser` (assigned by an organiser / admin script).
"Staff" = `organiser` or `medical`.

## `alerts/{alertId}`
Created by the band (C1 anomaly onset or SOS press). Lifecycle fields are owned by C2.
```json
{
  "deviceId": "FESTNET_001",
  "source": "anomaly",              // anomaly | sos | manual
  "types": ["bpm_spike", "high_temp"],
  "severity": "danger",
  "status": "open",                 // open | acknowledged | escalated | resolved
  "createdAt": 1760000000000,       // device ts (may be null) — prefer serverCreatedAt
  "serverCreatedAt": 1760000000123,
  "vitals": { "bpm": 131, "spo2": 96, "coreEstC": 38.4, "stressScore": 78 },
  "location": { "latitude": 6.9147, "longitude": 79.9729 },   // or null
  "ack": null,                      // C2: { "by": uid, "at": ms }
  "escalation": null,               // C2: { "level": 1, "at": ms }
  "dispatch": null                  // C2: dispatch log
}
```

## `config/thresholds`
Defaults mirror the TAF and `Firmware/include/config.h`.
```json
{
  "bpmSpikeDelta": 30, "bpmSpikeWindowSec": 90,
  "spo2Low": 94, "spo2Critical": 90,
  "coreTempHighC": 38.0, "stillnessTimeoutSec": 30,
  "alertEscalationSec": 120, "volunteerRadiusM": 50,
  "surgeSpeedMps": 1.5, "surgeZoneRadiusM": 20, "surgeMinBands": 5,
  "deviceOfflineAfterSec": 15
}
```

## `events/{eventId}` (C3 — reserved)
```json
{ "name": "Demo Festival", "startTs": 0, "endTs": 0,
  "center": { "latitude": 6.9147, "longitude": 79.9729 },
  "zones": { "{zoneId}": { "name": "Main Stage", "type": "stage", "polygon": [{ "latitude": 0, "longitude": 0 }] } } }
```
Zone types: `stage | exit | first_aid | toilet | water | other`.

## `wellness/{uid}` (C4 — reserved)
```
wellness/{uid}/hydrationLog/{pushId}  { ts, ml }
wellness/{uid}/heatStress/{pushId}    { ts, index, tier }   // tier: low | moderate | high | critical
wellness/{uid}/reports/{eventId}      post-event report
```
