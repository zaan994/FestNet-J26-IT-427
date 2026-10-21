/**
 * Firebase Cloud Messaging implementation of NotificationSender (firebase-admin, trusted hosts only:
 * Cloud Functions and the local worker). Service credentials never reach a client.
 */
// Type-only import: each host passes ITS OWN firebase-admin Messaging instance (Functions and the
// worker install firebase-admin separately; a second copy would have no initialised app).
import type { Message, Messaging } from "firebase-admin/messaging";

import type { NotificationSender, PushMessage, SendResult } from "./sender";

const INVALID = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"]);
const TRANSIENT = new Set(["messaging/internal-error", "messaging/server-unavailable", "messaging/unavailable", "messaging/message-rate-exceeded", "messaging/quota-exceeded"]);

export class FcmSender implements NotificationSender {
  readonly name = "fcm";
  constructor(private readonly messaging: Messaging) {}

  async sendMany(messages: PushMessage[]): Promise<SendResult[]> {
    if (!messages.length) return [];
    const payload: Message[] = messages.map((m) => ({
      token: m.token,
      notification: { title: m.title, body: m.body },
      data: m.data,
      android: { priority: "high", notification: { sound: "default" } },
      apns: { payload: { aps: { sound: "default" } } },
      webpush: { headers: { Urgency: "high" } },
    }));
    const results: SendResult[] = [];
    // sendEach accepts at most 500 messages per call.
    for (let i = 0; i < payload.length; i += 500) {
      const batch = payload.slice(i, i + 500);
      const res = await this.messaging.sendEach(batch);
      res.responses.forEach((r, j) => {
        const token = messages[i + j].token;
        if (r.success) return results.push({ token, ok: true, invalidToken: false, transient: false });
        const code = r.error?.code ?? "unknown";
        results.push({ token, ok: false, invalidToken: INVALID.has(code), transient: TRANSIENT.has(code), error: code });
      });
    }
    return results;
  }
}
