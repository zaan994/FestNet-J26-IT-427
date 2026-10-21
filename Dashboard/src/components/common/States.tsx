/** Loading skeletons, empty and error states. */
import type { ReactNode } from "react";

export function SkeletonRows({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="skeleton h-6" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-3">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-8 w-16" />
          <div className="skeleton h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface-2/50 px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-status-critical/40 bg-status-critical/10 px-4 py-3 text-sm">
      <span>
        <span aria-hidden="true">⚠ </span>
        {message}
      </span>
      {onRetry && (
        <button type="button" className="btn-outline btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning"; children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === "warning" ? "border-status-warning/40 bg-status-warning/10" : "border-brand/30 bg-brand/5"
      }`}
    >
      {children}
    </div>
  );
}

/** Inline result of a backend command. */
export function CommandFeedback({ pending, error, success }: { pending: boolean; error: string | null; success?: string | null }) {
  if (pending) return <p className="text-xs text-muted">Waiting for the FestNet backend…</p>;
  if (error)
    return (
      <p role="alert" className="text-xs font-medium text-status-critical">
        ⚠ {error}
      </p>
    );
  if (success) return <p className="text-xs font-medium text-status-normal">✓ {success}</p>;
  return null;
}
