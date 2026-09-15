interface Props {
  online: boolean;
  label?: string;
}

export function StatusDot({ online, label }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-green-500 animate-pulse" : "bg-slate-300"}`} />
      {label ?? (online ? "Online" : "Offline")}
    </span>
  );
}
