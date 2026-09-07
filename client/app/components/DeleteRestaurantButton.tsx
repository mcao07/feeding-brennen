'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteRestaurant } from '@/lib/apiClient';

/**
 * Delete button for one restaurant row. Confirms first because the delete
 * also removes the restaurant's visit history (ON DELETE CASCADE), then
 * refreshes the server-rendered list so the row disappears.
 */
export default function DeleteRestaurantButton({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`Delete ${name}? Its visit history goes with it.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteRestaurant(id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setDeleting(false);
    }
  }

  return (
    <span className="flex items-baseline gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={remove}
        disabled={deleting}
        aria-label={`Delete ${name}`}
        title="Delete"
        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <TrashIcon />
      </button>
    </span>
  );
}

/** Inline SVG so there is no icon dependency to add. */
function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
