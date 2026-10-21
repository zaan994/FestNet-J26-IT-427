import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/common/Badges";
import { useEmergencies } from "@/hooks/useEventData";
import { onForegroundPush } from "@/services/push";

/** Header badge: unacknowledged alerts of the selected event (links to the command centre). */
export function OpenAlertsBadge({ eventId }: { eventId: string | null }) {
  const { data } = useEmergencies(eventId, 100);
  const open = data.filter((e) => e.status === "open" || e.status === "escalated");
  if (!eventId || !open.length) return null;
  const critical = open.some((e) => e.severity === "critical" || e.type === "sos");
  return (
    <Link to="/emergency" aria-label={`${open.length} unacknowledged alerts`}>
      <Badge tone={critical ? "critical" : "danger"} icon={<span aria-hidden="true">⚠</span>}>
        {open.length} unacknowledged
      </Badge>
    </Link>
  );
}

interface Banner {
  id: string;
  title: string;
  body: string;
  url: string;
}

/** Pushes received while this tab is open (the OS shows them only when the tab is in the background). */
export function PushBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  useEffect(() => {
    let unsub = () => {};
    void onForegroundPush((p) => {
      const id = p.messageId ?? String(Date.now());
      setBanners((b) => [
        { id, title: p.notification?.title ?? "FestNet alert", body: p.notification?.body ?? "", url: p.data?.url ?? "/emergency" },
        ...b.slice(0, 2),
      ]);
    }).then((u) => (unsub = u));
    return () => unsub();
  }, []);
  if (!banners.length) return null;
  return (
    <div role="alert" className="space-y-1 border-b border-status-critical/40 bg-status-critical/10 px-4 py-2 lg:px-8">
      {banners.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center gap-3 text-sm">
          <b>{b.title}</b>
          <span className="text-muted">{b.body}</span>
          <Link className="ml-auto font-semibold text-brand hover:underline" to={b.url} onClick={() => setBanners((x) => x.filter((y) => y.id !== b.id))}>
            Open
          </Link>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setBanners((x) => x.filter((y) => y.id !== b.id))}>
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
