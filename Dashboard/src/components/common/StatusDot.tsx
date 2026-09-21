interface Props {
  online: boolean;
  label?: string;
}

export function StatusDot({ online, label }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <span className="relative flex h-2.5 w-2.5">
        {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-severity-none opacity-60" />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online ? "bg-severity-none" : "bg-muted/40"}`} />
      </span>
      {label ?? (online ? "Online" : "Offline")}
    </span>
  );
}
