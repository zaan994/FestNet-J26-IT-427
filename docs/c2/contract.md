# Component 2 — Emergency Alert System: integration contract

Owner: Rizvi M.Z.M. (IT23305564), taking over C2 from Manubasha K.D.C.

> Research note: every C2 threshold (`config/c2`) is a provisional prototype value from the C2
> proposal, not a clinically validated rule, and needs supervisor approval before use with real
> attendees. The apps show neutral wording by design; the research status is documented here and in
> code comments.

## 1. How C2 fits C1

```
band ──raw──► C1 processor ──► devices/{id}/health ──► C2 classify ──► device-state transaction
                                     (same host, no extra trigger)       (dedupe · cooldown · upgrade)
band SOS button (latest.sosPressCount) ──┐                                         │
app SOS (sosRequests/{uid})  ────────────┴──► createEmergency (idempotent) ◄────────┘
                                                   │ durable first
                                                   ▼
                                     emergency/openAlerts (escalation queue)
                                     dispatch: recipients → inbox → FCM push → counts/latency/audit
                                                   │
                     escalateDue (every 30 s worker / 1 min Cloud Scheduler) → secondary responders
```

* C2 **consumes** C1's derived `health` record; it never reads raw chunks and never writes into
  `devices/*` (no trigger loops). C1's own HRI-alert draft is no longer used — C2 is the single
  anomaly-alert producer.
* Alerts stay in the existing `emergencies/{eventId}/{alertId}` tree (no competing alert tree).

## 2. Classification (`functions/src/c2/classify.ts`, `config/c2`)

| Input (from C1 `health`) | Rule | Severity |
|---|---|---|
| `hri.hriScore`, only if status ≠ insufficient_data and confidence ≥ medium | ≥ 80 / ≥ 60 / ≥ 40 | critical / danger / warning |
| fallback (no usable HRI): `heartRate.bpm` with quality `valid` | > 160 or < 35 (any activity) | critical |
| | > 140 (rest, light or unknown activity) or < 45 | danger |
| | > 120 (rest or light activity only) | warning |
| SOS (band button or app) | always | critical |

Never used: raw red/IR counts, SpO2 (uncalibrated), MLX90614 object temperature (surface, not core).
Missing, stale (> 30 s), future, not-worn or malformed data → no physiological alert (never 0).
All valid reason codes are kept (`hri_danger`, `hri_factor:<C1 rule>`, `bpm_danger_high`, `manual_sos` …)
together with the contributing values and their timestamps (`contributing`).

## 3. Deduplication policy (`c2/decide.ts`)

* An anomaly must persist for **2 consecutive** results (~4 s) before it alerts.
* **One open anomaly alert per device**: a higher severity **upgrades** that alert (audit
  `severity_upgraded`, notification round `upgrade-<severity>`); same or lower is suppressed.
* After **acknowledgement**, same-or-lower severity anomalies are suppressed for **5 min**.
* Replayed / out-of-order records (`computedAt` not newer) are ignored; a new assignment resets the
  streak and trend history.
* **SOS bypasses all of this**: one alert per press (`sos-dev-{device}-{boot}-{count}`), never
  suppressed by an open anomaly alert or by an acknowledged one.

All decisions run inside a transaction on `emergency/deviceAlertState/{deviceId}`; notification
rounds are claimed with `emergency/dispatchLocks/{alertId}/{phase}` → exactly once per phase.

## 4. Lifecycle

| From | Action | To | Who |
|---|---|---|---|
| open | escalate (timeout 120 s) | escalated | system only |
| open / escalated | acknowledge, assign responder | acknowledged | staff; volunteer for alerts sent to them |
| open / escalated / acknowledged | mark in progress ("on my way") | in_progress | staff; volunteer (own inbox) |
| acknowledged / in_progress | resolve (note required) | resolved | event staff |
| resolved | reopen (note required) | open | event operator |

Identity is the authenticated owner of the command, never a payload field. Acknowledging removes the
alert from `emergency/openAlerts`, so it is never escalated afterwards. Replayed telemetry never
reopens anything.

**Escalation timing:** a periodic runner escalates between the timeout and timeout + interval
(worker: 2:00–2:30; Cloud Scheduler: 2:00–3:00). Exact timing would need a per-alert delayed task
(Cloud Tasks).

## 5. Routing (`c2/dispatch.ts`, `c2/routing.ts`)

| Phase | Recipients |
|---|---|
| initial / upgrade | medical responders + event operators; **volunteers** for danger/critical only, when the band fix is ≤ 60 s old and the volunteer is on duty, has a location ≤ 120 s old and is within **50 m** (Haversine) |
| escalation | secondary responders; if none, the medical team (+ operators) |
| `_unassigned` event | device administrators |

## 6. Records

| Path | Writer | Readers |
|---|---|---|
| `emergencies/{eventId}/{alertId}` (+ severity, reasonCodes, contributing, receivedAt, dispatchStartedAt, dispatchedAt, latencyFromReceiptMs, sourceToDispatchMs, escalationLevel, escalatedAt, escalationDueAt, notified, upgradedFrom) | backend | event staff |
| `emergency/openAlerts/{alertId}` (escalation queue, `.indexOn escalationDueAt`) | backend | nobody |
| `emergency/deviceAlertState/{deviceId}` | backend | nobody |
| `emergency/dispatchLocks`, `emergency/recipients` | backend | nobody |
| `emergency/dispatch/{eventId}/{alertId}/{id}` | backend | event staff |
| `emergency/inbox/{uid}/{alertId}` (minimal: severity, type, status, summary, location, role) | backend | that user |
| `emergency/watch/{eventId}/{deviceId}` | backend | event staff |
| `emergency/responders/{uid}` (onDuty, lat, lng, accuracyM, locationUpdatedAt, tokens) | that user (validated) | that user + backend |
| `eventVolunteers/{eventId}/{uid}`, `volunteerEvents/{uid}/{eventId}` | backend | operator / that user |
| `config/c2` | deviceAdmin | signed-in users |

Volunteers are **not** event staff: they cannot read alerts, health, participants or dispatch logs —
only their own inbox.

## 7. Timestamps and latency

* `measuredAt` — band measurement / press time (device NTP clock; null when not synced).
* `receivedAt` — server time the trigger reached the alert service.
* `createdAt` — server time the alert was written.
* `dispatchStartedAt` / `dispatchedAt` — first notification round start / send call returned.
* `latencyFromReceiptMs = dispatchedAt − receivedAt` (same server clock) — the reported metric.
* `sourceToDispatchMs = dispatchedAt − measuredAt` — only when the band clock is synced.
* "accepted by FCM" ≠ delivered ≠ seen; only acknowledgement proves a responder saw it.

## 8. Push payload

`notification {title: "CRITICAL · SOS · FESTNET_001", body: first reason}` and
`data {alertId, eventId, deviceId, severity, source (sos|anomaly), phase, ts, url}` — no participant
identity, no health values. Apps fetch details with their own permissions.

## 9. Predictive watch (`c2/predict.ts`)

Least-squares trend over the last C1 scores (≥ 8 points over ≥ 60 s, residual ≤ 8): when the score is
still below the warning cut-off but projects above it within 5 min, the device is listed in
`emergency/watch/{eventId}`. Nobody is notified; it is a heads-up in the Emergency Command Centre.

## 10. Manual fallback

If the cloud connection fails: the band OLED/buzzer and staff radios remain the primary channel;
the dashboard shows "Offline — data may be outdated" and every unacknowledged alert stays visible
with its age. Operators should brief staff to radio the control point for any SOS seen on site.
