'use client';

import { useEffect, useState } from 'react';
import { ApiError, getSpending } from '@/lib/apiClient';
import { firstOfMonthIso, formatShortDate, formatUsd, localIso, todayIso } from '@/lib/format';
import type { SpendingSummary } from '@/lib/types';

/** The quick ranges, each computed when clicked so "this month" follows the clock. */
const QUICK_RANGES: { label: string; range: () => { from: string; to: string } }[] = [
  { label: 'This month', range: () => ({ from: firstOfMonthIso(), to: todayIso() }) },
  { label: 'Last month', range: lastMonth },
  { label: 'Last 90 days', range: () => ({ from: shiftDays(todayIso(), -89), to: todayIso() }) },
  // Earlier than any visit anyone will have logged, which is what "all" means
  // without a second endpoint to ask when the first visit was.
  { label: 'All time', range: () => ({ from: '2000-01-01', to: todayIso() }) },
];

/**
 * The spending summary above the restaurant list: a date window, quick ranges,
 * six stat tiles, and a per-restaurant breakdown, all from one GET /api/spending.
 *
 * It is a client component because the window belongs to the user, and the
 * defaults have to be computed in the browser: the server's today can be a
 * different day than the user's.
 *
 * `refreshKey` is how the page tells this component that the visits changed.
 * The panels below call `router.refresh()` after a log or a delete, which
 * re-renders the server components but leaves client state exactly as it was -
 * so without a prop that changes, this summary would keep showing the old
 * numbers.
 */
export default function SpendingOverview({ refreshKey }: { refreshKey: string }) {
  const [from, setFrom] = useState(firstOfMonthIso);
  const [to, setTo] = useState(todayIso);
  const [summary, setSummary] = useState<SpendingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ from?: string; to?: string }>({});

  useEffect(() => {
    // Typing in a date input changes `from` on every keystroke, so an earlier
    // request can still be in flight when a later one starts. The flag keeps a
    // slow answer to an old window from overwriting a fresh one.
    let current = true;
    setLoading(true);
    getSpending(from, to)
      .then((next) => {
        if (!current) return;
        setSummary(next);
        setError(null);
        setFieldErrors({});
      })
      .catch((err: unknown) => {
        if (!current) return;
        const message = err instanceof Error ? err.message : 'Something went wrong';
        if (err instanceof ApiError && (err.field === 'from' || err.field === 'to')) {
          setFieldErrors({ [err.field]: message });
          setError(null);
        } else {
          setFieldErrors({});
          setError(message);
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [from, to, refreshKey]);

  function applyRange(range: { from: string; to: string }) {
    setFrom(range.from);
    setTo(range.to);
  }

  return (
    <section className="mb-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm shadow-stone-900/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Spending</h2>
        <div className="flex flex-wrap items-end gap-2">
          <DateField id="spending-from" label="From" value={from} onChange={setFrom} error={fieldErrors.from} />
          <DateField id="spending-to" label="To" value={to} onChange={setTo} error={fieldErrors.to} />
          <div className="flex flex-wrap gap-1">
            {QUICK_RANGES.map((quick) => (
              <button
                key={quick.label}
                type="button"
                onClick={() => applyRange(quick.range())}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              >
                {quick.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {/* The last summary stays on screen while the next one loads, dimmed, so
          changing the range does not collapse the card and move the page. */}
      {summary && (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Tile label="Total spent" value={formatUsd(summary.totalSpent)} />
            <Tile label="Visits" value={String(summary.visitCount)} />
            <Tile label="Unique restaurants" value={String(summary.uniqueRestaurants)} />
            <Tile
              label="Average per visit"
              value={summary.averagePerVisit === null ? '—' : formatUsd(summary.averagePerVisit)}
            />
            <Tile
              label="Most expensive visit"
              value={
                summary.mostExpensiveVisit === null
                  ? '—'
                  : formatUsd(summary.mostExpensiveVisit.amountSpent)
              }
              detail={
                summary.mostExpensiveVisit === null
                  ? undefined
                  : `${summary.mostExpensiveVisit.restaurantName} · ${formatShortDate(summary.mostExpensiveVisit.date)}`
              }
            />
            <Tile
              label="Most visited"
              value={summary.mostVisitedRestaurant?.restaurantName ?? '—'}
              detail={
                summary.mostVisitedRestaurant === null
                  ? undefined
                  : `${summary.mostVisitedRestaurant.visitCount} ${summary.mostVisitedRestaurant.visitCount === 1 ? 'visit' : 'visits'}`
              }
            />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-medium text-stone-800">By restaurant</h3>
            {summary.byRestaurant.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">No visits in this range.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {summary.byRestaurant.map((restaurant) => (
                  <li key={restaurant.restaurantId} className="flex items-baseline gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate text-stone-900">
                      {restaurant.restaurantName}
                    </span>
                    <span className="shrink-0 tabular-nums text-stone-500">
                      {restaurant.visitCount} {restaurant.visitCount === 1 ? 'visit' : 'visits'}
                    </span>
                    <span className="w-20 shrink-0 text-right font-semibold tabular-nums text-stone-900">
                      {formatUsd(restaurant.totalSpent)}
                    </span>
                    <span className="w-10 shrink-0 text-right tabular-nums text-stone-500">
                      {sharePercent(restaurant.totalSpent, summary.totalSpent)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** One labelled date input, with the server's message for it underneath. */
function DateField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-stone-500">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={`mt-1 rounded-lg border bg-white px-2.5 py-1.5 text-sm tabular-nums text-stone-900 transition focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
            : 'border-stone-300 focus:border-emerald-700 focus:ring-emerald-700/20'
        }`}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** One stat. `detail` is the quieter second line some tiles need to make sense. */
function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div className="truncate text-2xl font-semibold tabular-nums text-stone-900">{value}</div>
      {detail && <div className="truncate text-sm text-stone-500">{detail}</div>}
    </div>
  );
}

/**
 * A restaurant's share of the window. A zero total can only happen when every
 * visit cost nothing, and "NaN%" is a worse answer to that than "0%".
 */
function sharePercent(amount: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((amount / total) * 100)}%`;
}

/** The previous calendar month, first day to last, as the user's browser counts months. */
function lastMonth(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // Day 0 of the current month is the last day of the previous one.
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: localIso(first), to: localIso(last) };
}

/** A calendar date shifted by whole days, staying in the local calendar. */
function shiftDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return localIso(new Date(year, month - 1, day + days));
}
