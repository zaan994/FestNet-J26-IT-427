import { useState } from "react";

import { PageHeader } from "@/components/common/PageHeader";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { EmptyState } from "@/components/common/States";
import { usePermissions } from "@/hooks/useAuth";
import { useEventContext } from "@/hooks/useEventContext";

import { AssignmentPanel } from "../components/AssignmentPanel";
import { EventSettingsPanel } from "../components/EventSettingsPanel";
import { InventoryPanel } from "../components/InventoryPanel";
import { ParticipantsPanel } from "../components/ParticipantsPanel";

type Tab = "assign" | "participants" | "inventory" | "event";

export function ManagementPage() {
  const { selectedEventId } = useEventContext();
  const { isDeviceAdmin } = usePermissions();
  const [tab, setTab] = useState<Tab>(selectedEventId ? "assign" : "event");

  const options = [
    { value: "assign" as const, label: "Assignments" },
    { value: "participants" as const, label: "Participants" },
    ...(isDeviceAdmin ? [{ value: "inventory" as const, label: "Inventory" }] : []),
    { value: "event" as const, label: "Event settings" },
  ];

  const needsEvent = (tab === "assign" || tab === "participants") && !selectedEventId;

  return (
    <>
      <PageHeader
        eyebrow="Module C · Device & attendee assignment"
        title="Event & Devices"
        subtitle="All privileged changes are executed and re-checked by the FestNet backend and written to the audit log."
        actions={<SegmentedControl label="Section" value={tab} onChange={setTab} options={options} />}
      />
      {needsEvent ? (
        <EmptyState title="No event selected">Select or create an event first.</EmptyState>
      ) : tab === "assign" ? (
        <AssignmentPanel eventId={selectedEventId!} />
      ) : tab === "participants" ? (
        <ParticipantsPanel eventId={selectedEventId!} />
      ) : tab === "inventory" ? (
        <InventoryPanel />
      ) : (
        <EventSettingsPanel eventId={selectedEventId} />
      )}
    </>
  );
}
