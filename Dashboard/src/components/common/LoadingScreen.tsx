export function LoadingScreen({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
        {message}
      </div>
    </div>
  );
}
