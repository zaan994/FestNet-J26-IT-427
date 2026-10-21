import { useCallback, useState } from "react";

import { Icon } from "@/components/common/Icon";
import { parseQr, QrScanner, type QrKind } from "@/components/common/Qr";

/**
 * Staff-side ID field: scan the printed QR code with the laptop/tablet camera, or type it.
 * (Attendees never type device IDs — they redeem a one-time claim code in the app.)
 */
export function ScanField({ kind, label, value, onChange, placeholder }: {
  kind: QrKind;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onResult = useCallback(
    (text: string) => {
      setScanning(false);
      const id = parseQr(kind, text);
      if (id) {
        setError(null);
        onChange(id);
      } else setError(`That QR code is not a ${kind} code.`);
    },
    [kind, onChange],
  );

  return (
    <div className="space-y-2">
      <label className="block text-sm">
        <span className="eyebrow">{label}</span>
        <div className="mt-1 flex gap-2">
          <input className="input font-mono" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value.trim())} />
          <button type="button" className="btn-outline shrink-0" onClick={() => setScanning((s) => !s)}>
            <Icon name="qr" className="h-4 w-4" /> Scan
          </button>
        </div>
      </label>
      {scanning && <QrScanner onResult={onResult} onClose={() => setScanning(false)} />}
      {error && <p className="text-xs text-status-warning">{error}</p>}
    </div>
  );
}
