/**
 * The client side of the API: helpers the frontend uses to call the endpoints.
 *
 * Don't confuse this with `app/api/`, which is the other side of the same
 * boundary - the route handlers that *implement* those endpoints. This file
 * only ever talks to them over HTTP.
 *
 * The shapes these helpers return live in `lib/types.ts`, shared with the
 * handlers that produce them.
 */
import type { Restaurant, RestaurantInput } from './types';

// We read a base URL from the environment because Server Components fetch on
// the server, where relative URLs don't resolve - so we need an absolute origin.
// It's the same app on the same port, so this is normally just localhost:3000.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Fetch every restaurant from the API.
 *
 * NOTE: this is a bare fetch with no error handling. It does not check the
 * response status and it does not catch network failures - callers get whatever
 * `res.json()` produces, including on a 500.
 */
export async function getRestaurants(): Promise<Restaurant[]> {
  const res = await fetch(`${API_URL}/api/restaurants`, { cache: 'no-store' });
  return res.json();
}

/**
 * Fetch a single restaurant by id.
 */
export async function getRestaurant(id: number | string): Promise<Restaurant> {
  const res = await fetch(`${API_URL}/api/restaurants/${id}`, { cache: 'no-store' });
  return res.json();
}

/**
 * A non-2xx answer from the API. `field` is set when the server tied the
 * message to one body field, so a form can show it next to that input.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: string
  ) {
    super(message);
  }
}

/**
 * Turn a failed response into an `ApiError` and throw it. Every write helper
 * fails the same way, and a body that isn't JSON (a proxy's HTML error page,
 * an empty 204) must not mask the status the caller needs to see.
 */
async function throwApiError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new ApiError(body.error ?? `Request failed with ${res.status}`, res.status, body.field);
}

/**
 * Create a restaurant. Optional fields may be omitted; the server decides
 * what is valid and answers 400 with a message (and usually a field) if not.
 */
export async function createRestaurant(
  input: Partial<RestaurantInput> & { name: string }
): Promise<Restaurant> {
  const res = await fetch(`${API_URL}/api/restaurants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) return throwApiError(res);
  return res.json();
}

/**
 * Delete a restaurant. Resolves on 204; throws ApiError on 404 or any other
 * failure. The migration cascades, so the restaurant's visits go with it.
 */
export async function deleteRestaurant(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/restaurants/${id}`, { method: 'DELETE' });
  if (!res.ok) await throwApiError(res);
}
