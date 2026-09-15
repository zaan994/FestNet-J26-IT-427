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
      <PageHeader title={title} subtitle={`${component} · Owner: ${owner}`} />
      <div className="card border-dashed">
        <p className="text-sm font-medium text-slate-700">Not implemented yet. Planned for this page:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {planned.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
