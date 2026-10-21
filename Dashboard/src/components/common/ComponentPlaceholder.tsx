import { PageHeader } from "./PageHeader";

interface Props {
  title: string;
  component: string;
  owner: string;
  planned: string[];
}

/** Placeholder page for a component that has not been built yet. */
export function ComponentPlaceholder({ title, component, owner, planned }: Props) {
  return (
    <>
      <PageHeader eyebrow={component} title={title} subtitle={`Owner: ${owner}`} />
      <div className="card relative overflow-hidden border-dashed">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-2xl" />
        <p className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">Coming soon</p>
        <p className="mt-4 text-sm font-semibold">Planned for this page</p>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {planned.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gradient" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
