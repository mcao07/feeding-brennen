import { NextResponse } from 'next/server';

/**
 * Errors the route handlers throw on purpose. `handleError()` turns each into
 * the matching HTTP status; anything else is a bug and becomes a 500.
 */
export class ValidationError extends Error {
  readonly status = 400;
}

export class NotFoundError extends Error {
  readonly status = 404;
}

/**
 * Central error -> HTTP response mapper for the API route handlers. Call it
 * from a route's `catch` block so error handling lives in one place:
 *
 *   try {
 *     ...
 *   } catch (err) {
 *     return handleError(err);
 *   }
 *
 * Known errors carry their own status and a message safe to show the caller.
 * Everything else is logged server-side only and answered with a generic 500,
 * so stack traces and raw database errors never reach the response.
 */
export function handleError(err: unknown): NextResponse {
  if (err instanceof ValidationError || err instanceof NotFoundError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  console.error('Unhandled API error:', err);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}
