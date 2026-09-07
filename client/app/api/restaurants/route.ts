import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError } from '@/lib/errors';
import { RESTAURANT_WITH_TOTALS, toRestaurant } from '@/lib/types';
import { readJsonBody, validateRestaurantBody } from '@/lib/validation';

/**
 * GET /api/restaurants
 * Returns all restaurants.
 */
export async function GET() {
  try {
    const { rows } = await pool.query(
      `${RESTAURANT_WITH_TOTALS} GROUP BY r.id ORDER BY r.created_at DESC, r.id DESC`
    );
    // Map every row - raw rows don't match the contract (NUMERIC comes back
    // as a string, timestamps as Date objects). See lib/types.ts.
    return NextResponse.json(rows.map(toRestaurant));
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/restaurants
 * Create a restaurant. Returns 201 with the created record, 400 on a bad body.
 */
export async function POST(req: Request) {
  try {
    const input = validateRestaurantBody(await readJsonBody(req));
    const inserted = await pool.query(
      `INSERT INTO restaurants (name, cuisine, address, rating)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.name, input.cuisine, input.address, input.rating]
    );

    // A second trip so there is one query shape for "a restaurant with its
    // totals" instead of a RETURNING clause that has to fake the join. Writes
    // are not the hot path here.
    const { rows } = await pool.query(
      `${RESTAURANT_WITH_TOTALS} WHERE r.id = $1 GROUP BY r.id`,
      [inserted.rows[0].id]
    );

    return NextResponse.json(toRestaurant(rows[0]), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
