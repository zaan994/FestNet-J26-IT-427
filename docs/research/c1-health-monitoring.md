# Component 1 — Real-Time Health Monitoring: method and evaluation plan

Owner: Rizvi M.Z.M. (IT23305564)

> **Status: research prototype.** Nothing in this component is clinically validated. The Health
> Risk Indicator (HRI) is an *experimental, explainable* indicator for research. It is **not** a
> diagnosis and must never replace assessment by medical staff. No accuracy figures are claimed in
> this document; §6 describes how they will be measured.

Code: `Backend/functions/src/health/` (signal processing), `Backend/functions/src/hri/engine.ts`
(HRI), `Backend/functions/src/shared/hriConfig.ts` (all HRI numbers), tests in
`Backend/functions/test/`.

## 1. Pipeline

```
Band (ESP32, firmware v0.3.1) — sensing only        Trusted backend (Cloud Function processRawChunk
                                                     or `npm run worker` — identical code)
MAX30102 PPG red/IR 100 Hz ┐                         ┌─ ppg.ts       contact, detrend, beats, perfusion, saturation
MPU6050  accel/gyro 50 Hz  ├─ raw chunk every ~2 s ─►│  heart.ts     beat intervals → BPM (+quality), HRV (guarded)
MLX90614 object/ambient    ┘  + latest every ~2 s    │  motion.ts    activity level, possible impact, stillness
                                                     │  processor.ts data-quality flags, baseline, HRI, history, stats
                                                     │  engine.ts    explainable HRI (rules + separate confidence)
                                                     └─ store.ts     → devices/{id}/health, healthHistory/{assignmentId},
                                                                       assignmentStats/{assignmentId}, emergencies (HRI P2)
```

* The band performs **no** health calculations. The dashboard and app only **read** backend output.
* Processing state is kept per band in `processing/{deviceId}` and is **reset whenever the active
  assignment changes**, so baselines and history never mix two wearers or two events.
* Raw chunks are deleted after 5 minutes; derived history is kept per assignment (30-day pruning).

## 2. Signal processing

### 2.1 Heart rate (MAX30102 IR)
1. **Contact:** median IR ≥ 50 000 counts, otherwise `not_worn` — no physiological values are produced.
2. **Detrend** (0.75 s centred moving average), **invert** (systolic dip → peak), **smooth** (50 ms).
3. **Peaks:** local maxima above 50 % of the 95th percentile; refractory max(300 ms, ½ previous IBI).
   The previous chunk's tail is prepended so beats at chunk edges are neither missed nor double-counted.
4. **Artefact rejection:** IBI outside 300–2000 ms or > 30 % from the median of the last 5 is rejected.
5. **BPM** = 60 000 / median(last 8 accepted IBIs).
6. **Quality grade** (`valid | low_quality | unavailable`), using the constants in `health/config.ts`:
   sample completeness ≥ 90 %, perfusion index ≥ 0.1 %, beat acceptance ≥ 70 %, no saturation, not
   vigorous motion. **Only `valid` BPM is displayed** anywhere; otherwise the UI shows "Unavailable".

Raw red/IR counts in `latest.pulseRaw` are ADC counts and are never presented as BPM or SpO2.

### 2.2 HRV
RMSSD/SDNN over the last 60 s from **consecutive accepted** beats only. Guards: ≥ 10 IBIs, ≥ 8
consecutive pairs, span ≥ 30 s; otherwise HRV is `unavailable`. IBIs across a PPG FIFO overflow are
discarded.

### 2.3 SpO2
The ratio-of-ratios estimate is computed but **uncalibrated and unvalidated** for this enclosure.
`config/hri.spo2.displayEnabled = false` and `useInHri = false` by default, so SpO2 is neither shown
("Not validated") nor used in the HRI.

### 2.4 Temperature
MLX90614 *object* temperature is reported as **surface temperature** (`surfaceC`) — skin/band
surface influenced by sun, sweat and fit. **It is not core body temperature** and no core estimate
is produced. Ambient temperature is the sensor-body temperature near the band (context only).

### 2.5 Motion
|a| at 50 Hz → activity level by std(|a|) per chunk (`rest < 0.02 g ≤ light < 0.08 g ≤ moderate < 0.25 g ≤ vigorous`).
Possible impact = free-fall (< 0.5 g ≥ 60 ms) followed within 1 s by > 2.5 g. Stillness accumulates
across chunks. "Possible impact" is never called a fall diagnosis.

### 2.6 Data-quality flags
Each chunk is checked for: `not_worn, sensor_missing_ppg/imu/temperature, ppg/imu_samples_low,
ppg_fifo_overflow, chunk_gap, dropped_chunks_increased, low_perfusion, beat_detection_unstable,
motion_artifact_risk, clock_not_synced, delayed_chunk (> 10 s), ppg_saturation`. Flags are shown to
staff and attendees in plain language and lower HRI confidence.

