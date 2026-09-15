/**
 * Component 1 — Real-Time Health Monitoring (owner: Rizvi M.Z.M.)
 *
 * C1 does all detection on-device and writes straight to RTDB, so it has no
 * hard dependency on Cloud Functions (which require the Blaze plan).
 *
 * TODO(C1): scheduled history pruning (keep last 24 h of devices/{id}/history).
 */
export {};
