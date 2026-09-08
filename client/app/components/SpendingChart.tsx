'use client';

import { useState } from 'react';
import { formatShortDate, formatUsd } from '@/lib/format';
import type { SpendingByDay } from '@/lib/types';

/** The drawing box. The SVG scales to its container through the viewBox, so
 *  every number below is in these units and nothing has to be re-measured. */
const VIEW_WIDTH = 720;
const PLOT_HEIGHT = 200;
const MARGIN = { top: 8, right: 8, bottom: 24, left: 48 };
const VIEW_HEIGHT = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;

/** Widest a bar may be. Past this a bar stops reading as a mark and starts reading as a block. */
const MAX_BAR_WIDTH = 24;
/** Surface gap between neighbouring bars, so two full bands never touch. */
const BAR_GAP = 2;
/** Rounded data-end. Only the top corners: the baseline end must stay square or the bar looks shorter than it is. */
const BAR_RADIUS = 4;
/** Enough labels to orient the reader, few enough that they never collide. */
const MAX_X_LABELS = 8;

const EMERALD_600 = '#059669';
const EMERALD_700 = '#047857';
const STONE_200 = '#e7e5e4';
const STONE_300 = '#d6d3d1';
const STONE_500 = '#78716c';

/** How the window is chopped up. One bar per day stops reading past a few months. */
type BucketMode = 'day' | 'week' | 'month';

/** One bar: the period it covers, what it cost, and how many visits made it up. */
interface Bucket {
  /** The first calendar day of the period, "YYYY-MM-DD". */
  key: string;
  label: string;
  visitCount: number;
  totalSpent: number;
}

/**
 * Spend per period across the window, as bars.
 *
 * Inline SVG rather than a charting library: one static bar chart is less code
 * than the adapter around a library would be, and it inherits the page's type
 * scale and stone palette instead of fighting a theme.
 *
 * The series is spending, and only spending, so there is no legend - a caption
 * names the one thing on screen. Every bucket in the window is drawn, including
 * the empty ones, because a gap-free axis is the only honest picture of "what
 * did I spend in March": dropping quiet weeks would make the busy ones look
 * evenly spaced.
 */
