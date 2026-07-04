/**
 * Mock-API error type used by `src/data/api.ts`. Hooks surface `MockApiError`
 * instances via their `error` slot — components consume the discriminated
 * `kind` field, never the raw message.
 */

/**
 * Unified v1 error model (see the mockup-modification plan's "API design
 * conventions"). Each kind maps to an HTTP status a real backend would return:
 *   not_found 404, unauthorized 401, validation_error 422, conflict 409,
 *   cap_reached 402, undo_window_expired 409, invalid_transition 422,
 *   rate_limited 429, network (transport), unknown 500.
 */
export type MockApiErrorKind =
  | "not_found"
  | "unauthorized"
  | "validation_error"
  | "conflict"
  | "cap_reached"
  | "undo_window_expired"
  | "invalid_transition"
  | "rate_limited"
  | "network"
  | "unknown"

export class MockApiError extends Error {
  readonly kind: MockApiErrorKind
  readonly path: string

  constructor(
    kind: MockApiErrorKind,
    path: string,
    message?: string,
    cause?: unknown,
  ) {
    super(
      message ?? `MockApiError(${kind}) at ${path}`,
      cause === undefined ? undefined : { cause },
    )
    this.name = "MockApiError"
    this.kind = kind
    this.path = path
  }

  static notFound(path: string): MockApiError {
    return new MockApiError("not_found", path)
  }

  static unauthorized(path: string): MockApiError {
    return new MockApiError("unauthorized", path)
  }

  static rateLimited(path: string): MockApiError {
    return new MockApiError("rate_limited", path)
  }

  static network(path: string): MockApiError {
    return new MockApiError("network", path)
  }

  static validation(path: string, message?: string): MockApiError {
    return new MockApiError("validation_error", path, message)
  }

  static conflict(path: string, message?: string): MockApiError {
    return new MockApiError("conflict", path, message)
  }

  static capReached(path: string, message?: string): MockApiError {
    return new MockApiError("cap_reached", path, message)
  }

  static undoWindowExpired(path: string, message?: string): MockApiError {
    return new MockApiError("undo_window_expired", path, message)
  }

  static invalidTransition(path: string, message?: string): MockApiError {
    return new MockApiError("invalid_transition", path, message)
  }

  static unknown(path: string, cause?: unknown): MockApiError {
    return new MockApiError("unknown", path, undefined, cause)
  }
}
