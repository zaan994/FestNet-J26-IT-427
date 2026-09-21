/**
 * Synthetic band signals in the exact raw-chunk format of the firmware.
 * Used by the unit tests and the band simulator (Backend/scripts) so the C1 pipeline can be
 * exercised without hardware. Pure TS, deterministic when a seed is given.
 */
import type { RawChunk } from "../shared";

export type SyntheticMotion = "active" | "still";

export interface SyntheticParams {
  bpm: number;
  spo2: number;
  skinC: number;
  ambientC: number;
  contact: boolean;
  motion: SyntheticMotion;
  /** Relative beat-to-beat jitter (0.04 = ±4 %), gives realistic HRV. */
  hrvJitter: number;
}

export const DEFAULT_SYNTHETIC_PARAMS: SyntheticParams = {
  bpm: 72,
  spo2: 98,
  skinC: 34.0,
  ambientC: 29.0,
  contact: true,
  motion: "active",
  hrvJitter: 0.04,
};

const PPG_FS = 100;
const IMU_FS = 50;
const G = 9.80665;

/** Inverse of the SpO2 curve used by the processor (decreasing branch, R > 0.337). */
export function ratioForSpo2(spo2: number): number {
  const a = 45.06;
  const b = -30.354;
  const c = spo2 - 94.845;
  const disc = Math.max(0, b * b - 4 * a * c);
  return (-b + Math.sqrt(disc)) / (2 * a);
}

/** Small seeded PRNG (mulberry32) so tests are reproducible. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SyntheticBand {
  private seq = 0;
  private uptimeMs: number;
  private beatPhase = 0;
  private beatRate: number; // beats per ms for the current beat
  private respPhase = 0;
  private pendingFall = false;
  private readonly random: () => number;

  constructor(
    private readonly epochStartMs: number | null = Date.now(),
    seed = 1,
    startUptimeMs = 10_000,
  ) {
    this.random = prng(seed);
    this.uptimeMs = startUptimeMs;
    this.beatRate = 72 / 60_000;
  }

  /** The next chunk starts with a free-fall + impact. */
  triggerFall() {
    this.pendingFall = true;
  }

  private noise(amplitude: number) {
    return (this.random() * 2 - 1) * amplitude;
  }

  /** Generates the next 2-s chunk. */
  nextChunk(params: SyntheticParams, durationMs = 2000): RawChunk {
    const t0UptimeMs = this.uptimeMs;
    const ppgN = Math.round((durationMs / 1000) * PPG_FS);
    const imuN = Math.round((durationMs / 1000) * IMU_FS);

    // --- PPG ---
    const irDc = params.contact ? 112_000 : 3_000;
    const redDc = params.contact ? 98_000 : 2_500;
    const pi = 0.012; // 1.2 % perfusion
    const ratio = ratioForSpo2(params.spo2);
    const red: number[] = [];
    const ir: number[] = [];
    for (let i = 0; i < ppgN; i++) {
      const dt = 1000 / PPG_FS;
      this.beatPhase += this.beatRate * dt;
      if (this.beatPhase >= 1) {
        this.beatPhase -= 1;
        const jitter = 1 + this.noise(params.hrvJitter);
        this.beatRate = (params.bpm / 60_000) * jitter;
      }
      this.respPhase += (0.25 / 1000) * dt; // 15 breaths/min
      const p = this.beatPhase;
      const pulse = Math.exp(-(((p - 0.15) / 0.07) ** 2)) + 0.35 * Math.exp(-(((p - 0.45) / 0.09) ** 2));
      const drift = Math.sin(2 * Math.PI * this.respPhase);
      if (params.contact) {
        ir.push(Math.round(irDc * (1 - pi * pulse) + irDc * 0.002 * drift + this.noise(40)));
        red.push(Math.round(redDc * (1 - pi * ratio * pulse) + redDc * 0.002 * drift + this.noise(40)));
      } else {
        ir.push(Math.round(irDc + this.noise(200)));
        red.push(Math.round(redDc + this.noise(200)));
      }
    }

    // --- IMU ---
    const ax: number[] = [], ay: number[] = [], az: number[] = [];
    const gx: number[] = [], gy: number[] = [], gz: number[] = [];
    for (let i = 0; i < imuN; i++) {
      let mag = G;
      let wobble = params.motion === "active" ? 0.6 : 0.01;
      let gyro = params.motion === "active" ? 25 : 0.5;
      if (this.pendingFall) {
        if (i < 15) {
          mag = 0.15 * G; // 300 ms free-fall
          wobble = 0.05;
        } else if (i === 15) {
          mag = 3.4 * G; // impact
        } else {
          wobble = 0.01; // lying still afterwards
          gyro = 0.5;
        }
      }
      const swing = params.motion === "active" && !this.pendingFall ? Math.sin((2 * Math.PI * i) / 25) : 0;
      ax.push(round2(this.noise(wobble) + swing));
      ay.push(round2(this.noise(wobble)));
      az.push(round2(mag + this.noise(wobble)));
      gx.push(round1(this.noise(gyro)));
      gy.push(round1(this.noise(gyro)));
      gz.push(round1(this.noise(gyro)));
    }
    this.pendingFall = false;

    const chunk: RawChunk = {
      seq: this.seq++,
      t0: this.epochStartMs === null ? null : this.epochStartMs + t0UptimeMs,
      t0UptimeMs,
      durationMs,
      ppg: { fs: PPG_FS, n: ppgN, overflow: 0, red, ir },
      imu: { fs: IMU_FS, n: imuN, ax, ay, az, gx, gy, gz },
      temperature: {
        objectC: round2(params.contact ? params.skinC + this.noise(0.05) : params.ambientC + this.noise(0.05)),
        ambientC: round2(params.ambientC + this.noise(0.05)),
      },
      sosActive: false,
      sosPressCount: 0,
    };
    this.uptimeMs += durationMs;
    return chunk;
  }
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
