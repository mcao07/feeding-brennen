import { NotFoundError, ValidationError } from './errors';
import type { RestaurantInput, VisitInput } from './types';

/** Largest value a Postgres `integer` (the SERIAL id column) can hold. */
const MAX_POSTGRES_INTEGER = 2147483647;

/** Largest value the `NUMERIC(10, 2)` amountSpent column can hold. */
const MAX_AMOUNT_SPENT = 99999999.99;

/**
 * The `:id` segment of a restaurant URL, or a 404. Anything that is not a
 * positive integer (`abc`, `-1`, `1.5`, `0`, `01`) is a 404 rather than a
 * 400: the contract in CHALLENGE.md says there is no such restaurant, and
 * that is the answer we give.
 */
export function parseRestaurantId(raw: string): number {
  const id = parsePositiveInteger(raw);
  if (id === null) throw new NotFoundError('Restaurant not found');
  return id;
}

/** The `:visitId` segment of a visit URL, or a 404. Same rules as above. */
export function parseVisitId(raw: string): number {
  const id = parsePositiveInteger(raw);
  if (id === null) throw new NotFoundError('Visit not found');
  return id;
}

/**
 * A positive integer Postgres can hold as `integer`, or null.
 *
 * Checking the shape here keeps malformed ids out of Postgres, which would
 * otherwise reject them with a 500. The upper bound matters too: an id past
 * the integer limit overflows inside Postgres and also surfaces as a 500.
 * Leading zeros are rejected so each record has exactly one URL.
 */
function parsePositiveInteger(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw) || Number(raw) > MAX_POSTGRES_INTEGER) return null;
  return Number(raw);
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

/**
 * An optional text field, trimmed. Absent, null, and whitespace-only all mean
 * "not given" and become null, so a stored value is never blank padding - the
 * same rule `name` follows, minus the requirement to be there.
 */
function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string`, field);
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Check a visit body and return only the fields we accept, typed.
 *
 * `date` must be a real calendar day written YYYY-MM-DD; it is not compared to
 * "today" because the server's today and the user's can differ by a day.
 * `amountSpent` is required and capped at what the column can store, so an
 * oversized number is a 400 here rather than a 500 inside Postgres.
 */
export function validateVisitBody(body: unknown): VisitInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('body must be a JSON object');
  }
  const fields = body as Record<string, unknown>;

  const date = fields.date;
  if (typeof date !== 'string' || !isCalendarDate(date)) {
    throw new ValidationError('date is required and must be a real date in YYYY-MM-DD form', 'date');
  }

  const amountSpent = fields.amountSpent;
  if (
    typeof amountSpent !== 'number' ||
    !Number.isFinite(amountSpent) ||
    amountSpent < 0 ||
    amountSpent > MAX_AMOUNT_SPENT
  ) {
    throw new ValidationError(
      `amountSpent is required and must be a number between 0 and ${MAX_AMOUNT_SPENT}`,
      'amountSpent'
    );
  }

  const notes = optionalString(fields.notes, 'notes');

  return { date, amountSpent, notes };
}

/**
 * The `from` and `to` query parameters of a spending window, or a 400.
 *
 * Both are required. Neither is compared to "today" because the server's today
 * and the user's can differ by a day; the browser supplies the defaults, so it
 * is the side that knows which day the user is on. Comparing the two strings
 * directly is safe: YYYY-MM-DD sorts the same way the calendar does. The
 * offending parameter is named so the UI can put the message under that input.
 */
export function validateDateRange(
  from: string | null,
  to: string | null
): { from: string; to: string } {
  if (typeof from !== 'string' || !isCalendarDate(from)) {
    throw new ValidationError('from must be a real date in YYYY-MM-DD form', 'from');
  }
  if (typeof to !== 'string' || !isCalendarDate(to)) {
    throw new ValidationError('to must be a real date in YYYY-MM-DD form', 'to');
  }
  if (from > to) {
    throw new ValidationError('from must not be after to', 'from');
  }
  return { from, to };
}

/**
 * True for "YYYY-MM-DD" naming a day that exists. The regex catches the
 * shape; the round trip through Date catches 2026-02-30, which JavaScript
 * would otherwise silently roll into March.
 */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
