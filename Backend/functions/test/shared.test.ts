import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_THRESHOLDS,
  haversineMeters,
  offsetMeters,
  paths,
  SEVERITY_ORDER,
  type DeviceLatest,
} from "../src/shared";

describe("geo", () => {
  it("haversine matches a known distance", () => {
    // ~111.2 km per degree of latitude
    const d = haversineMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it("offsetMeters round-trips with haversine", () => {
    const origin = { latitude: 6.9147, longitude: 79.9729 };
    const moved = offsetMeters(origin, 50, 45);
    expect(haversineMeters(origin, moved)).toBeCloseTo(50, 0);
  });
});

describe("contract", () => {
  it("TAF thresholds", () => {
    expect(DEFAULT_THRESHOLDS.bpmSpikeDelta).toBe(30);
    expect(DEFAULT_THRESHOLDS.spo2Low).toBe(94);
    expect(DEFAULT_THRESHOLDS.coreTempHighC).toBe(38);
    expect(DEFAULT_THRESHOLDS.stillnessTimeoutSec).toBe(30);
    expect(DEFAULT_THRESHOLDS.alertEscalationSec).toBe(120);
    expect(DEFAULT_THRESHOLDS.volunteerRadiusM).toBe(50);
  });

  it("severity ordering", () => {
    expect(SEVERITY_ORDER.critical).toBeGreaterThan(SEVERITY_ORDER.danger);
    expect(SEVERITY_ORDER.danger).toBeGreaterThan(SEVERITY_ORDER.warning);
  });

  it("paths live under /festnet", () => {
    expect(paths.deviceLatest("FESTNET_001")).toBe("festnet/devices/FESTNET_001/latest");
  });

  it("sample payload has every top-level field of DeviceLatest", () => {
    const file = resolve(__dirname, "../../../tests/test_data/sample_latest.json");
    const sample = JSON.parse(readFileSync(file, "utf8")) as DeviceLatest;
    const required: (keyof DeviceLatest)[] = [
      "deviceId", "fwVersion", "online", "ts", "serverTs", "uptimeMs", "sosActive", "sensors",
      "pulseRaw", "vitals", "temperature", "motion", "gps", "anomaly", "battery", "net",
    ];
    for (const key of required) expect(sample).toHaveProperty(key);
    expect(sample.vitals).toHaveProperty("hrv.rmssdMs");
    expect(sample.vitals).toHaveProperty("stress.level");
  });
});
