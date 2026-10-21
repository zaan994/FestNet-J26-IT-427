/**
 * C2 web push (Firebase Cloud Messaging) for staff using the dashboard.
 *
 * - The token is stored ONLY in emergency/responders/{uid}/tokens/{key} (readable by the owner and
 *   the backend; validated by the security rules). No FCM credentials ever reach the browser.
 * - Requires VITE_FIREBASE_VAPID_KEY (Firebase console → Project settings → Cloud Messaging →
 *   Web Push certificates). Without it, push stays off and alerts still appear in the dashboard.
 * - Whether a notification is shown while the tab is closed depends on the browser/OS and must be
 *   verified on the target device.
 */
import { ref, remove, serverTimestamp, set } from "firebase/database";
import { deleteToken, getMessaging, getToken, isSupported, onMessage, type MessagePayload } from "firebase/messaging";

import { db, firebaseApp } from "@/config/firebase";
import { paths } from "@shared/paths";

const env = import.meta.env;
const STORAGE_KEY = "festnet-push-token-key";

export const VAPID_KEY: string | undefined = env.VITE_FIREBASE_VAPID_KEY || undefined;

/** Stable, RTDB-safe key for a token (FNV-1a, hex). */
export function tokenKey(token: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `web-${(h >>> 0).toString(16)}-${token.length}`;
}

export async function pushSupported(): Promise<boolean> {
  try {
    return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && (await isSupported());
  } catch {
    return false;
  }
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // The worker cannot read Vite env vars, so the public web config is passed in the URL.
  const params = new URLSearchParams({
    apiKey: env.VITE_FIREBASE_API_KEY ?? "",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? "",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: env.VITE_FIREBASE_APP_ID ?? "",
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`, { scope: "/" });
}

export type EnableResult = { ok: true } | { ok: false; reason: string };

/** Asks for permission, registers the device token for this signed-in user. */
export async function enablePush(uid: string): Promise<EnableResult> {
  if (!VAPID_KEY) return { ok: false, reason: "Push is not configured (VITE_FIREBASE_VAPID_KEY missing)." };
  if (!(await pushSupported())) return { ok: false, reason: "This browser does not support web push." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Notifications are blocked for this site. Allow them in the browser settings." };
  try {
    const token = await getToken(getMessaging(firebaseApp), { vapidKey: VAPID_KEY, serviceWorkerRegistration: await registration() });
    if (!token) return { ok: false, reason: "The browser did not return a push token." };
    const key = tokenKey(token);
    await set(ref(db, `${paths.responder(uid)}/tokens/${key}`), { token, platform: "web", updatedAt: serverTimestamp() });
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      /* per-device convenience only */
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Could not register for push." };
  }
}

/** Removes this browser's token (call before signing out). */
export async function disablePush(uid: string): Promise<void> {
  let key: string | null = null;
  try {
    key = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (key) await remove(ref(db, `${paths.responder(uid)}/tokens/${key}`)).catch(() => {});
  if (await pushSupported()) await deleteToken(getMessaging(firebaseApp)).catch(() => {});
}

export function pushEnabledHere(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY) && typeof Notification !== "undefined" && Notification.permission === "granted";
  } catch {
    return false;
  }
}

/** Messages that arrive while the dashboard tab is in the foreground. */
export async function onForegroundPush(cb: (p: MessagePayload) => void): Promise<() => void> {
  if (!(await pushSupported())) return () => {};
  return onMessage(getMessaging(firebaseApp), cb);
}
