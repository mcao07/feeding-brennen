import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError, NotFoundError } from '@/lib/errors';
import { parseRestaurantId, readJsonBody, validateRestaurantBody } from '@/lib/validation';
import { RESTAURANT_WITH_TOTALS, toRestaurant } from '@/lib/types';

type Params = { params: { id: string } };

/**
 * GET /api/restaurants/:id
 * Returns a single restaurant, or 404 if it doesn't exist.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const id = parseRestaurantId(params.id);
    const { rows } = await pool.query(
      `${RESTAURANT_WITH_TOTALS} WHERE r.id = $1 GROUP BY r.id`,
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Restaurant not found');
    }

    return NextResponse.json(toRestaurant(rows[0]));
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PUT /api/restaurants/:id
 * Replace every client-settable field on a restaurant. Returns 200 with the
 * updated record, 404 if no row matched, 400 on a bad body.
 */
export async function PUT(req: Request, { params }: Params) {
  try {
    const id = parseRestaurantId(params.id);
    const input = validateRestaurantBody(await readJsonBody(req));
    const updated = await pool.query(
      `UPDATE restaurants
       SET name = $1, cuisine = $2, address = $3, rating = $4
       WHERE id = $5
       RETURNING id`,
      [input.name, input.cuisine, input.address, input.rating, id]
    );

    if (updated.rows.length === 0) {
      throw new NotFoundError('Restaurant not found');
    }

    // Re-read through the same query GET uses, so both answers carry the
    // totals in one shape. Writes are not the hot path here.
    const { rows } = await pool.query(
      `${RESTAURANT_WITH_TOTALS} WHERE r.id = $1 GROUP BY r.id`,
      [id]
    );

    return NextResponse.json(toRestaurant(rows[0]));
  } catch (err) {
    return handleError(err);
  }
}

/**
 * DELETE /api/restaurants/:id
 * Delete a restaurant and, via ON DELETE CASCADE in the migration, its visits.
 * Returns 204 with no body, or 404 if no row matched.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const id = parseRestaurantId(params.id);
    const { rows } = await pool.query(
      'DELETE FROM restaurants WHERE id = $1 RETURNING id',
      [id]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Restaurant not found');
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
