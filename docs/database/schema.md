# FestNet — Realtime Database Schema (shared contract)

This file is the **single source of truth** for data shared between the four components.
If you change a field here, update all mirrors in the **same** pull request:

| Layer | Mirror file |
|---|---|
| Firmware (Arduino IDE sketch) | `Firmware/festnet_band/festnet_band.ino` — `uploadLatest()`, `uploadNextRawChunk()` |
| Backend / Dashboard (TS) | `Backend/functions/src/shared/schema.ts` (Dashboard imports it via the `@shared` alias) |
| Mobile (Dart) | `MobileApp/lib/models/*.dart`, `MobileApp/lib/core/constants/*.dart` |
| Example payload | `tests/test_data/sample_latest.json` |

**Apps must tolerate missing fields.** Older firmware or a missing sensor can leave fields
out, so every reader treats fields as optional and shows "—" for them.

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
│   ├── latest                  BAND writes every 2 s: current reading of every sensor (raw)
│   ├── raw/{pushId}            BAND writes every 2 s: full-rate signal chunk (PPG 100 Hz, IMU 50 Hz)
│   ├── health                  BACKEND writes: computed vitals + anomaly state     (owner: C1)
│   ├── history/{pushId}        BACKEND writes: computed snapshot every 10 s         (owner: C1)
│   ├── location/{pushId}       GPS trail every 10 s                                 (owner: C3, reserved)
│   └── meta                    firmware version, owner, event                       (shared)
├── users/{uid}                 profile + role                    (shared)
├── processing/{deviceId}       BACKEND only: C1 processor state between chunks
├── alerts/{alertId}            alert lifecycle                   (anomaly alerts created by the C1 backend; lifecycle owned by C2)
├── events/{eventId}/           event + zones + crowd analytics   (owner: C3)
└── wellness/{uid}/             hydration log, heat stress, reports (owner: C4)
```

## Data flow

The **band only uploads raw readings**. Every calculation (BPM, SpO2, HRV, stress, core
temperature, fall / stillness, anomalies, alerts) happens in the **backend** (Cloud Functions).
The dashboard and mobile app read only from Firebase and never talk to the band.

```
band ──► devices/{id}/latest, devices/{id}/raw ──► Cloud Functions ──► devices/{id}/health, history, alerts ──► apps
```

## `devices/{deviceId}/latest` — written by the band

The current reading of every sensor. Written as a whole object (`set`) every 2 s, and
immediately when the SOS button is pressed. Firmware: `Firmware/festnet_band/festnet_band.ino` → `uploadLatest()`.

| Field | Type | Unit / values | Notes |
|---|---|---|---|
| `deviceId` | string | `FESTNET_001` | |
| `fwVersion` | string | semver | |
| `online` | bool | | always `true` when written; apps judge staleness themselves |
| `ts` | number\|null | epoch ms | device clock (NTP); `null` until synced |
| `serverTs` | number | epoch ms | Firebase server time |
| `uptimeMs` | number | ms | `millis()` |
| `updatedAtMs` | number | ms | same as `uptimeMs` — kept for older readers |
| `sosActive` | bool | | button held, or pressed within the last 5 s |
| `sosPressCount` | number | | increments on every press since boot — detect presses between uploads |
| `sensors.{oled,mlx90614,max30102,mpu6050,gps}` | bool | | sensor detected at boot (`gps` = valid NMEA received) |
| `pulseRaw.red` / `pulseRaw.ir` | number | 18-bit ADC counts | last MAX30102 sample |
| `temperature.objectC` | number\|null | °C | MLX90614 object = **skin** temperature |
| `temperature.ambientC` | number\|null | °C | MLX90614 ambient |
| `motion.ax/ay/az` | number | m/s² | last MPU6050 sample |
| `motion.gx/gy/gz` | number | deg/s | |
| `gps.fix` | bool | | |
| `gps.latitude` / `gps.longitude` | number\|null | deg | |
| `gps.satellites` | number | | |
| `gps.speedMps` | number\|null | m/s | |
| `gps.headingDeg` | number\|null | deg | course over ground |
| `gps.altitudeM` | number\|null | m | |
| `gps.hdop` | number\|null | | horizontal dilution of precision (lower = better) |
| `battery.pct` | null | % | no fuel gauge fitted yet |
| `net.transport` | string | `wifi \| espnow` | |
| `net.rssi` | number | dBm | |
| `raw.enabled` | bool | | raw chunk upload switched on |
| `raw.lastSeq` | number | | `seq` of the newest chunk produced |
| `raw.pendingChunks` | number | | chunks waiting to upload (offline buffer) |
| `raw.droppedChunks` | number | | chunks lost because the buffer was full |
| `raw.ppgOverflowTotal` | number | | PPG samples lost in the sensor FIFO since boot |

## `devices/{deviceId}/raw/{pushId}` — written by the band

One **2-second chunk of full-rate signals**, pushed every 2 s (~7 KB). The input for all
backend health calculations. Indexed on `seq`. Firmware: `uploadNextRawChunk()`.

```json
{
  "seq": 1520,                       // increments by 1 per chunk; a gap = lost chunk
  "t0": 1760000000000,               // epoch ms of the first sample (null until NTP sync)
  "t0UptimeMs": 3040120,             // millis() of the first sample
  "durationMs": 2000,
  "serverTs": 1760000000180,
  "ppg": {
    "fs": 100,                       // sample rate (Hz); sample i is at t0 + i * 1000 / fs
    "n": 200,
    "overflow": 0,                   // samples lost in the MAX30102 FIFO during this chunk
    "red": [98213, 98220, ...],      // n values, 18-bit ADC counts
    "ir":  [112394, 112380, ...]
  },
  "imu": {
    "fs": 50,
    "n": 100,
    "ax": [0.12, ...], "ay": [...], "az": [...],   // m/s^2
    "gx": [1.2, ...],  "gy": [...], "gz": [...]    // deg/s
  },
  "temperature": { "objectC": 34.21, "ambientC": 29.8 },
  "sosActive": false,
  "sosPressCount": 0
}
```

Notes for backend processing:
- PPG samples are continuous across chunks (read from the sensor FIFO). Concatenate consecutive
  `seq` values for beat detection. Treat a `seq` gap, or `overflow > 0`, as a discontinuity.
- In the raw PPG, systole shows as a **dip** in IR/red counts (more absorption). An IR level
  above ~50 000 suggests skin contact.
- Volume: ~3.5 KB/s ≈ 12 MB/hour per band. **The backend must prune `raw/`** (keep minutes,
  not days). Set `RAW_UPLOAD_ENABLED = false` in the sketch to pause raw uploads.

## `devices/{deviceId}/health` — written by the backend (C1)

Computed per raw chunk (every 2 s) by the C1 health processor
(`Backend/functions/src/health`, run by the `processRawChunk` Cloud Function or
`npm run process`). **This is what the dashboard and the app display.**
Example: `tests/test_data/sample_health.json`.

| Field | Type | Notes |
|---|---|---|
| `deviceId`, `seq` | string, number | `seq` of the analysed raw chunk |
| `ts` | epoch ms | end of the analysed chunk |
| `updatedAt` | epoch ms | server time the record was written |
| `worn` | bool | PPG sensor on skin (median IR ≥ 50 000) |
| `signal.perfusionIndex` | number\|null | pulse amplitude / DC, % — signal quality |
| `signal.beatsInChunk` / `ppgSamples` / `ppgOverflow` | number | |
| `vitals.bpm` | number\|null | median of the last 8 accepted beat intervals |
| `vitals.spo2` | number\|null | ratio-of-ratios, smoothed, **uncalibrated** |
| `vitals.hrv.rmssdMs` / `sdnnMs` | number\|null | over the last 60 s (≥ 10 beats) |
| `vitals.hrv.ibiCount` | number | beats in the HRV window |
| `vitals.stress.score` | number\|null | 0–100 |
| `vitals.stress.level` | string | `unknown \| low \| medium \| high` |
| `vitals.stress.baselineReady` | bool | personal baseline learnt (first 2 min of wear) |
| `temperature.skinC` / `ambientC` | number\|null | smoothed MLX90614 readings |
| `temperature.coreEstC` | number\|null | skin + `skinToCoreOffsetC` (only while worn) |
| `motion.magG` | number\|null | mean acceleration magnitude (g) |
| `motion.state` | string | `unknown \| active \| still \| fall` |
| `motion.stillSec` | number | seconds without movement |
| `anomaly.active` | bool | |
| `anomaly.severity` | string | `none \| warning \| danger \| critical` |
| `anomaly.types` | string[] | missing when empty |
| `anomaly.since` | epoch ms | onset of the current anomaly |
| `latency.processingMs` | number | server receipt of the raw chunk → health written |
| `latency.endToEndMs` | number | end of the chunk on the band → health written |

## `processing/{deviceId}` — backend only

Persisted processor state (signal tails, beat intervals, baselines, anomaly timers) between
chunks. No client access (not in the security rules); only the Admin SDK uses it.

### Anomaly types
`bpm_spike`, `low_spo2`, `high_temp`, `stillness`, `fall`, `sos`

### Severity
`none` < `warning` < `danger` < `critical`

## `devices/{deviceId}/history/{pushId}` — written by the backend (C1)
Compact computed snapshot, every 10 s. Indexed on `ts`.
Kept for 24 h (hourly cleanup).
```json
{ "ts": 1760000000000, "serverTs": 1760000000300, "bpm": 82, "spo2": 98, "rmssdMs": 41.2,
  "stressScore": 35, "skinC": 34.1, "coreEstC": 37.6, "motionState": "active",
  "severity": "none", "worn": true }
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
Anomaly alerts are created by the C1 health processor when severity rises (onset or
escalation). SOS alerts are C2's: detect `latest.sosPressCount` increasing. Lifecycle fields are owned by C2.
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
  "deviceOfflineAfterSec": 15, "skinToCoreOffsetC": 3.5
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
