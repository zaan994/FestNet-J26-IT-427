# FestNet — Realtime Database Schema (shared contract, v2)

Single source of truth for data shared by the four components. Mirrors (update in the **same** PR):
`Backend/functions/src/shared/schema.ts` (types), `shared/paths.ts` (paths),
`MobileApp/lib/models/*.dart`, `MobileApp/lib/core/constants/db_paths.dart`, `Backend/database.rules.json`.

All data lives under `/festnet`. RTDB drops `null`: every nullable field is also optional and
readers must treat missing values as **unavailable**, never as 0.

## 1. Writers

| Writer | Writes |
|---|---|
| **Band** (firmware v0.3.1, own `deviceAuth` account) | `devices/{id}/latest`, `devices/{id}/raw/{push}` (write-once), `devices/{id}/meta` |
| **Trusted backend** (Cloud Functions or `npm run worker`, admin SDK) | everything derived, every privileged change, all audit entries |
| **Staff client** (dashboard) | only `commands/{uid}/{id}` (request queue) |
| **Attendee client** (app) | `users/{uid}` (displayName/email/createdAt only), `sosRequests/{uid}/{id}`, `claimRequests/{uid}/{id}` |
| **Admin CLI** (service account) | bootstrap: roles, config, `deviceAuth`, demo data |

## 2. Tree

```
festnet/
  config/thresholds           {deviceOfflineAfterSec: 15, gpsStaleAfterSec: 60}
  config/hri                  partial HriConfig override (experimental; see shared/hriConfig.ts)

  roles/{uid}/{deviceAdmin|researchAdmin} = true          global roles (backend only)
  eventStaff/{eventId}/{uid} = eventOperator|medicalResponder
  staffEvents/{uid}/{eventId} = role                        reverse index
  users/{uid}                 {displayName, email?, createdAt?}  — no health data, no role

  deviceAuth/{bandAuthUid} = deviceId
  devices/{deviceId}/
    latest                    raw telemetry (§3)        band
    raw/{pushId}              ~2 s PPG/IMU chunk (§3)   band, deleted after 5 min
    meta                      fwVersion, lastBootTs, rawPpgFs, rawImuFs, rawChunkMs
    health                    derived health + HRI (§4) backend
  processing/{deviceId}       processor state           backend only (no client access)

  deviceIndex/{deviceId}      inventory: label, inventoryStatus (available|assigned|maintenance|retired),
                              currentAssignmentId/EventId/ParticipantId, zone, notes, demo
  events/{eventId}            {eventId, name, status: planned|active|closed, venue, startTs, endTs, demo, zones, createdAt, createdBy}
  eventsPublic/{eventId}      {name, status, demo, helpPoints, safetyInfo[], contact, privacyContact, dataRetention}
  participants/{eventId}/{participantId}
                              {participantId "P-XXXXXXXX", eventId, demo, researchConsent, consentRecordedAt,
                               attendeeUid?, activeAssignmentId?, createdAt, createdBy}   — pseudonymous, no PII
  assignments/{assignmentId}  {assignmentId, deviceId, participantId, eventId, status: active|returned|cancelled,
                               startedAt, startedBy, endedAt, endedBy, returnCondition, note, zone, demo, claimCodeHash}
  eventAssignments/{eventId}/{assignmentId}   {deviceId, participantId, status, startedAt, endedAt}   index
  claimCodes/{sha256(code)}   {assignmentId, eventId, expiresAt (15 min), createdBy, usedAt, usedBy, revoked}
  attendeeLinks/{uid}         {participantId, eventId, deviceId, assignmentId, linkedAt}

  healthHistory/{assignmentId}/{push}   10-s snapshot (§4)   — keyed by ASSIGNMENT, never mixed
  assignmentStats/{assignmentId}        running counters for analytics

  emergencies/{eventId|_unassigned}/{alertId}   (§5)
  emergencyAudit/{eventId}/{alertId}/{push}     {action, by, at, fromStatus, toStatus, note}
  emergencyKeys/{idempotencyKey}                backend only

  commands/{uid}/{commandId}    {type, payload, createdAt} → backend adds {status: ok|error, result, error, processedAt}
  sosRequests/{uid}/{requestId} {clientCreatedAt, createdAt} → backend adds {status, alertId, eventId, alertStatus, error}
  sosRequests/{uid}/_active     backend pointer to the open app SOS (repeat presses fold into it)
  claimRequests/{uid}/{id}      {code, createdAt} → backend adds {status: linked|rejected, error}

  auditLog/{eventId|global}/{push}   {action, by, at, target, details}   backend only
  researchExports/{exportId}         consented, de-identified rows (researchAdmin)
```

