import { ComponentPlaceholder } from "@/components/common/ComponentPlaceholder";

// C2 — Emergency Alert System (Manubasha K.D.C.)
export function RespondersPage() {
  return (
    <ComponentPlaceholder
      title="Responders"
      component="Component 2"
      owner="Manubasha K.D.C."
      planned={[
        "Medical team and volunteer roster (users/ with role volunteer | medical)",
        "Volunteer availability and last known location",
        "Proximity view: responders within 50 m of an active alert",
      ]}
    />
  );
}
