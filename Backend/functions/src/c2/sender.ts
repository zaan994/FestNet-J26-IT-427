/**
 * C2 — notification sender abstraction. All push calls go through NotificationSender so tests
 * inject FakeSender and production injects FcmSender (sender-fcm.ts).
 *
 * "accepted" means the push service accepted the request. It is NOT proof that a device showed the
 * notification or that a person saw it — acknowledgement in the app/dashboard is the only proof of that.
 */
export interface PushMessage {
  token: string;
  title: string;
  body: string;
  /** String-only payload (FCM data): ids and severity, never health values or identity. */
  data: Record<string, string>;
}

export interface SendResult {
  token: string;
  ok: boolean;
  /** Token is permanently invalid (unregistered / malformed) → remove it. */
  invalidToken: boolean;
  /** Temporary failure → safe to retry. */
  transient: boolean;
  error?: string;
}

export interface NotificationSender {
  readonly name: string;
  sendMany(messages: PushMessage[]): Promise<SendResult[]>;
}

/** Test double: records messages; per-token outcomes can be scripted. */
export class FakeSender implements NotificationSender {
  readonly name = "fake";
  readonly sent: PushMessage[] = [];
  constructor(private readonly outcome: (token: string, attempt: number) => Omit<SendResult, "token"> = () => ({ ok: true, invalidToken: false, transient: false })) {}
  private attempts = new Map<string, number>();
  async sendMany(messages: PushMessage[]): Promise<SendResult[]> {
    return messages.map((m) => {
      const attempt = (this.attempts.get(m.token) ?? 0) + 1;
      this.attempts.set(m.token, attempt);
      this.sent.push(m);
      return { token: m.token, ...this.outcome(m.token, attempt) };
    });
  }
}
