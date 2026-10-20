/**
 * QR generation and scanning. QR payloads are opaque identifiers only:
 *   FESTNET-DEVICE:<deviceId>   FESTNET-PARTICIPANT:<participantId>   FESTNET-CLAIM:<one-time code>
 * They never contain health data, personal details or credentials.
 */
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

export function QrImage({ value, size = 180, label }: { value: string; size?: number; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" })
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setUrl(null));
    return () => {
      cancelled = true;
    };
  }, [value, size]);
  return (
    <figure className="inline-flex flex-col items-center gap-2 rounded-2xl border border-line bg-white p-3">
      {url ? <img src={url} width={size} height={size} alt={`QR code: ${label}`} /> : <div className="skeleton" style={{ width: size, height: size }} />}
      <figcaption className="max-w-[12rem] break-all text-center font-mono text-xs text-slate-700">{label}</figcaption>
    </figure>
  );
}

export type QrKind = "device" | "participant" | "claim";
const PREFIX: Record<QrKind, string> = { device: "FESTNET-DEVICE:", participant: "FESTNET-PARTICIPANT:", claim: "FESTNET-CLAIM:" };

export const qrPayload = (kind: QrKind, id: string) => `${PREFIX[kind]}${id}`;

/** Extracts the id from a scanned payload of the expected kind (or a bare id typed by staff). */
export function parseQr(kind: QrKind, text: string): string | null {
  const t = text.trim();
  if (t.startsWith(PREFIX[kind])) return t.slice(PREFIX[kind].length).trim() || null;
  if (Object.values(PREFIX).some((p) => t.startsWith(p))) return null; // wrong kind of code
  return t || null;
}

/** Camera scanner (ZXing, loaded on demand). Falls back to manual entry if no camera. */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (result && !cancelled) {
            cancelled = true;
            controls.stop();
            onResult(result.getText());
          }
        });
        stop = () => controls.stop();
      } catch {
        setError("Camera not available. Type the code instead, or allow camera access in the browser.");
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [onResult]);

  return (
    <div className="space-y-2">
      <video ref={videoRef} className="aspect-video w-full max-w-sm rounded-xl bg-black" muted playsInline />
      {error && <p className="text-xs text-status-warning">{error}</p>}
      <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
        Close camera
      </button>
    </div>
  );
}
