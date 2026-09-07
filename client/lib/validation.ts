import { NotFoundError, ValidationError } from './errors';

/** Largest value a Postgres `integer` (the SERIAL id column) can hold. */
const MAX_POSTGRES_INTEGER = 2147483647;

/**
 * Parse a `:id` path segment into a positive integer.
 *
 * Anything else (`abc`, `-1`, `1.5`, `0`, `01`) is a 404, not a 400: the
 * contract in CHALLENGE.md says there is no such restaurant, and that is the
 * answer we give. Checking here keeps malformed ids out of Postgres, which
 * would otherwise reject them with a 500. The upper bound matters too: an id
 * past the integer limit overflows inside Postgres and also surfaces as a 500.
 * Leading zeros are rejected so each restaurant has exactly one URL.
 */
export function parseId(raw: string): number {
  if (!/^[1-9]\d*$/.test(raw) || Number(raw) > MAX_POSTGRES_INTEGER) {
    throw new NotFoundError('Restaurant not found');
  }
  return Number(raw);
}

/** The fields a client may set on a restaurant, already checked and cleaned. */
export interface RestaurantInput {
  name: string;
  cuisine: string | null;
  address: string | null;
  rating: number | null;
}

/**
 * Read the request body as JSON. A body that is not JSON at all is the
 * client's mistake, so it is a 400 rather than the 500 `req.json()` would
 * otherwise surface.
 */
export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError('body must be valid JSON');
  }
}

/**
 * Check a restaurant body and return only the fields we accept, typed.
 *
 * Shared by POST and PUT so the two cannot drift. The first failing field
 * wins; the caller never sees the raw body again. Unknown keys are dropped,
 * not rejected.
 */
export function validateRestaurantBody(body: unknown): RestaurantInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('body must be a JSON object');
  }
  const fields = body as Record<string, unknown>;

  const name = fields.name;
  if (typeof name !== 'string' || name.trim() === '') {
    throw new ValidationError('name is required and must be a non-empty string', 'name');
  }

  const cuisine = optionalString(fields.cuisine, 'cuisine');
  const address = optionalString(fields.address, 'address');

  // Absent or null means "not rated"; anything else must be a number 0-5.
  let rating: number | null = null;
  if (fields.rating !== undefined && fields.rating !== null) {
    const value = fields.rating;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 5) {
      throw new ValidationError('rating must be a number between 0 and 5', 'rating');
    }
    rating = value;
  }

  return { name: name.trim(), cuisine, address, rating };
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string`, field);
  }
  return value;
}
