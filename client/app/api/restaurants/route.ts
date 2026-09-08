import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError } from '@/lib/errors';
import { RESTAURANT_COLUMNS, toRestaurant } from '@/lib/types';
import { readJsonBody, validateRestaurantBody } from '@/lib/validation';

/**
 * GET /api/restaurants
 * Returns all restaurants.
 */
export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT ${RESTAURANT_COLUMNS} FROM restaurants ORDER BY created_at DESC, id DESC`
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
    const { rows } = await pool.query(
      `INSERT INTO restaurants (name, cuisine, address, rating)
       VALUES ($1, $2, $3, $4)
       RETURNING ${RESTAURANT_COLUMNS}`,
      [input.name, input.cuisine, input.address, input.rating]
    );

    return NextResponse.json(toRestaurant(rows[0]), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
