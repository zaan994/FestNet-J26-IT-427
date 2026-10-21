import { useEffect, useMemo, useState } from "react";

/** Client-side pagination for bounded lists (large tables are never rendered in one go). */
export function usePagination<T>(items: T[], pageSize = 50) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => {
    if (page >= pages) setPage(pages - 1);
  }, [page, pages]);
  const slice = useMemo(() => items.slice(page * pageSize, page * pageSize + pageSize), [items, page, pageSize]);
  return { page, pages, setPage, slice, total: items.length, pageSize };
}

export function Pagination({ page, pages, setPage, total, pageSize }: { page: number; pages: number; setPage: (p: number) => void; total: number; pageSize: number }) {
  if (total <= pageSize) return null;
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-between text-xs text-muted">
      <span>
        {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} of {total}
      </span>
      <span className="flex gap-2">
        <button type="button" className="btn-outline btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <button type="button" className="btn-outline btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </span>
    </nav>
  );
}
