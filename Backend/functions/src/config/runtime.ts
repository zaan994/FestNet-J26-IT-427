/** Cloud Functions deployment settings and the Functions-hosted service context. */
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";
import * as logger from "firebase-functions/logger";

import { FcmSender } from "../c2/sender-fcm";
import type { ServiceContext } from "../services/context";

// The default RTDB instance (festnetproject-default-rtdb.firebaseio.com) lives in us-central1;
// database triggers must run in the same region.
export const REGION = "us-central1";
export const DB_INSTANCE = "festnetproject-default-rtdb";
export const MAX_INSTANCES = 10;

export function functionsContext(): ServiceContext {
  return {
    db: getDatabase(),
    now: () => Date.now(),
    lookupUid: async (email) => {
      try {
        return (await getAuth().getUserByEmail(email)).uid;
      } catch {
        return null;
      }
    },
    log: (level, message, data) => logger[level](message, data ?? {}),
    sender: (fcm ??= new FcmSender(getMessaging())),
  };
}

let fcm: FcmSender | undefined;
