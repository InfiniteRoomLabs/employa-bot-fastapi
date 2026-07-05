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
  | "provider_unavailable"
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

  static providerUnavailable(path: string, message?: string): MockApiError {
    return new MockApiError("provider_unavailable", path, message)
  }

  static unknown(path: string, cause?: unknown): MockApiError {
    return new MockApiError("unknown", path, undefined, cause)
  }
}

/** Wire error body: `{kind, path, message}` (mvp-api.yaml `Error` schema). */
interface WireErrorBody {
  kind?: string
  path?: string
  message?: string
}

const WIRE_KINDS: readonly MockApiErrorKind[] = [
  "not_found",
  "unauthorized",
  "validation_error",
  "conflict",
  "cap_reached",
  "undo_window_expired",
  "invalid_transition",
  "rate_limited",
  "provider_unavailable",
]

/**
 * Translate an HTTP response into a `MockApiError` kind (see CONTRACT-NOTES sec 8).
 * Status wins where unambiguous; 409/422 are ambiguous by status so the JSON
 * `kind` from the body is preferred. `network`/`unknown` are client-only kinds
 * synthesized here (never sent on the wire).
 */
export function httpErrorToMockApiError(
  status: number,
  path: string,
  body: WireErrorBody | null,
): MockApiError {
  const bodyKind =
    body &&
    typeof body.kind === "string" &&
    (WIRE_KINDS as readonly string[]).includes(body.kind)
      ? (body.kind as MockApiErrorKind)
      : null
  const message = body?.message ?? undefined
  if (status === 401 || status === 403) {
    return new MockApiError("unauthorized", path, message)
  }
  if (status === 404) {
    return new MockApiError("not_found", path, message)
  }
  if (status === 402) {
    return new MockApiError("cap_reached", path, message)
  }
  if (status === 429) {
    return new MockApiError("rate_limited", path, message)
  }
  if (status === 503) {
    return new MockApiError("provider_unavailable", path, message)
  }
  // 409 (conflict | undo_window_expired) and 422 (validation_error |
  // invalid_transition) are ambiguous by status -- read the body kind.
  if (status === 409) {
    return new MockApiError(bodyKind ?? "conflict", path, message)
  }
  if (status === 422) {
    return new MockApiError(bodyKind ?? "validation_error", path, message)
  }
  if (status >= 500) {
    // Unmapped 5xx with no typed kind -> transport-class failure.
    return new MockApiError(bodyKind ?? "network", path, message)
  }
  // Any other status: prefer a body kind, else unknown.
  return new MockApiError(bodyKind ?? "unknown", path, message)
}
