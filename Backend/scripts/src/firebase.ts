/** Firebase Admin bootstrap for the CLI scripts (real project or local emulators). */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";

/** Minimal .env loader (KEY=value lines) so no extra dependency is needed. */
function loadEnvFile(file = resolve(process.cwd(), ".env")) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

loadEnvFile();

const projectId = process.env.FIREBASE_PROJECT_ID ?? "festnetproject";
const databaseURL =
  process.env.FIREBASE_DATABASE_URL ?? `https://${projectId}-default-rtdb.firebaseio.com`;
const usingEmulator = Boolean(process.env.FIREBASE_DATABASE_EMULATOR_HOST);

if (!usingEmulator && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    "No credentials. Set GOOGLE_APPLICATION_CREDENTIALS (service account) or " +
      "FIREBASE_DATABASE_EMULATOR_HOST in Backend/scripts/.env — see .env.example.",
  );
  process.exit(1);
}

// With *_EMULATOR_HOST set, the Admin SDK routes to the emulators automatically.
const app = initializeApp(
  usingEmulator ? { projectId, databaseURL } : { projectId, databaseURL, credential: applicationDefault() },
);

export const db = getDatabase(app);
export const auth = getAuth(app);
/** FCM (C2 push notifications). Works on the free plan; uses the same service account. */
export const messaging = getMessaging(app);
export const target = usingEmulator ? "emulator" : projectId;
