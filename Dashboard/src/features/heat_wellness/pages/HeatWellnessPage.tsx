import { ComponentPlaceholder } from "@/components/common/ComponentPlaceholder";

// C4 — Hydration & Wellness Management (Bandara W.M.T.N.)
export function HeatWellnessPage() {
  return (
    <ComponentPlaceholder
      title="Heat & Wellness"
      component="Component 4"
      owner="Bandara W.M.T.N."
      planned={[
        "Heat stress index per attendee (Low / Moderate / High / Critical)",
        "Hydration compliance overview",
        "Attendees at high heat-stress risk",
      ]}
    />
  );
}