export default function SpendingChart({
  byDay,
  from,
  to,
}: {
  byDay: SpendingByDay[];
  from: string;
  to: string;
}) {
  // Hover and keyboard focus are the same state: whichever band the reader is
  // pointing at or tabbed into is the one the tooltip describes.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const mode = bucketModeFor(from, to);
  const buckets = buildBuckets(from, to, byDay, mode);
  const maxSpent = Math.max(0, ...buckets.map((bucket) => bucket.totalSpent));
  const isEmpty = maxSpent === 0;

  // An all-zero window still gets a real axis rather than a blank box, so the
  // reader can see the scale the answer "nothing" is measured against.
  const step = isEmpty ? 5 : niceStep(maxSpent);
  const yMax = isEmpty ? 10 : Math.ceil(maxSpent / step) * step;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);

  const plotWidth = VIEW_WIDTH - MARGIN.left - MARGIN.right;
  const bandWidth = plotWidth / buckets.length;
  const barWidth = Math.max(1, Math.min(MAX_BAR_WIDTH, bandWidth - BAR_GAP));
  const baseline = MARGIN.top + PLOT_HEIGHT;
  const labelEvery = Math.ceil(buckets.length / MAX_X_LABELS);

  const bandCenter = (index: number) => MARGIN.left + index * bandWidth + bandWidth / 2;
  const yOf = (amount: number) => baseline - (amount / yMax) * PLOT_HEIGHT;

  const active = activeIndex === null ? null : { index: activeIndex, bucket: buckets[activeIndex] };

  return (
    <div>
      <p className="text-sm text-stone-500">{CAPTIONS[mode]}</p>

      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          width="100%"
          role="presentation"
          className="block"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={VIEW_WIDTH - MARGIN.right}
                y1={yOf(tick)}
                y2={yOf(tick)}
                stroke={tick === 0 ? STONE_300 : STONE_200}
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8}
                y={yOf(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fill={STONE_500}
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {buckets.map((bucket, index) => {
            if (bucket.totalSpent === 0) return null;
            const top = yOf(bucket.totalSpent);
            return (
              <path
                key={bucket.key}
                d={barPath(bandCenter(index) - barWidth / 2, top, barWidth, baseline)}
                fill={index === activeIndex ? EMERALD_700 : EMERALD_600}
              />
            );
          })}

          {buckets.map((bucket, index) =>
            index % labelEvery === 0 ? (
              <text
                key={bucket.key}
                x={bandCenter(index)}
                y={baseline + 16}
                textAnchor="middle"
                fontSize={11}
                fill={STONE_500}
              >
                {bucket.label}
              </text>
            ) : null
          )}

          {isEmpty && (
            <text
              x={MARGIN.left + plotWidth / 2}
              y={MARGIN.top + PLOT_HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={13}
              fill={STONE_500}
            >
              No spending in this range
            </text>
          )}

          {/* The hit target is the whole band, not the bar: a $2 day is four
              pixels tall and would otherwise be unhoverable. Each one is
              focusable so the same reading is available from the keyboard. */}
          {buckets.map((bucket, index) => (
            <rect
              key={bucket.key}
              x={MARGIN.left + index * bandWidth}
              y={MARGIN.top}
              width={bandWidth}
              height={PLOT_HEIGHT}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={describe(bucket)}
              onPointerEnter={() => setActiveIndex(index)}
              onPointerMove={() => setActiveIndex(index)}
              onPointerLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              className="cursor-default focus:outline-none"
            />
          ))}
        </svg>

        {/* An HTML tooltip rather than SVG text: it wraps, it takes the page's
            type and shadow, and it is never clipped by the plot box. Positioned
            in percentages so it tracks the bar through the viewBox's scaling. */}
        {active && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 shadow-lg shadow-stone-900/10"
            style={{
              left: `${(bandCenter(active.index) / VIEW_WIDTH) * 100}%`,
              top: `${((yOf(active.bucket.totalSpent) - 8) / VIEW_HEIGHT) * 100}%`,
            }}
          >
            <div className="text-sm font-semibold tabular-nums text-stone-900">
              {formatUsd(active.bucket.totalSpent)} · {active.bucket.visitCount}{' '}
              {active.bucket.visitCount === 1 ? 'visit' : 'visits'}
            </div>
            <div className="text-xs text-stone-500">{active.bucket.label}</div>
          </div>
        )}
      </div>

      {/* Every value, reachable without a pointer and without hovering 90 bars. */}
      <table className="sr-only">
        <caption>{CAPTIONS[mode]}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Spent</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.key}>
              <th scope="row">{bucket.label}</th>
              <td>{formatUsd(bucket.totalSpent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The caption stands in for a legend: one series needs naming, not a colour key. */
const CAPTIONS: Record<BucketMode, string> = {
  day: 'Spent per day',
  week: 'Spent per week',
  month: 'Spent per month',
};

/** What a screen reader and the tooltip both say about one bar. */
function describe(bucket: Bucket): string {
  const noun = bucket.visitCount === 1 ? 'visit' : 'visits';
  return `${bucket.label}: ${formatUsd(bucket.totalSpent)} · ${bucket.visitCount} ${noun}`;
}

/**
 * A bar, square at the baseline and rounded at the data end.
 *
 * Rounding both ends would lift the bar off its axis and make short bars read
 * as shorter than they are; the radius also shrinks with the bar so a $1 day
 * does not become a lozenge.
 */
function barPath(x: number, top: number, width: number, baseline: number): string {
  const radius = Math.min(BAR_RADIUS, width / 2, baseline - top);
  return [
    `M ${x} ${baseline}`,
    `L ${x} ${top + radius}`,
    `Q ${x} ${top} ${x + radius} ${top}`,
    `L ${x + width - radius} ${top}`,
    `Q ${x + width} ${top} ${x + width} ${top + radius}`,
    `L ${x + width} ${baseline}`,
    'Z',
  ].join(' ');
}

/**
 * Axis money, to the dollar. Cents on a gridline are noise - the tooltip and the
 * tiles carry the exact figure - and "$1,000" fits where "$1,000.00" does not.
 */
function formatTick(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

// --- scaling and bucketing ---------------------------------------------------

/**
 * How wide a bar covers, from how wide the window is.
 *
 * The thresholds are about how many bars fit, not about the calendar: a
 * quarter is roughly 92 days of readable daily bars, and two years is roughly
 * 104 weekly ones. Past each, the bars would be thinner than the gap between
 * them.
 */
function bucketModeFor(from: string, to: string): BucketMode {
  const days = daysBetween(from, to);
  if (days <= 92) return 'day';
  if (days <= 730) return 'week';
  return 'month';
}

/**
 * The calendar day a bar covering `date` starts on.
 *
 * Weeks start Monday (the ISO week) so a bar is one work-and-weekend unit
 * rather than splitting the weekend across two bars.
 */
function bucketFor(date: string, mode: BucketMode): string {
  if (mode === 'day') return date;
  if (mode === 'month') return `${date.slice(0, 7)}-01`;
  const utc = utcOf(date);
  // getUTCDay() is 0 on Sunday, which is 6 days into an ISO week, not 0.
  const daysSinceMonday = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - daysSinceMonday);
  return isoOf(utc);
}

/**
 * The y axis top and its gridline spacing.
 *
 * Steps come from {1, 2, 5} x 10^k because those are the intervals people add
 * up in their heads; the smallest one that keeps the axis to five gridlines is
 * the one that leaves the gridlines far enough apart to read.
 */
function niceStep(max: number): number {
  const magnitudeOf = Math.floor(Math.log10(Math.max(max, 1)));
  for (let power = magnitudeOf - 2; power <= magnitudeOf + 1; power += 1) {
    for (const multiple of [1, 2, 5]) {
      const step = multiple * 10 ** power;
      if (step > 0 && Math.ceil(max / step) <= 5) return step;
    }
  }
  return max;
}

/**
 * Every bar in the window, in order, empty ones included.
 *
 * The walk goes from the window's own bounds rather than from the data, which
 * is the whole point: a month with two visits must still show its other 29
 * days, or the chart draws a busier month than the one that happened.
 */
function buildBuckets(
  from: string,
  to: string,
  byDay: SpendingByDay[],
  mode: BucketMode
): Bucket[] {
  const totals = new Map<string, { visitCount: number; totalSpent: number }>();
  for (const day of byDay) {
    const key = bucketFor(day.date, mode);
    const bucket = totals.get(key) ?? { visitCount: 0, totalSpent: 0 };
    bucket.visitCount += day.visitCount;
    bucket.totalSpent += day.totalSpent;
    totals.set(key, bucket);
  }

  const buckets: Bucket[] = [];
  const cursor = utcOf(bucketFor(from, mode));
  const end = utcOf(to);
  while (cursor.getTime() <= end.getTime()) {
    const key = isoOf(cursor);
    const total = totals.get(key) ?? { visitCount: 0, totalSpent: 0 };
    buckets.push({
      key,
      label: labelFor(key, mode),
      visitCount: total.visitCount,
      // Summing floats, so the same cent-rounding the API applies belongs here.
      totalSpent: Math.round(total.totalSpent * 100) / 100,
    });
    if (mode === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + (mode === 'week' ? 7 : 1));
  }
  return buckets;
}

/** What a bar is called. A month bar carries its year because twelve of them span one. */
function labelFor(key: string, mode: BucketMode): string {
  if (mode !== 'month') return formatShortDate(key);
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
    new Date(year, month - 1, 1)
  );
}

/** Whole days from one calendar date to another, both ends counted. */
function daysBetween(from: string, to: string): number {
  return (utcOf(to).getTime() - utcOf(from).getTime()) / 86_400_000 + 1;
}

/**
 * "YYYY-MM-DD" as a UTC midnight Date. UTC, not local, because the walk adds
 * days: a local-midnight walk across a daylight-saving boundary lands on
 * 23:00 the day before and repeats a bar.
 */
function utcOf(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** The twin of `utcOf`: a UTC Date back to "YYYY-MM-DD". */
function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}
