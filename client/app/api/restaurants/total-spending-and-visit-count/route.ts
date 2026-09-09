import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError } from '@/lib/errors';
import { toRestaurantSpend } from '@/lib/types';

// A GET with nothing to read from the request looks static to Next, which
// would build it once and serve that snapshot forever under `next start`.
// The answer changes with every visit, so it must run on every request.
export const dynamic = 'force-dynamic';

/**
 * The one query behind this endpoint. LEFT JOIN keeps a restaurant nobody has
 * visited yet; COALESCE turns its null SUM into 0. Lives here rather than in
 * lib/types.ts because this route is its only caller.
 */
const RESTAURANT_SPEND_SELECT = `
  SELECT r.id AS "restaurantId",
         COUNT(v.id)::int AS "visitCount",
         COALESCE(SUM(v."amountSpent"), 0) AS "totalSpent"
  FROM restaurants r
  LEFT JOIN visits v ON v."restaurantId" = r.id
`;

/**
 * GET /api/restaurants/total-spending-and-visit-count
 * Visit count and total spent for every restaurant, one row each, including
 * restaurants with no visits. A separate resource rather than two extra keys
 * on the restaurant shape, so the Part A contract stays exactly as written.
 * Next matches this fixed segment before the dynamic [id] route.
 */
export async function GET() {
  try {
    const { rows } = await pool.query(`${RESTAURANT_SPEND_SELECT} GROUP BY r.id ORDER BY r.id`);
    return NextResponse.json(rows.map(toRestaurantSpend));
  } catch (err) {
    return handleError(err);
  }
}
