export function LoadingScreen({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
        {message}
      </div>
    </div>
  );
}
