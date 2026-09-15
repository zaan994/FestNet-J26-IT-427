import { LoadingScreen } from "@/components/common/LoadingScreen";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useBands } from "@/hooks/useBands";

import { AddBandForm } from "../components/AddBandForm";
import { BandTable } from "../components/BandTable";

function Stat({ label, value, tone = "text-slate-900" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

export function EventOverviewPage() {
  const { profile } = useAuth();
  const { bands, loading } = useBands();

  if (loading) return <LoadingScreen message="Loading bands…" />;

  const online = bands.filter((b) => b.online).length;
  const sos = bands.filter((b) => b.latest?.sosActive).length;
  const anomalies = bands.filter((b) => b.latest?.anomaly?.active).length;

  return (
    <>
      <PageHeader title="Event Overview" subtitle="Live status of every registered FestNet band" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Registered bands" value={bands.length} />
        <Stat label="Online" value={online} tone="text-green-600" />
        <Stat label="Active anomalies" value={anomalies} tone={anomalies ? "text-orange-600" : undefined} />
        <Stat label="SOS active" value={sos} tone={sos ? "text-red-600" : undefined} />
      </div>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Bands</h2>
          {profile?.role === "organiser" && <AddBandForm />}
        </div>
        <BandTable bands={bands} />
      </section>
    </>
  );
}
