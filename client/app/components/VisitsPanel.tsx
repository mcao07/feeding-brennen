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
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        Visits
      </button>

      {open && (
        <div className="ml-4 mt-2 space-y-2 border-l border-gray-100 pl-4">
          <LogVisitModal restaurantId={restaurantId} onLogged={reload} />

          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* The API orders visits newest date first, so this renders them in
              the order they arrived rather than sorting a second time. */}
          {visits?.map((visit) => (
            <div key={visit.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex items-baseline gap-2">
                <span className="text-gray-600">{visit.date}</span>
                <span className="font-medium">
                  {visit.amountSpent === null ? '—' : formatUsd(visit.amountSpent)}
                </span>
                {visit.notes && <span className="text-gray-500">{visit.notes}</span>}
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
