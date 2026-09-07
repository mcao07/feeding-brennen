import { NextResponse } from 'next/server';

/**
 * Errors the route handlers throw on purpose. `handleError()` turns each into
 * the matching HTTP status; anything else is a bug and becomes a 500.
 */
export class ValidationError extends Error {
  readonly status = 400;
  /** The body field the message is about, when there is one. The UI uses it
   *  to place the message next to the right input. */
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
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
  if (err instanceof ValidationError) {
    const body = err.field ? { error: err.message, field: err.field } : { error: err.message };
    return NextResponse.json(body, { status: err.status });
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  console.error('Unhandled API error:', err);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}
