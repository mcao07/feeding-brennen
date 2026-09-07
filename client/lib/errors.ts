import { NextResponse } from 'next/server';

/**
 * Base for the errors the route handlers throw on purpose. Each one carries
 * its own status, so `handleError()` needs no lookup table mapping error
 * classes to codes - adding an error type never touches the handler.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The body field the message is about, when there is one. The UI uses it
     *  to place the message next to the right input. */
    readonly field?: string
  ) {
    super(message);
  }
}

/** A body the client got wrong. 400, plus the offending field when known. */
export class ValidationError extends HttpError {
  constructor(message: string, field?: string) {
    super(message, 400, field);
  }
}

/** No such record. 404, and never about a single field. */
export class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(message, 404);
  }
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
 * An `HttpError` was thrown deliberately: it already knows its status and its
 * message is safe to show the caller. Anything else is a bug, so it is logged
 * server-side only and answered with a generic 500 - stack traces and raw
 * database errors never reach the response.
 */
export function handleError(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    const body = err.field ? { error: err.message, field: err.field } : { error: err.message };
    return NextResponse.json(body, { status: err.status });
  }

  console.error('Unhandled API error:', err);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}
