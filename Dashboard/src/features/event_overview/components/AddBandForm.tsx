import { useState, type FormEvent } from "react";

import { Icon } from "@/components/common/Icon";
import { addDeviceToIndex } from "@/services/deviceService";

/** Organiser-only: register a band ID (e.g. FESTNET_001) in deviceIndex/ so it shows up here. */
export function AddBandForm() {
  const [deviceId, setDeviceId] = useState("");
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const id = deviceId.trim().toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(id)) {
      setStatus("Use letters, digits, _ or - only");
      return;
    }
    try {
      await addDeviceToIndex(id, label.trim());
      setStatus(`Added ${id}`);
      setDeviceId("");
      setLabel("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed (organiser role required)");
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input className="input w-40" placeholder="FESTNET_001" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} required />
      <input className="input w-40" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <button className="btn-primary" type="submit">
        <Icon name="plus" className="h-4 w-4" />
        Add band
      </button>
      {status && <span className="text-xs text-muted">{status}</span>}
    </form>
  );
}
