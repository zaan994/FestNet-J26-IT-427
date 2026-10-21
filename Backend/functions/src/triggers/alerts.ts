/**
 * Requests from clients and devices, executed by the trusted backend.
 *
 *  onCommandCreated     commands/{uid}/{commandId}        staff actions (assign, return, alerts …)
 *  onSosRequestCreated  sosRequests/{uid}/{requestId}     attendee-app SOS
 *  onClaimRequested     claimRequests/{uid}/{requestId}   attendee claim code
 *  onDeviceSosPressed   devices/{id}/latest/sosPressCount band SOS button (fires only when it changes)
 *  escalateAlerts       every minute                       C2 escalation of unacknowledged alerts
 *
 * All of these are also handled by the local worker (Backend/scripts: npm run worker).
 */
import { onValueCreated, onValueWritten } from "firebase-functions/v2/database";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { escalateDue } from "../c2/escalation";
import { DB_INSTANCE, functionsContext, REGION } from "../config/runtime";
import { redeemClaim } from "../services/assignments";
import { executeCommand } from "../services/commands";
import { handleAppSos, handleDeviceSos } from "../services/emergencies";
import type { ClaimRequest, Command, SosRequest } from "../shared";

const opts = (ref: string) => ({ ref, instance: DB_INSTANCE, region: REGION, retry: true });

export const onCommandCreated = onValueCreated(opts("/festnet/commands/{uid}/{commandId}"), async (event) => {
  await executeCommand(functionsContext(), event.params.uid, event.params.commandId, event.data.val() as Command | null);
});

export const onSosRequestCreated = onValueCreated(opts("/festnet/sosRequests/{uid}/{requestId}"), async (event) => {
  await handleAppSos(functionsContext(), event.params.uid, event.params.requestId, event.data.val() as SosRequest | null);
});

export const onClaimRequested = onValueCreated(opts("/festnet/claimRequests/{uid}/{requestId}"), async (event) => {
  const request = event.data.val() as ClaimRequest | null;
  if (!request || request.status) return;
  await redeemClaim(functionsContext(), event.params.uid, event.params.requestId, request.code);
});

/** C2: escalate alerts not acknowledged within the timeout (Cloud Scheduler, Blaze plan). */
export const escalateAlerts = onSchedule({ schedule: "every 1 minutes", region: REGION, timeoutSeconds: 60 }, async () => {
  await escalateDue(functionsContext());
});

export const onDeviceSosPressed = onValueWritten(opts("/festnet/devices/{deviceId}/latest/sosPressCount"), async (event) => {
  const before = event.data.before.val();
  const after = event.data.after.val();
  if (typeof after !== "number" || after === before) return;
  // Each new press value is its own SOS (idempotent per boot + press count).
  await handleDeviceSos(functionsContext(), event.params.deviceId, after);
});
