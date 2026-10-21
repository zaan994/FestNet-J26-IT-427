import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_HRI_CONFIG,
  DEFAULT_THRESHOLDS,
  freshness,
  gpsFreshness,
  haversineMeters,
  mergeHriConfig,
  offsetMeters,
  parseLatest,
  paths,
  SEVERITY_ORDER,
} from "../src/shared";

const NOW = 1_760_000_100_000;
const sample = () => JSON.parse(readFileSync(resolve(__dirname, "../../../tests/test_data/sample_latest.json"), "utf8"));

describe("geo", () => {
  it("haversine matches a known distance", () => {
    const d = haversineMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });
  it("offsetMeters round-trips with haversine", () => {
    const origin = { latitude: 6.9147, longitude: 79.9729 };
    expect(haversineMeters(origin, offsetMeters(origin, 50, 45))).toBeCloseTo(50, 0);
  });
});

describe("contract", () => {
  it("paths keep the firmware contract", () => {
    expect(paths.deviceLatest("FESTNET_001")).toBe("festnet/devices/FESTNET_001/latest");
    expect(paths.deviceRaw("FESTNET_001")).toBe("festnet/devices/FESTNET_001/raw");
    expect(paths.deviceMeta("FESTNET_001")).toBe("festnet/devices/FESTNET_001/meta");
  });
  it("severity ordering", () => {
    expect(SEVERITY_ORDER.critical).toBeGreaterThan(SEVERITY_ORDER.danger);
  });
  it("HRI config is explicitly experimental and SpO2 is off by default", () => {
    expect(DEFAULT_HRI_CONFIG.experimental).toBe(true);
    expect(DEFAULT_HRI_CONFIG.validated).toBe(false);
    expect(DEFAULT_HRI_CONFIG.spo2.useInHri).toBe(false);
    expect(DEFAULT_HRI_CONFIG.spo2.displayEnabled).toBe(false);
    expect(DEFAULT_HRI_CONFIG.rules.lowSpo2.enabled).toBe(false);
  });
  it("runtime overrides cannot mark the config as validated", () => {
    const merged = mergeHriConfig({ validated: true, rules: { surfaceTempRise: { threshold: 2 } } });
    expect(merged.validated).toBe(false);
    expect(merged.rules.surfaceTempRise.threshold).toBe(2);
    expect(merged.rules.surfaceTempRise.points).toBe(DEFAULT_HRI_CONFIG.rules.surfaceTempRise.points);
  });
});

describe("parseLatest — valid firmware v0.3.1 payload", () => {
  it("parses every field and keeps raw counts raw", () => {
    const p = parseLatest(sample(), NOW)!;
    expect(p.deviceId).toBe("FESTNET_001");
    expect(p.fwVersion).toBe("0.3.1");
    expect(p.clockSynced).toBe(true);
    expect(p.pulseRaw.ir).toBe(112394);
    expect(p.temperature.surfaceC).toBe(34.21);
    expect(p.gps.location).toEqual({ latitude: 6.9147, longitude: 79.9729 });
    expect(p.raw.lastChunkPpgSamples).toBe(200);
    expect(p.raw.ppgCompleteness).toBeCloseTo(1, 2);
    expect(p.raw.imuCompleteness).toBeCloseTo(1, 2);
    // Parser never invents derived vitals.
    expect(p).not.toHaveProperty("bpm");
    expect(p).not.toHaveProperty("spo2");
  });
});

describe("parseLatest — malformed / missing / invalid", () => {
  it("rejects non-objects", () => {
    expect(parseLatest(null)).toBeNull();
    expect(parseLatest("x")).toBeNull();
    expect(parseLatest([1, 2])).toBeNull();
  });
  it("missing fields become null, never 0 or false", () => {
    const p = parseLatest({ deviceId: "FESTNET_001" }, NOW)!;
    expect(p.sensors.ppg).toBeNull();
    expect(p.temperature.surfaceC).toBeNull();
    expect(p.pulseRaw.ir).toBeNull();
    expect(p.batteryPct).toBeNull();
    expect(p.raw.droppedChunks).toBeNull();
    expect(p.gps.fix).toBe(false);
    expect(p.clockSynced).toBe(false);
  });
  it("wrong types and out-of-range values become null", () => {
    const p = parseLatest(
      { deviceId: 5, ts: "yesterday", temperature: { objectC: 999, ambientC: "hot" }, net: { rssi: 20 }, battery: { pct: 140 } },
      NOW,
    )!;
    expect(p.deviceId).toBeNull();
    expect(p.deviceTs).toBeNull();
    expect(p.temperature.surfaceC).toBeNull();
    expect(p.temperature.ambientC).toBeNull();
    expect(p.net.rssi).toBeNull();
    expect(p.batteryPct).toBeNull();
    expect(p.issues.join(" ")).toMatch(/Surface temperature/);
  });
  it("millis()-like timestamps are not treated as wall-clock time", () => {
    const p = parseLatest({ deviceId: "X", ts: 523400 }, NOW)!;
    expect(p.deviceTs).toBeNull();
    expect(p.clockSynced).toBe(false);
  });
  it("GPS without a fix never exposes a location", () => {
    const p = parseLatest({ deviceId: "X", gps: { fix: false, latitude: 6.9, longitude: 79.9, satellites: 3 } }, NOW)!;
    expect(p.gps.location).toBeNull();
    expect(p.gps.speedMps).toBeNull();
  });
  it("a fix at 0,0 or with missing coordinates is invalid", () => {
    expect(parseLatest({ deviceId: "X", gps: { fix: true, latitude: 0, longitude: 0 } }, NOW)!.gps.location).toBeNull();
    const p = parseLatest({ deviceId: "X", gps: { fix: true } }, NOW)!;
    expect(p.gps.location).toBeNull();
    expect(p.issues.join(" ")).toMatch(/GPS/);
  });
  it("sensor detected is reported separately from measurement validity", () => {
    const p = parseLatest({ deviceId: "X", sensors: { max30102: true }, pulseRaw: { ir: 1200 } }, NOW)!;
    expect(p.sensors.ppg).toBe(true);
    expect(p.pulseRaw.ir).toBe(1200); // still just a raw count
  });
});

describe("freshness", () => {
  const stale = DEFAULT_THRESHOLDS.deviceOfflineAfterSec;
  it("classifies by received time, not the online flag", () => {
    expect(freshness(NOW - 2_000, NOW, stale)).toBe("live");
    expect(freshness(NOW - 30_000, NOW, stale)).toBe("stale");
    expect(freshness(NOW - 10 * 60_000, NOW, stale)).toBe("offline");
    expect(freshness(null, NOW, stale)).toBe("unknown");
    expect(freshness(Number.NaN, NOW, stale)).toBe("unknown");
  });
  it("GPS freshness needs a fix and a recent reading", () => {
    const p = parseLatest(sample(), NOW);
    expect(gpsFreshness(p, NOW - 5_000, NOW, 60)).toBe("fresh");
    expect(gpsFreshness(p, NOW - 120_000, NOW, 60)).toBe("stale");
    expect(gpsFreshness(parseLatest({ deviceId: "X" }, NOW), NOW, NOW, 60)).toBe("no_fix");
    expect(gpsFreshness(null, NOW, NOW, 60)).toBe("unknown");
  });
});
