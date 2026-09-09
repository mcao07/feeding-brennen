'use client';

import { useState } from 'react';
import { formatUsd } from '@/lib/format';
import type { Restaurant, RestaurantSpend } from '@/lib/types';
import DeleteRestaurantButton from './DeleteRestaurantButton';
import VisitsPanel from './VisitsPanel';

/**
 * The searchable restaurant list. The page fetches; this component only
 * holds the search text and filters what it was given.
 *
 * Filtering happens in the browser because the whole list is already here:
 * instant, and no request per keystroke. A server-side `?q=` would make a
 * search shareable by URL and is the right move only once the list is too
 * large to load at once.
 */
export default function RestaurantList({
  restaurants,
  spend,
}: {
  restaurants: Restaurant[];
  spend: RestaurantSpend[];
}) {
  const [query, setQuery] = useState('');
  // A Map is not serializable across the server/client boundary, so the page
  // passes the array and the lookup is rebuilt here.
  const spendByRestaurantId = new Map(spend.map((s) => [s.restaurantId, s]));

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? restaurants.filter((r) => r.name.toLowerCase().includes(needle))
    : restaurants;

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search restaurants by name"
        aria-label="Search restaurants by name"
        className="mb-4 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
      />

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
          {restaurants.length === 0
            ? 'No restaurants yet. Add one to get started.'
            : `No restaurants match “${query.trim()}”.`}
        </p>
      ) : (
        <ul className="space-y-4">
          {shown.map((restaurant) => (
            <li
              key={restaurant.id}
              className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm shadow-stone-900/[0.03]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold tracking-tight text-stone-900">
                    {restaurant.name}
                  </h3>
                  {(restaurant.cuisine || restaurant.address) && (
                    <div className="mt-0.5 truncate text-sm text-stone-500">
                      {[restaurant.cuisine, restaurant.address].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {restaurant.rating !== null && (
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-medium tabular-nums text-stone-700">
                      {restaurant.rating} ★
                    </span>
                  )}
                  <DeleteRestaurantButton id={restaurant.id} name={restaurant.name} />
                </div>
              </div>
              <div className="mt-3 text-sm tabular-nums text-stone-500">
                {describeSpend(spendByRestaurantId.get(restaurant.id))}
              </div>
              <VisitsPanel restaurantId={restaurant.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The row's spend summary. A restaurant with no visits says so rather than
 * showing $0.00, which would read as a visit that cost nothing. The totals
 * endpoint returns every restaurant, so `undefined` only happens if a row was
 * added between the two fetches; it reads as no visits rather than crashing.
 */
function describeSpend(spend: RestaurantSpend | undefined) {
  if (!spend || spend.visitCount === 0) return 'No visits yet';
  const noun = spend.visitCount === 1 ? 'visit' : 'visits';
  return `${formatUsd(spend.totalSpent)} across ${spend.visitCount} ${noun}`;
}
