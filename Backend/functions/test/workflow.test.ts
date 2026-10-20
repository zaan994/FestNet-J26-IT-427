/** Pure workflow rules: alert lifecycle, assignment conflicts, claim codes. */
import { describe, expect, it } from "vitest";

import {
  claimCodeBlocker,
  deviceAssignBlocker,
  eventAssignBlocker,
  participantAssignBlocker,
} from "../src/services/assignments";
import { hashClaimCode, newClaimCode, newParticipantId, normalizeClaimCode, PARTICIPANT_ID_PATTERN } from "../src/services/ids";
import { nextStatus } from "../src/services/emergencies";
import type { FestEvent, Participant } from "../src/shared";

describe("alert lifecycle state machine", () => {
  it("allows the documented transitions only", () => {
    expect(nextStatus("open", "acknowledge")).toBe("acknowledged");
    expect(nextStatus("acknowledged", "acknowledge")).toBeNull();
    expect(nextStatus("open", "assignResponder")).toBe("acknowledged");
    expect(nextStatus("acknowledged", "markInProgress")).toBe("in_progress");
    expect(nextStatus("in_progress", "resolve")).toBe("resolved");
    expect(nextStatus("open", "resolve")).toBeNull(); // must be acknowledged first
    expect(nextStatus("resolved", "reopen")).toBe("open");
    expect(nextStatus("open", "reopen")).toBeNull();
    expect(nextStatus("resolved", "assignResponder")).toBeNull();
    expect(nextStatus("resolved", "review")).toBe("resolved");
  });
});

describe("assignment conflicts", () => {
  const participant = (over: Partial<Participant> = {}): Participant => ({
    participantId: "P-AAAABBBB",
    eventId: "fest-abcd",
    createdAt: 1,
    createdBy: "u",
    demo: false,
    researchConsent: false,
    ...over,
  });

  it("rejects unregistered, busy, maintenance or retired devices", () => {
    expect(deviceAssignBlocker(null)).toMatch(/not registered/);
    expect(deviceAssignBlocker({ label: "x" })).toMatch(/not registered/);
    expect(deviceAssignBlocker({ inventoryStatus: "available", currentAssignmentId: "A-1" })).toMatch(/active assignment/);
    expect(deviceAssignBlocker({ inventoryStatus: "maintenance" })).toMatch(/maintenance/);
    expect(deviceAssignBlocker({ inventoryStatus: "available" })).toBeNull();
  });

  it("rejects duplicate or cross-event participant assignment", () => {
    expect(participantAssignBlocker(null, "fest-abcd")).toMatch(/not found/);
    expect(participantAssignBlocker(participant({ eventId: "other" }), "fest-abcd")).toMatch(/different event/);
    expect(participantAssignBlocker(participant({ activeAssignmentId: "A-1" }), "fest-abcd")).toMatch(/already has/);
    expect(participantAssignBlocker(participant(), "fest-abcd")).toBeNull();
  });

  it("only active events accept assignments", () => {
    const e = (status: FestEvent["status"]) => ({ status }) as FestEvent;
    expect(eventAssignBlocker(e("active"))).toBeNull();
    expect(eventAssignBlocker(e("planned"))).toMatch(/planned/);
    expect(eventAssignBlocker(e("closed"))).toMatch(/closed/);
  });
});

describe("claim codes", () => {
  it("are 8 unambiguous characters, hashed, and normalised from QR text", () => {
    const code = newClaimCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(normalizeClaimCode(`FESTNET-CLAIM:${code.toLowerCase()}`)).toBe(code);
    expect(hashClaimCode(code)).toBe(hashClaimCode(`festnet-claim:${code}`));
    expect(hashClaimCode(code)).not.toContain(code);
  });

  it("cannot be reused, used after expiry or after revocation", () => {
    const base = { assignmentId: "A-1", eventId: "e", createdBy: "u", expiresAt: 1000 };
    expect(claimCodeBlocker(null, 0)).toBe("invalid");
    expect(claimCodeBlocker({ ...base }, 500)).toBeNull();
    expect(claimCodeBlocker({ ...base }, 1500)).toBe("expired");
    expect(claimCodeBlocker({ ...base, usedAt: 400 }, 500)).toBe("used");
    expect(claimCodeBlocker({ ...base, revoked: true }, 500)).toBe("revoked");
  });

  it("participant ids are opaque pseudonyms", () => {
    const id = newParticipantId();
    expect(id).toMatch(PARTICIPANT_ID_PATTERN);
  });
});
