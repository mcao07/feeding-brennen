import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError } from '@/lib/errors';
import {
  dateOnly,
  type SpendingByDay,
  type SpendingByRestaurant,
  type SpendingSummary,
} from '@/lib/types';
import { validateDateRange } from '@/lib/validation';

// A GET with nothing to read from the request looks static to Next, which
// would build it once and serve that snapshot forever under `next start`.
// The answer changes with every visit, so it must run on every request.
export const dynamic = 'force-dynamic';

/**
 * The one query behind this endpoint: every visit in the window, joined to its
 * restaurant name. All of the summary's statistics are computed from these rows
 * in the handler rather than by a query each, so the tiles, the chart, and the
 * breakdown cannot disagree. The cost is proportional to the visits in range,
 * which is the right trade for a personal tracker. Rows with a null amount -
 * only reachable by writing to the table from outside the app, since the API
 * requires one - are excluded so the sums stay honest.
 */
const SPENDING_VISITS_SELECT = `
  SELECT v.id, v."restaurantId", r.name AS "restaurantName", v.date, v."amountSpent"
  FROM visits v
  JOIN restaurants r ON r.id = v."restaurantId"
  WHERE v.date BETWEEN $1 AND $2 AND v."amountSpent" IS NOT NULL
  ORDER BY v.date, v.id
`;

/**
 * GET /api/spending?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * What was spent in one calendar window, both ends included: the total, the
 * visit count, how many restaurants that covers, the average visit, the most
 * expensive visit, the most visited restaurant, spend per day, and spend per
 * restaurant. Every one of those is derived from the same list of visit rows,
 * so no two numbers on screen can disagree.
 *
 * Both parameters are required and must be real dates in YYYY-MM-DD form; a
 * missing, malformed, or impossible one is a 400 naming the parameter, as is a
 * `from` after `to`. The server never fills in "today" itself, because its day
 * and the user's can differ.
 *
 * A window with no visits is a 200, not a 404: zeros, nulls, and empty arrays
 * are the honest answer to "what did I spend in June".
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { from, to } = validateDateRange(
      url.searchParams.get('from'),
      url.searchParams.get('to')
    );

    const { rows } = await pool.query(SPENDING_VISITS_SELECT, [from, to]);

    // One pass builds both breakdowns and both "most" answers at once. The
    // maps keep insertion order, which the query already made date-ascending,
    // so ties below resolve to the earliest visit and the earliest restaurant.
    const byDay = new Map<string, SpendingByDay>();
    const byRestaurant = new Map<number, SpendingByRestaurant>();
    let totalSpent = 0;
    let mostExpensiveVisit: SpendingSummary['mostExpensiveVisit'] = null;

    for (const row of rows) {
      const date = dateOnly(row.date);
      const restaurantId = Number(row.restaurantId);
      const restaurantName = String(row.restaurantName);
      const amountSpent = Number(row.amountSpent);

      totalSpent += amountSpent;

      const day = byDay.get(date) ?? { date, visitCount: 0, totalSpent: 0 };
      day.visitCount += 1;
      day.totalSpent += amountSpent;
      byDay.set(date, day);

      const restaurant = byRestaurant.get(restaurantId) ?? {
        restaurantId,
        restaurantName,
        visitCount: 0,
        totalSpent: 0,
      };
      restaurant.visitCount += 1;
      restaurant.totalSpent += amountSpent;
      byRestaurant.set(restaurantId, restaurant);

      if (mostExpensiveVisit === null || amountSpent > mostExpensiveVisit.amountSpent) {
        mostExpensiveVisit = { restaurantId, restaurantName, date, amountSpent };
      }
    }

    const days = [...byDay.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({ ...day, totalSpent: round(day.totalSpent) }));

    const restaurants = [...byRestaurant.values()]
      .sort((a, b) => b.totalSpent - a.totalSpent || a.restaurantName.localeCompare(b.restaurantName))
      .map((restaurant) => ({ ...restaurant, totalSpent: round(restaurant.totalSpent) }));

    // Read off the sorted list rather than tracking a running winner, so the
    // tile and the breakdown agree about which restaurant is on top.
    const mostVisited = restaurants.reduce<SpendingByRestaurant | null>(
      (best, restaurant) => (best === null || restaurant.visitCount > best.visitCount ? restaurant : best),
      null
    );

    const summary: SpendingSummary = {
      from,
      to,
      totalSpent: round(totalSpent),
      visitCount: rows.length,
      uniqueRestaurants: restaurants.length,
      averagePerVisit: rows.length === 0 ? null : round(totalSpent / rows.length),
      mostExpensiveVisit,
      mostVisitedRestaurant:
        mostVisited === null
          ? null
          : {
              restaurantId: mostVisited.restaurantId,
              restaurantName: mostVisited.restaurantName,
              visitCount: mostVisited.visitCount,
            },
      byDay: days,
      byRestaurant: restaurants,
    };

    return NextResponse.json(summary);
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Money, to the cent. Summing floats leaves noise a currency total should
 * never show - 42.5 + 88 + 31.75 can land on 162.24999999999997 - and every
 * amount here came from a NUMERIC(10, 2) column, so two decimals lose nothing.
 */
function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}
