'use client';

import { useState } from 'react';
import { ApiError, deleteVisit } from '@/lib/apiClient';
import TrashIcon from './TrashIcon';

/**
 * Delete button for one visit sub-row. One click removes the visit, then hands
 * back to the panel through `onDeleted`: the panel owns both the list and the
 * page refresh, so the row and the restaurant's total move together. No
 * confirmation, for the same reason DeleteRestaurantButton has none.
 */
export default function DeleteVisitButton({
  restaurantId,
  visitId,
  onDeleted,
}: {
  restaurantId: number;
  visitId: number;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAndReload() {
    setDeleting(true);
    setError(null);
    try {
      await deleteVisit(restaurantId, visitId);
      onDeleted();
    } catch (err) {
      // A 404 means someone else already deleted it, which is the outcome the
      // click asked for. Reloading drops the stale row instead of blaming it.
      if (err instanceof ApiError && err.status === 404) {
        onDeleted();
        return;
      }
      setError(err instanceof Error ? err.message : 'Something went wrong');
      // Only on failure. After a successful delete the button stays disabled
      // on purpose, until the reloaded list unmounts the row.
      setDeleting(false);
    }
  }

  return (
    <span className="flex items-baseline gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={deleteAndReload}
        disabled={deleting}
        aria-label="Delete visit"
        title="Delete"
        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <TrashIcon />
      </button>
    </span>
  );
}
