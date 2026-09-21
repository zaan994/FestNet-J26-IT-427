import { LoadingScreen } from "@/components/common/LoadingScreen";
import { PageHeader } from "@/components/common/PageHeader";
import { useBands } from "@/hooks/useBands";
import { useNow } from "@/hooks/useNow";
import { SEVERITY_ORDER } from "@shared/schema";

import { BandHealthCard } from "../components/BandHealthCard";

// C1 — Real-Time Health Monitoring (Rizvi M.Z.M.)
export function LiveHealthPage() {
  const { bands, loading } = useBands();
  const now = useNow(1000);

  if (loading) return <LoadingScreen message="Loading bands…" />;

  // Most urgent first: online bands by severity, then offline bands.
  const sorted = [...bands].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    const sa = SEVERITY_ORDER[a.health?.anomaly.severity ?? "none"];
    const sb = SEVERITY_ORDER[b.health?.anomaly.severity ?? "none"];
    return sb - sa || a.deviceId.localeCompare(b.deviceId);
  });
  const onlineCount = bands.filter((b) => b.online).length;
  const alerting = sorted.filter((b) => b.online && b.health?.anomaly.active).length;

  return (
    <>
      <PageHeader
        eyebrow="Component 1 · Real-time health"
        title="Live Health"
        subtitle={
          <>
            <b className="text-ink">{onlineCount}</b> of {bands.length} bands online ·{" "}
            <b className={alerting ? "text-severity-critical" : "text-ink"}>{alerting}</b> with active anomalies · updates every 2 s
          </>
        }
      />
      {sorted.length === 0 ? (
        <div className="card text-sm text-muted">No bands registered. Add one on the Event Overview page.</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((band) => (
            <BandHealthCard key={band.deviceId} band={band} now={now} />
          ))}
        </div>
      )}
    </>
  );
}