## 3. Firmware contract (v0.3.1)

`devices/{id}/latest`: `deviceId, fwVersion, online (always true — NOT freshness), ts (NTP ms or
missing), serverTs, uptimeMs, sosActive, sosPressCount, sensors{oled, mlx90614, max30102, mpu6050,
gps (current fix)}, pulseRaw{red, ir} (ADC counts — never BPM/SpO2), temperature{objectC (SURFACE),
ambientC}, motion{ax..gz}, gps{fix, latitude, longitude, satellites, speedMps, headingDeg,
altitudeM, hdop}, battery{pct: null — not measured}, net{transport, rssi}, raw{enabled, lastSeq,
pendingChunks, droppedChunks, ppgOverflowTotal, lastChunkPpgSamples, lastChunkImuSamples,
lastChunkDurationMs}`.

`devices/{id}/raw/{push}`: `seq, t0 (NTP or missing), t0UptimeMs, durationMs, serverTs,
ppg{fs:100, n, overflow, red[], ir[]}, imu{fs:50, n, ax[]…gz[] (null = failed read)},
temperature{objectC, ambientC}, sosActive, sosPressCount`.

All readers go through `shared/telemetry.ts → parseLatest` (or the Dart equivalent): out-of-range
values become null, GPS location only with a fix and non-(0,0) coordinates, freshness from receive
time (`live < 15 s ≤ stale < 120 s ≤ offline`).

## 4. Derived health

`devices/{id}/health` (`DeviceHealth`): `assignmentId, eventId, participantId, seq, measuredAt,
receivedAt, computedAt, worn, heartRate{bpm, quality, beats, method}, spo2{value, quality,
validated:false, displayEnabled, note}, hrv{rmssdMs, sdnnMs, ibiCount, windowSec, quality},
temperature{surfaceC, ambientC, surfaceBaselineC}, activity{level, magG, stillSec, impactDetected},
signal{perfusionIndex, ppgSamples, ppgExpected, imuSamples, imuExpected, ppgOverflow, flags[],
clockSynced}, hri (HriResult), latency{processingMs, endToEndMs}`.

Clients must ignore a `health` record whose `assignmentId` differs from the current assignment.

`HriResult`: `hriScore (0–100 | null), status (insufficient_data|low|elevated|high),
confidence{level, value}, calculatedAt, window, availableInputs[], missingInputs[],
contributingFactors[{ruleId, label, points, value, threshold, unit, detail}], dataQuality{flags[],
notes[]}, baselineAvailable, algorithmVersion, configVersion, experimental: true, validated: false`.

`healthHistory/{assignmentId}/{push}`: `ts, serverTs, deviceId, eventId, worn, bpm, bpmQuality,
rmssdMs, surfaceC, ambientC, activity, hriScore, hriStatus, confidence, flagCount`.
Indexed on `ts`; clients query a time window + `limitToLast`.

## 5. Emergencies

`Emergency`: `alertId, idempotencyKey, type (sos|hri), source (device_button|attendee_app|hri_engine),
priority (P1 SOS | P2 HRI), status (open → acknowledged → in_progress → resolved; resolved → open by
reopen), eventId, deviceId, assignmentId, participantId, reasons[], createdAt, measuredAt,
location{latitude, longitude, fixAt, source:"band_gps"} | null, hri{score, status, confidence},
acknowledgedBy/At, responder{uid, name, assignedAt}, resolution{note, by, at}, review{label, note, by, at},
requiresHumanReview, origin{uid, requestId}, repeatCount, demo, updatedAt`.

Idempotency keys: device SOS `sos-dev-{deviceId}-{bootTs}-{pressCount}`; app SOS
`sos-app-{uid}-{requestId}`; HRI `hri-{assignmentId}-{floor(time / cooldown)}` (one per cooldown window).

## 6. Indexes (`database.rules.json`)
`raw: seq, serverTs` · `assignments: endedAt, status, eventId` · `eventAssignments/{e}: status, startedAt` ·
`healthHistory/{a}: ts` · `emergencies/{e}: status, createdAt, type`.

## 7. Migration from the foundation build
`npm run admin migrate` converts legacy `users/{uid}/role` (organiser/medical) into
`roles` / `eventStaff`, and fills `deviceIndex` inventory fields. Legacy `devices/{id}/history` and
`alerts/` are no longer written.
