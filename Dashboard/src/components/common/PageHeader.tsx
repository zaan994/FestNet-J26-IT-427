import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: ReactNode;
  /** Small label above the title, e.g. "Component 1". */
  eyebrow?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, eyebrow, actions }: Props) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1 text-brand">{eyebrow}</p>}
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
