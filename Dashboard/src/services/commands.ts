import { onValue, push, ref, serverTimestamp, set } from "firebase/database";

import { auth, db } from "@/config/firebase";
import type { Command, CommandType } from "@/types";
import { paths } from "@shared/paths";

export class CommandError extends Error {}

export const COMMAND_TIMEOUT_MS = 20_000;

/**
 * Queues a privileged action for the trusted backend (Cloud Functions or `npm run worker`) and
 * waits for its result. The browser never performs the action itself; the backend re-checks
 * the user's role, validates the payload and writes the outcome to the same node.
 */
export async function sendCommand<R = Record<string, unknown>>(type: CommandType, payload: Record<string, unknown>): Promise<R> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new CommandError("You are signed out.");
  const node = push(ref(db, paths.commands(uid)));
  try {
    await set(node, { type, payload, createdAt: serverTimestamp() });
  } catch {
    throw new CommandError("Could not send the request (permission or network problem).");
  }

  return new Promise<R>((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(
        new CommandError(
          "No response from the FestNet backend within 20 s. It may still complete — check before retrying. " +
            "Is the worker (npm run worker) or the Cloud Functions deployment running?",
        ),
      );
    }, COMMAND_TIMEOUT_MS);
    const unsubscribe = onValue(node, (snap) => {
      const v = snap.val() as Command | null;
      if (!v || !v.status || (v.status as string) === "processing") return;
      clearTimeout(timer);
      unsubscribe();
      if (v.status === "ok") resolve((v.result ?? {}) as R);
      else reject(new CommandError(v.error ?? "The action failed."));
    });
  });
}
