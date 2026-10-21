/**
 * C1 — IMU analysis of one raw chunk (50 Hz accelerometer + gyroscope).
 *
 * Activity level (per 2-s chunk, from the std of |a| in g and peak gyro):
 *   rest      std < 0.02 g and gyro < 10 °/s
 *   light     std < 0.08 g
 *   moderate  std < 0.25 g
 *   vigorous  otherwise
 * Possible impact: free-fall (|a| < 0.5 g for ≥ 60 ms) followed within 1 s by |a| > 2.5 g.
 * This is a multi-sample pattern, never a single accelerometer sample, and it is NOT a fall
 * diagnosis: it only contributes to HRI together with sustained immobility.
 * Null samples (firmware emits null for non-finite values) are skipped.
 */
import type { ActivityLevel } from "../shared/schema";
import { HEALTH_CONFIG, type HealthConfig } from "./config";
import { mean, std } from "./signal";
import type { ProcessorState } from "./state";

const STANDARD_GRAVITY = 9.80665;

export interface ImuSamples {
  fs: number;
  ax: readonly (number | null)[];
  ay: readonly (number | null)[];
  az: readonly (number | null)[];
  gx: readonly (number | null)[];
  gy: readonly (number | null)[];
  gz: readonly (number | null)[];
}

export interface ImuAnalysis {
  samples: number;
  magG: number | null;
  level: ActivityLevel;
  /** Band uptime of a possible impact detected in this chunk. */
  impactAtT: number | null;
}

const isNum = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);

export function analyzeImu(state: ProcessorState, imu: ImuSamples, t0UptimeMs: number, cfg: HealthConfig = HEALTH_CONFIG): ImuAnalysis {
  const n = Math.min(imu.ax.length, imu.ay.length, imu.az.length);
  const dt = 1000 / (imu.fs || cfg.imuFsHz);
  const mags: number[] = [];
  let impactAtT: number | null = null;

  for (let i = 0; i < n; i++) {
    const ax = imu.ax[i];
    const ay = imu.ay[i];
    const az = imu.az[i];
    if (!isNum(ax) || !isNum(ay) || !isNum(az)) continue;
    const mag = Math.hypot(ax, ay, az) / STANDARD_GRAVITY;
    mags.push(mag);
    const t = t0UptimeMs + i * dt;
    if (mag < cfg.fallFreefallG) {
      state.freefallRunMs += dt;
    } else {
      if (state.freefallRunMs >= cfg.fallFreefallMinMs) state.freefallEndT = t;
      state.freefallRunMs = 0;
    }
    const recentFreefall = state.freefallEndT !== null && t - state.freefallEndT <= cfg.fallImpactWindowMs;
    if (impactAtT === null && mag > cfg.fallImpactG && recentFreefall) {
      impactAtT = t;
      state.freefallEndT = null;
    }
  }

  if (mags.length < 2) return { samples: mags.length, magG: null, level: "unknown", impactAtT };

  let maxGyro = 0;
  const gn = Math.min(imu.gx.length, imu.gy.length, imu.gz.length);
  for (let i = 0; i < gn; i++) {
    const gx = imu.gx[i];
    const gy = imu.gy[i];
    const gz = imu.gz[i];
    if (isNum(gx) && isNum(gy) && isNum(gz)) maxGyro = Math.max(maxGyro, Math.hypot(gx, gy, gz));
  }

  const s = std(mags);
  let level: ActivityLevel = "vigorous";
  if (s < cfg.activityRestStdG && maxGyro < cfg.activityRestGyroDps) level = "rest";
  else if (s < cfg.activityLightStdG) level = "light";
  else if (s < cfg.activityModerateStdG) level = "moderate";

  return { samples: mags.length, magG: mean(mags), level, impactAtT };
}
