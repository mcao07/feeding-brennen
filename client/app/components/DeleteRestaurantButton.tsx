'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, deleteRestaurant } from '@/lib/apiClient';
import TrashIcon from './TrashIcon';

/**
 * Delete button for one restaurant row. One click deletes the restaurant
 * and, through ON DELETE CASCADE, its visit history, then refreshes the
 * server-rendered list so the row disappears. No confirmation: browsers
 * can suppress window.confirm, and an in-page guard is a later refinement.
 */
export default function DeleteRestaurantButton({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAndRefresh() {
    setDeleting(true);
    setError(null);
    try {
      await deleteRestaurant(id);
      router.refresh();
    } catch (err) {
      // A 404 means someone else already deleted it, which is the outcome the
      // click asked for. Refreshing drops the stale row instead of blaming it.
      if (err instanceof ApiError && err.status === 404) {
        router.refresh();
        return;
      }
      setError(err instanceof Error ? err.message : 'Something went wrong');
      // Only on failure. After a successful delete the button stays disabled
      // on purpose, until the refreshed list unmounts the row.
      setDeleting(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={deleteAndRefresh}
        disabled={deleting}
        aria-label={`Delete ${name}`}
        title="Delete"
        className="rounded-md p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:opacity-50"
      >
        <TrashIcon />
      </button>
    </span>
  );
}
