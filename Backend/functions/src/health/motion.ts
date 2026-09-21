/**
 * C1 — IMU analysis of one raw chunk (50 Hz accelerometer + gyroscope).
 *
 * Fall:      free-fall (|a| < 0.5 g for >= 60 ms) followed within 1 s by an impact (|a| > 2.5 g).
 *            The free-fall run length is carried across chunks, so a fall spanning a chunk
 *            boundary is still detected.
 * Stillness: over the 2-s chunk, std(|a|) < 0.02 g and peak gyro < 10 deg/s.
 */
import { HEALTH_CONFIG, type HealthConfig } from "./config";
import { mean, std } from "./signal";
import type { ProcessorState } from "./state";

const STANDARD_GRAVITY = 9.80665;

export interface ImuSamples {
  fs: number;
  ax: readonly number[];
  ay: readonly number[];
  az: readonly number[];
  gx: readonly number[];
  gy: readonly number[];
  gz: readonly number[];
}

export interface ImuAnalysis {
  /** Mean acceleration magnitude (g), null without samples. */
  magG: number | null;
  /** No movement during the chunk. */
  still: boolean | null;
  /** Band uptime of the impact if a fall was detected in this chunk. */
  fallAtT: number | null;
}

/** Updates the free-fall run state in `state` and returns the chunk analysis. */
export function analyzeImu(
  state: ProcessorState,
  imu: ImuSamples,
  t0UptimeMs: number,
  cfg: HealthConfig = HEALTH_CONFIG,
): ImuAnalysis {
  const n = Math.min(imu.ax.length, imu.ay.length, imu.az.length);
  if (n === 0) return { magG: null, still: null, fallAtT: null };

  const dt = 1000 / imu.fs;
  const mags: number[] = [];
  for (let i = 0; i < n; i++) {
    mags.push(Math.hypot(imu.ax[i], imu.ay[i], imu.az[i]) / STANDARD_GRAVITY);
  }

  let fallAtT: number | null = null;
  for (let i = 0; i < n; i++) {
    const t = t0UptimeMs + i * dt;
    if (mags[i] < cfg.fallFreefallG) {
      state.freefallRunMs += dt;
    } else {
      if (state.freefallRunMs >= cfg.fallFreefallMinMs) state.freefallEndT = t;
      state.freefallRunMs = 0;
    }
    const recentFreefall = state.freefallEndT !== null && t - state.freefallEndT <= cfg.fallImpactWindowMs;
    if (fallAtT === null && mags[i] > cfg.fallImpactG && recentFreefall) {
      fallAtT = t;
      state.freefallEndT = null;
    }
  }

  const gyroCount = Math.min(imu.gx.length, imu.gy.length, imu.gz.length);
  let maxGyro = 0;
  for (let i = 0; i < gyroCount; i++) {
    maxGyro = Math.max(maxGyro, Math.hypot(imu.gx[i], imu.gy[i], imu.gz[i]));
  }
  const magStd = std(mags);
  const still = Number.isFinite(magStd) && magStd < cfg.stillMaxStdG && maxGyro < cfg.stillMaxGyroDps;

  return { magG: mean(mags), still, fallAtT };
}
