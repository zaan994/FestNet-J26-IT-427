import { ComponentPlaceholder } from "@/components/common/ComponentPlaceholder";

// C3 — Location & Crowd Tracking (Pemarathna P.A.J.)
export function CrowdMonitoringPage() {
  return (
    <ComponentPlaceholder
      title="Crowd Monitoring"
      component="Component 3"
      owner="Pemarathna P.A.J."
      planned={[
        "Leaflet map with live band pins and crowd density heatmap (react-leaflet is installed)",
        "Crowd flow direction vectors and surge alerts (> 1.5 m/s within 20 m)",
        "Event zone editor: draw stage / exit / first-aid / toilet polygons into events/{id}/zones",
      ]}
    />
  );
}
