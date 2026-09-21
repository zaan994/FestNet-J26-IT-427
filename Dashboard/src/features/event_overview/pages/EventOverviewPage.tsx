import { Icon, type IconName } from "@/components/common/Icon";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useBands } from "@/hooks/useBands";

import { AddBandForm } from "../components/AddBandForm";
import { BandTable } from "../components/BandTable";

interface StatProps {
  label: string;
  value: number;
  icon: IconName;
  /** Highlight style when the number needs attention. */
  tone?: "brand" | "good" | "warn" | "critical";
  hint: string;
}

const TONES = {
  brand: "bg-brand-gradient text-white shadow-glow",
  good: "bg-severity-none/15 text-severity-none",
  warn: "bg-severity-danger/15 text-severity-danger",
  critical: "bg-severity-critical text-white",
} as const;

function Stat({ label, value, icon, tone = "brand", hint }: StatProps) {
  return (
    <div className="card flex items-center gap-4">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${TONES[tone]}`}>
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div>
        <p className="eyebrow">{label}</p>
        <p className="text-3xl font-extrabold leading-tight tabular-nums">{value}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
    </div>
  );
}

export function EventOverviewPage() {
  const { profile } = useAuth();
  const { bands, loading } = useBands();

  if (loading) return <LoadingScreen message="Loading bands…" />;

  const online = bands.filter((b) => b.online).length;
  const sos = bands.filter((b) => b.online && b.latest?.sosActive).length;
  const anomalies = bands.filter((b) => b.online && b.health?.anomaly.active).length;

  return (
    <>
      <PageHeader eyebrow="Demo Festival" title="Event Overview" subtitle="Live status of every registered FestNet band" />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registered bands" value={bands.length} icon="watch" hint="in deviceIndex" />
        <Stat label="Online" value={online} icon="signal" tone="good" hint="uploaded in the last 15 s" />
        <Stat
          label="Active anomalies"
          value={anomalies}
          icon="heart"
          tone={anomalies ? "warn" : "good"}
          hint={anomalies ? "see Live Health" : "all clear"}
        />
        <Stat label="SOS active" value={sos} icon="alert" tone={sos ? "critical" : "good"} hint={sos ? "respond now" : "no SOS"} />
      </div>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Bands</h2>
            <p className="text-xs text-muted">Click a band for its live health</p>
          </div>
          {profile?.role === "organiser" && <AddBandForm />}
        </div>
        <BandTable bands={bands} />
      </section>
    </>
  );
}
