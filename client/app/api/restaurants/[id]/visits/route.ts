import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError, NotFoundError } from '@/lib/errors';
import { VISIT_COLUMNS, toVisit } from '@/lib/types';
import { parseId, readJsonBody, validateVisitBody } from '@/lib/validation';

type Params = { params: { id: string } };

/**
 * GET /api/restaurants/:id/visits
 * Every visit to one restaurant, most recent date first. 404 if the
 * restaurant does not exist; an empty array only ever means "no visits yet".
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const restaurantId = parseId(params.id, 'Restaurant not found');
    await assertRestaurantExists(restaurantId);
    const { rows } = await pool.query(
      `SELECT ${VISIT_COLUMNS} FROM visits
       WHERE "restaurantId" = $1
       ORDER BY date DESC, id DESC`,
      [restaurantId]
    );
    return NextResponse.json(rows.map(toVisit));
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/restaurants/:id/visits
 * Log a visit. The restaurant comes from the URL, never the body, so a
 * client cannot file a visit under a different restaurant than it named.
 * 201 with the visit, 404 if the restaurant does not exist, 400 on a bad body.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const restaurantId = parseId(params.id, 'Restaurant not found');
    await assertRestaurantExists(restaurantId);
    const input = validateVisitBody(await readJsonBody(req));
    const { rows } = await pool.query(
      `INSERT INTO visits ("restaurantId", date, "amountSpent", notes)
       VALUES ($1, $2, $3, $4)
       RETURNING ${VISIT_COLUMNS}`,
      [restaurantId, input.date, input.amountSpent, input.notes]
    );
    return NextResponse.json(toVisit(rows[0]), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Both handlers need this because neither query can tell "no such
 * restaurant" from "no visits": the SELECT returns an empty set for both, and
 * the INSERT would fail on the foreign key as a 500. One extra trip buys a
 * clear 404. Private to this file until a second caller appears.
 */
async function assertRestaurantExists(restaurantId: number): Promise<void> {
  const { rows } = await pool.query('SELECT 1 FROM restaurants WHERE id = $1', [restaurantId]);
  if (rows.length === 0) {
    throw new NotFoundError('Restaurant not found');
  }
}
