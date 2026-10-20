import { Link, useRouteError } from "react-router-dom";

/** Shown instead of a blank screen when a page throws while rendering. */
export function RouteError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="card max-w-lg space-y-3 text-center">
        <h1 className="text-lg font-bold">This page could not be displayed</h1>
        <p className="text-sm text-muted">Some data did not have the expected format. Other pages keep working.</p>
        <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-left text-xs">{message}</pre>
        <div className="flex justify-center gap-2">
          <button type="button" className="btn-outline" onClick={() => window.location.reload()}>
            Reload
          </button>
          <Link className="btn-primary" to="/overview">
            Event Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
