import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError, NotFoundError } from '@/lib/errors';
import { parseId } from '@/lib/validation';

type Params = { params: { id: string; visitId: string } };

/**
 * DELETE /api/restaurants/:id/visits/:visitId
 * Remove one visit. The WHERE clause carries both ids, so a missing visit, a
 * missing restaurant, and a visit that belongs to a different restaurant all
 * come back as zero rows and answer the same 404. 204 with no body on success.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const restaurantId = parseId(params.id, 'Restaurant not found');
    const visitId = parseId(params.visitId, 'Visit not found');
    const { rows } = await pool.query(
      'DELETE FROM visits WHERE id = $1 AND "restaurantId" = $2 RETURNING id',
      [visitId, restaurantId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Visit not found');
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
