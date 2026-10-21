import { useId } from "react";

/** Keyboard- and hover-accessible tooltip ("i" button). */
export function InfoTip({ text, label = "More information" }: { text: string; label?: string }) {
  const id = useId();
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-muted/50 text-[10px] font-bold leading-none text-muted hover:border-brand hover:text-brand"
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 w-72 -translate-x-1/2 rounded-xl border border-line bg-elevated p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink opacity-0 shadow-card transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
