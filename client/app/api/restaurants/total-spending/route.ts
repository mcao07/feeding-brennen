import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError } from '@/lib/errors';
import { RESTAURANT_SPEND_SELECT, toRestaurantSpend } from '@/lib/types';

/**
 * GET /api/restaurants/total-spending
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
