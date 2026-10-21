import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HriBadge } from "@/components/common/Badges";
import type { DeviceHealth, HriResult } from "@/types";
import { normalizeHealth, toDeviceRow } from "@/utils/deviceRow";
import { DEFAULT_THRESHOLDS } from "@shared/thresholds";
import { parseLatest } from "@shared/telemetry";

import { HriPanel } from "./HriPanel";
import { bpmText, hrvText, Metric, spo2Text, surfaceTempText } from "./Metrics";

afterEach(cleanup);

const NOW = 1_760_000_000_000;

const hri = (over: Partial<HriResult> = {}): HriResult => ({
  hriScore: null,
  status: "insufficient_data",
  confidence: { level: "none", value: 0 },
  calculatedAt: NOW,
  window: { fromMs: null, toMs: null, seconds: 0 },
  availableInputs: [],
  missingInputs: ["heart_rate", "hrv"],
  contributingFactors: [],
  dataQuality: { flags: ["not_worn"], notes: [] },
  baselineAvailable: false,
  algorithmVersion: "test",
  configVersion: "test",
  experimental: true,
  validated: false,
  ...over,
});

const health = (over: Partial<DeviceHealth> = {}): DeviceHealth => ({
  deviceId: "FESTNET_001",
  assignmentId: "A-TEST01",
  seq: 1,
  computedAt: NOW,
  worn: true,
  heartRate: { bpm: 72, quality: "valid", beats: 3, method: "test" },
  spo2: { value: 97, quality: "valid", validated: false, displayEnabled: false, note: "" },
  hrv: { rmssdMs: 40, sdnnMs: 50, ibiCount: 12, windowSec: 60, quality: "valid" },
  temperature: { surfaceC: 33.4, ambientC: 28 },
  activity: { level: "rest", magG: 1, stillSec: 0, impactDetected: false },
  signal: { ppgSamples: 200, ppgExpected: 200, imuSamples: 100, imuExpected: 100, ppgOverflow: 0, flags: [], clockSynced: true },
  hri: hri(),
  latency: {},
  ...over,
});

describe("health display rules", () => {
  it("shows BPM only when valid and worn", () => {
    expect(bpmText(health())).toBe("72 bpm");
    expect(bpmText(health({ heartRate: { bpm: 140, quality: "low_quality", beats: 1, method: "t" } }))).toBe("Unavailable");
    expect(bpmText(health({ worn: false }))).toBe("Unavailable");
    expect(bpmText(null)).toBe("Unavailable");
  });

  it("never shows SpO2 unless display is enabled", () => {
    expect(spo2Text(health())).toBe("Unavailable");
    expect(spo2Text(null)).toBe("Unavailable");
  });

  it("renders missing values as Unavailable, never 0", () => {
    expect(surfaceTempText(null)).toBe("Unavailable");
    expect(surfaceTempText(undefined)).toBe("Unavailable");
    expect(surfaceTempText(Number.NaN)).toBe("Unavailable");
    expect(hrvText(health({ hrv: { ibiCount: 3, windowSec: 60, quality: "unavailable" } }))).toBe("Unavailable");
    render(<Metric label="Surface temp" value={surfaceTempText(null)} />);
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.queryByText(/^0/)).toBeNull();
  });

  it("explains a missing HRI score as insufficient data, not low risk", () => {
    render(<HriPanel hri={hri()} />);
    expect(screen.getByText(/This does not mean low risk/)).toBeTruthy();
    expect(screen.getByText(/Health Risk Indicator/)).toBeTruthy();
  });

  it("marks low-confidence HRI badges", () => {
    render(<HriBadge hri={hri({ hriScore: 65, status: "high", confidence: { level: "low", value: 0.3 } })} />);
    expect(screen.getByTitle(/Low confidence/)).toBeTruthy();
  });
});

describe("normalizeHealth", () => {
  it("restores lists that Firebase dropped and renders the HRI panel", () => {
    // What RTDB returns when contributingFactors / notes / flags were empty arrays.
    const stored = { ...health(), hri: { ...hri(), contributingFactors: undefined, dataQuality: undefined, availableInputs: undefined } };
    const h = normalizeHealth(JSON.parse(JSON.stringify(stored)))!;
    expect(h.hri.contributingFactors).toEqual([]);
    expect(h.hri.dataQuality.notes).toEqual([]);
    render(<HriPanel hri={h.hri} />);
    expect(screen.getByText(/No rule fired/)).toBeTruthy();
  });
});

describe("device rows", () => {
  const assignment = { assignmentId: "A-TEST01", deviceId: "FESTNET_001", participantId: "P-AAAAAAAA", status: "active" as const, startedAt: NOW - 60_000 };

  it("ignores derived health that belongs to a previous assignment", () => {
    const row = toDeviceRow(assignment, { deviceId: "FESTNET_001", latest: null, health: health({ assignmentId: "A-OLD001" }), receivedAt: null, error: null }, NOW, DEFAULT_THRESHOLDS);
    expect(row.health).toBeNull();
  });

  it("uses receive time, not the online flag, for freshness", () => {
    const latest = parseLatest({ deviceId: "FESTNET_001", online: true, serverTs: NOW - 10 * 60_000 }, NOW);
    const row = toDeviceRow(assignment, { deviceId: "FESTNET_001", latest, health: null, receivedAt: null, error: null }, NOW, DEFAULT_THRESHOLDS);
    expect(row.freshness).toBe("offline");
    const fresh = toDeviceRow(assignment, { deviceId: "FESTNET_001", latest, health: null, receivedAt: NOW - 2_000, error: null }, NOW, DEFAULT_THRESHOLDS);
    expect(fresh.freshness).toBe("live");
  });

  it("keeps the SOS flag visible even when the band is offline", () => {
    const latest = parseLatest({ deviceId: "FESTNET_001", sosActive: true, serverTs: NOW - 3_600_000 }, NOW);
    const row = toDeviceRow(assignment, { deviceId: "FESTNET_001", latest, health: null, receivedAt: null, error: null }, NOW, DEFAULT_THRESHOLDS);
    expect(row.freshness).toBe("offline");
    expect(row.sosActive).toBe(true);
  });
});
