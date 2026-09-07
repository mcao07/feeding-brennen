import { NotFoundError } from './errors';

/**
 * Parse a `:id` path segment into a positive integer.
 *
 * Anything else (`abc`, `-1`, `1.5`, `0`) is a 404, not a 400: the contract in
 * CHALLENGE.md says there is no such restaurant, and that is the answer we
 * give. Checking here keeps malformed ids out of Postgres, which would
 * otherwise reject them with a 500.
 */
export function parseId(raw: string): number {
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw new NotFoundError('Restaurant not found');
  }
  return Number(raw);
}
