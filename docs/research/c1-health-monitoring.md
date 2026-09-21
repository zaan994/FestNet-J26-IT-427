# Component 1 — Real-Time Health Monitoring: method

Owner: Rizvi M.Z.M. (IT23305564)

This document describes how FestNet turns raw wearable signals into vitals and anomaly alerts.
Code: `Backend/functions/src/health/` (one module per step, each with a header comment).

## 1. Pipeline

```
Band (ESP32)                          Backend (Cloud Function `processRawChunk` / `npm run process`)
───────────────                       ────────────────────────────────────────────────────────────
MAX30102  PPG red/IR 100 Hz ┐         ┌─ ppg.ts      contact → detrend → beats → perfusion index, SpO2
MPU6050   accel/gyro 50 Hz  ├─ raw ──►│  heart.ts    beat intervals → BPM, HRV (RMSSD/SDNN), stress
MLX90614  skin temp 1 Hz    ┘ chunk   │  motion.ts   fall (free-fall → impact), stillness
          every 2 s                   │  anomaly.ts  TAF rules + multi-signal severity + hysteresis
                                      └─ processor.ts → devices/{id}/health, history, alerts
```

Processing state (signal tails, beat intervals, baselines, timers) is kept between chunks in
`festnet/processing/{deviceId}`, so each 2-second chunk is analysed with its context.

## 2. Algorithms

### Heart rate
1. **Contact:** median IR ≥ 50 000 counts. Otherwise the band is "not worn" and no vitals are reported.
2. **Detrend:** subtract a 0.75 s centred moving average. This removes the DC level, breathing and slow motion drift.
3. **Invert:** blood volume rises at systole, so IR counts *dip*. The detrended signal is inverted so beats become peaks.
4. **Smooth:** 50 ms moving average.
5. **Peak detection:** local maxima above 50 % of the 95th percentile of the window. The refractory period is max(300 ms, ½ × previous interval), and the stronger peak wins inside it.
6. **Chunk boundaries:** the previous chunk's last 2 s are prepended, and beats are accepted with a 200 ms delay. A peak at a chunk edge is therefore judged with both neighbours, and is neither missed nor counted twice.
7. **Artefact rejection:** an inter-beat interval (IBI) is rejected if it lies outside 300–2000 ms (30–200 bpm), or deviates more than 30 % from the median of the last 5. After 4 consecutive rejections, the history is reset (re-lock).
8. **BPM** = 60 000 / median(last 8 accepted IBIs). It is unknown if there are fewer than 4 IBIs or no beat for 4 s.

### SpO2
Ratio of ratios over the 4-s window (current + previous chunk):
R = (AC_red / DC_red) / (AC_ir / DC_ir), where AC = standard deviation of the detrended signal and DC = mean.
Then SpO2 = −45.060·R² + 30.354·R + 94.845, the empirical curve commonly used with MAX3010x sensors.
The result is only accepted for 0.3 ≤ R ≤ 1.6 with a valid heart rate, then exponentially smoothed (α = 0.3).
**This curve is not calibrated for this enclosure.** Validate against a reference pulse oximeter (§4).

### HRV and stress
- **RMSSD**: root mean square of successive IBI differences over 60 s. Only pairs of consecutive *accepted* beats are used.
- **SDNN**: standard deviation of the IBIs over 60 s. Needs at least 10 beats.
- **Stress score (0–100):** 0.7 × HRV part + 0.3 × heart-rate part.
    - HRV part = (clamp(1 − RMSSD/RMSSD_baseline, −1, 1) + 1) / 2 × 100, so 50 = at baseline.
    - Heart-rate part = clamp((BPM − BPM_baseline) / 40, 0, 1) × 100.
    - The baseline is the mean over the first 2 minutes of valid wear. Until then a population reference is used (RMSSD 42 ms, 75 bpm).
    - Levels: < 40 low, < 65 medium, otherwise high.
    - It is a heuristic for *relative* change, not a clinical stress measure.

### Temperature
The MLX90614 measures **skin** temperature (≈ 33–35 °C at the wrist). It is exponentially smoothed
(α = 0.3), and core temperature is estimated as skin + `skinToCoreOffsetC` (default 3.5 °C, set
in `config/thresholds`). The estimate is only reported while the band is worn. Calibrate the offset
against a clinical thermometer for the final enclosure.

### Motion
- **Fall:** |a| < 0.5 g for ≥ 60 ms (free-fall), followed within 1 s by |a| > 2.5 g (impact). The free-fall run length is carried across chunks. A fall stays active until movement resumes, and for at least 10 s.
- **Stillness:** within a 2-s chunk, std(|a|) < 0.02 g and peak gyro < 10 °/s. The still time accumulates across chunks.

### Anomaly detection (TAF thresholds)
| Type | Rule (band must be worn) |
|---|---|
| `bpm_spike` | BPM − min(BPM over last 90 s) > 30 |
| `low_spo2` | SpO2 < 94 % for 10 s |
| `high_temp` | estimated core > 38 °C for 5 s |
| `stillness` | no movement for 30 s |
| `fall` | free-fall + impact (worn within the last 10 s) |

**Severity (multi-signal correlation):**
- 1 active type = warning, 2 = danger, 3 or more = critical.
- A fall is at least danger.
- A fall plus stillness = critical.
- SpO2 < 90 % for 10 s = critical.

**Hysteresis:** a type clears only after its condition has been gone for 6 s.
**Alerts:** written to `alerts/` only when severity *rises*, so there is one alert per onset or escalation.

All clinical thresholds are in `config/thresholds` (organiser-editable). Algorithm constants are in
`Backend/functions/src/health/config.ts`.

## 3. Latency

Every `health` record carries the following timings:
- `latency.processingMs`: from the server receiving the raw chunk to the health record being computed.
- `latency.endToEndMs`: from the end of the chunk on the band (NTP clock) to the health record being computed.

Worst-case detection delay ≈ chunk length (2 s) + upload + processing. Report the measured
distribution (median / 95th percentile) from `health` records in the evaluation.

## 4. Validation plan

| What | How | Metric |
|---|---|---|
| Algorithm correctness | `cd Backend/functions && npm test` (synthetic signals with known BPM / SpO2 / falls) | all tests pass |
| BPM | band vs. reference pulse oximeter or chest strap, rest + after exercise, ≥ 10 subjects × 2 min | MAE, Bland–Altman |
| SpO2 | band vs. reference pulse oximeter at rest (and breath-hold, if ethically approved) | MAE; calibrate the R→SpO2 curve |
| Temperature | skin + offset vs. clinical thermometer | MAE; fit `skinToCoreOffsetC` |
| Fall | 20 controlled drops onto a mat + 20 daily activities (sit, walk, jump) | sensitivity, false-positive rate |
| BPM spike | 1 min of exercise after rest | detection yes/no, delay |
| Latency | `latency.*` fields over a 30-min session | median, p95 |

## 5. Running it

- **With the Blaze plan:** `cd Backend/functions && npm run build && firebase deploy --only functions`.
- **Without Blaze:** `cd Backend/scripts && npm run process` (same code, runs on a laptop).
- **Without hardware:** run `npm run simulate -- --scenario bpm-spike` together with `npm run process`.
  Other scenarios: `heatstroke`, `low-spo2`, `fall`, `no-contact`.
