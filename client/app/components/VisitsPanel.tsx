'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getVisits } from '@/lib/apiClient';
import { formatUsd } from '@/lib/format';
import type { Visit } from '@/lib/types';
import DeleteVisitButton from './DeleteVisitButton';
import LogVisitModal from './LogVisitModal';

/**
 * The collapsible visit history under one restaurant row.
 *
 * Visits load on the first open, not with the page: most rows stay collapsed,
 * and a list per restaurant would be a query per restaurant on every render.
 * Later toggles reuse what is already here; only a log or a delete refetches.
 */
export default function VisitsPanel({ restaurantId }: { restaurantId: number }) {
  const router = useRouter();
  // null until the first fetch resolves, which is what distinguishes "not
  // asked yet" from "asked, and this restaurant has no visits".
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setVisits(await getVisits(restaurantId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const opening = !open;
    setOpen(opening);
    if (opening && visits === null) load();
  }

  // After a log or a delete the list and the row's total are both stale, and
  // they live on either side of the client/server line: the fetch fixes this
  // panel, the refresh re-renders the server component holding the total.
  function reload() {
    load();
    router.refresh();
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded text-sm font-medium text-stone-500 transition hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
      >
        <span aria-hidden="true" className="text-xs">{open ? '▾' : '▸'}</span>
        Visit history
      </button>

      {open && (
        <div className="ml-1 mt-3 space-y-2 border-l border-stone-200 pl-4">
          <LogVisitModal restaurantId={restaurantId} onLogged={reload} />

          {loading && <p className="text-sm text-stone-500">Loading…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* The API orders visits newest date first, so this renders them in
              the order they arrived rather than sorting a second time. */}
          {visits?.map((visit) => (
            <div key={visit.id} className="flex items-center gap-3 py-0.5 text-sm">
              <span className="w-24 shrink-0 tabular-nums text-stone-500">{visit.date}</span>
              <span className="min-w-0 flex-1 truncate text-stone-500">{visit.notes}</span>
              <span className="shrink-0 font-semibold tabular-nums text-stone-900">
                {visit.amountSpent === null ? '—' : formatUsd(visit.amountSpent)}
              </span>
              <DeleteVisitButton
                restaurantId={restaurantId}
                visitId={visit.id}
                onDeleted={reload}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
