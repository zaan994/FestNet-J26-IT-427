/**
 * C2 — volunteer selection (pure). A volunteer is notified only when:
 *  - the alert severity reaches cfg.routing.volunteerMinSeverity (danger by default),
 *  - the band's GPS fix is valid and no older than cfg.routing.deviceFixMaxAgeSec,
 *  - the volunteer is on duty for the event, has a valid location no older than
 *    cfg.routing.responderLocationMaxAgeSec, and is within cfg.routing.volunteerRadiusM (Haversine).
 * Missing or stale coordinates exclude a volunteer — they are never guessed.
 */
import { haversineMeters, SEVERITY_RANK, validLatLng, type AlertSeverity, type ResponderRecord } from "../shared";
import type { C2Config } from "../shared/c2Config";

export interface VolunteerCandidate {
  uid: string;
  record: ResponderRecord | null;
}

export interface VolunteerSelection {
  selected: { uid: string; distanceM: number }[];
  excluded: { offDuty: number; noLocation: number; staleLocation: number; outOfRange: number };
  skippedReason?: "severity" | "no_device_fix" | "stale_device_fix";
}

export function selectVolunteers(
  candidates: VolunteerCandidate[],
  alert: { severity: AlertSeverity; location: { latitude: number; longitude: number; fixAt: number } | null | undefined },
  nowMs: number,
  cfg: C2Config,
): VolunteerSelection {
  const excluded = { offDuty: 0, noLocation: 0, staleLocation: 0, outOfRange: 0 };
  if (SEVERITY_RANK[alert.severity] < SEVERITY_RANK[cfg.routing.volunteerMinSeverity]) return { selected: [], excluded, skippedReason: "severity" };
  const origin = alert.location ? validLatLng(alert.location.latitude, alert.location.longitude) : null;
  if (!origin || !alert.location) return { selected: [], excluded, skippedReason: "no_device_fix" };
  if (nowMs - alert.location.fixAt > cfg.routing.deviceFixMaxAgeSec * 1000) return { selected: [], excluded, skippedReason: "stale_device_fix" };

  const selected: { uid: string; distanceM: number }[] = [];
  for (const c of candidates) {
    const r = c.record;
    if (!r || r.onDuty !== true) {
      excluded.offDuty++;
      continue;
    }
    const at = validLatLng(r.lat, r.lng);
    if (!at || typeof r.locationUpdatedAt !== "number") {
      excluded.noLocation++;
      continue;
    }
    if (nowMs - r.locationUpdatedAt > cfg.routing.responderLocationMaxAgeSec * 1000 || r.locationUpdatedAt - nowMs > 60_000) {
      excluded.staleLocation++;
      continue;
    }
    const d = haversineMeters(origin, at);
    if (d <= cfg.routing.volunteerRadiusM) selected.push({ uid: c.uid, distanceM: Math.round(d) });
    else excluded.outOfRange++;
  }
  selected.sort((a, b) => a.distanceM - b.distanceM);
  return { selected, excluded };
}