### 2.7 Personal baseline
Built from the first 120 s of *qualified* data (worn, valid HR, rest/light activity) of the current
assignment: resting BPM, RMSSD and surface temperature. Until then baseline rules cannot fire and
confidence is multiplied by 0.85.

## 3. Explainable HRI (experimental)

**Confidence (data quality) is computed separately from the score.**

```
confidence = (worn ? 1 : 0)
           × Π penalty(flag)                       (config.confidencePenalties)
           × (0.4 + 0.6 × physiologicalInputs / 3)  (HR, HRV, surface temp valid)
           × (baseline ? 1 : 0.85)
level: ≥ 0.70 high · ≥ 0.45 medium · > 0 low · 0 none
```

**Rules** (only on valid inputs; a rule with missing inputs does not fire and the input is listed
as missing — missing data never counts as low risk):

| Rule | Points | Threshold | Source |
|---|---|---|---|
| HR rise > 30 bpm within 90 s at rest/light activity | 30 | 30 bpm | TAF |
| HR above personal resting baseline (rest/light) | 20 | 25 bpm | engineering default |
| RMSSD below × baseline | 15 | 0.6 | engineering default |
| Surface temperature above its baseline | 20 | 1.5 °C | engineering default |
| Ambient temperature (context — only adds points if a physiological rule fired) | 10 | 35 °C | engineering default |
| No movement while worn | 15 | 30 s | TAF |
| Possible impact then no movement | 25 | 30 s | engineering default |
| Low SpO2 (**disabled**) | 25 | 94 % for 10 s | TAF |

* **Score** = min(100, Σ points); **null** if no physiological input or confidence < 0.25.
* **Status** = `insufficient_data` if score is null or confidence < 0.40, else `low` < 30 ≤
  `elevated` < 60 ≤ `high`.
* Every result stores `contributingFactors` (value, threshold, explanation), `availableInputs`,
  `missingInputs`, flags/notes, `algorithmVersion`, `configVersion`, `experimental: true`,
  `validated: false`.
* "TAF" values come from the project proposal; engineering defaults are placeholders so the
  pipeline runs. **All values must be reviewed and tuned with §6 before any claim.** Runtime
  overrides: `config/hri` (deviceAdmin only); the merge always keeps `experimental/validated:false`.

### Automated HRI alerts
Created only when status is `high` with ≥ medium confidence for 3 consecutive chunks, with a 10-min
cooldown per assignment and an idempotency key. They are priority **P2**, always
`requiresHumanReview`, and staff can label them `true_positive / false_positive / uncertain`.

### Manual SOS is independent
Band-button SOS and app SOS are **P1**, created regardless of HRI, confidence, sensors, wear state
or link status, deduplicated by idempotency keys, and never suppressed by the HRI.

## 4. Latency fields
`health.latency.processingMs` (server receipt → computed) and `endToEndMs` (device chunk end → computed,
only when the band clock is NTP-synced). Report median / p95 from a recorded session; no figure is claimed yet.

## 5. Privacy in the method
Pseudonymous participant IDs; history keyed by assignment; research exports include only consented
participants, per-export pseudonyms (R001…), relative time and derived metrics — no device IDs, GPS
or account IDs.

## 6. Evaluation plan (to be executed — no results yet)

| Question | Protocol | Metric |
|---|---|---|
| Algorithm correctness | `cd Backend/functions; npm test` (synthetic PPG/IMU with known BPM, HRV, impacts; HRI unit tests) | tests pass |
| BPM agreement | band vs reference chest strap / pulse oximeter; rest, walking, after exercise; ≥ 10 participants (ethics approval) | MAE, Bland–Altman, % of time `valid` |
| Quality grading | compare `valid` vs `low_quality` periods against reference error | error by grade; coverage |
| HRV | band RMSSD vs chest-strap RMSSD at rest | MAE, correlation |
| Surface temperature | vs contact skin thermometer at the same site | MAE (surface only) |
| Possible impact | 20 controlled drops onto a mat + 20 daily activities | sensitivity, false-positive rate |
| **HRI ablation** | replay recorded sessions through: (a) HR-only rule, (b) multi-sensor rules, (c) multi-sensor + activity-aware gating | alert rate per hour, precision on staff-labelled alerts, alerts suppressed during exercise |
| Confidence usefulness | relation between confidence level and reference error / false alerts | error and false-alert rate by confidence level |
| Latency | `latency.*` over a 30-min session | median, p95 |

Labels for HRI alerts come from the Emergency Command review (true/false positive/uncertain) and
from scripted scenarios; small samples will be reported as such.

## 7. Running it
* **Blaze plan:** `cd Backend/functions; npm run build; firebase deploy --only functions`.
* **No Blaze:** `cd Backend/scripts; npm run worker` (same code on a laptop; do not run both).
* **No hardware:** `npm run admin demo email=<you>` then `npm run simulate bands=5 scenario=bpm-spike`
  with the worker running. Simulator data is labelled **DEMO ONLY**.
