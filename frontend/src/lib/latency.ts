/**
 * Tunable mock-API latency helper. Resolves after a random delay within the
 * configured range. Defaults are 100ms–400ms; override via the
 * `VITE_MOCK_LATENCY_MIN` / `VITE_MOCK_LATENCY_MAX` env vars (invalid values
 * are ignored and the defaults are used).
 *
 * Only consumed by `src/data/api.ts`. Tests can stub the module wholesale to
 * make api calls effectively instant.
 */

const DEFAULT_MIN_MS = 100
const DEFAULT_MAX_MS = 400

function parseMs(raw: unknown): number | null {
  if (typeof raw !== "string" || raw.length === 0) {
    return null
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    return null
  }
  return n
}

/**
 * Reads the active latency range. Re-reads env on every call so tests using
 * `vi.stubEnv` see updates without having to reset the module.
 */
export function getLatencyRange(): readonly [number, number] {
  const env = import.meta.env as Record<string, string | undefined>
  const min = parseMs(env.VITE_MOCK_LATENCY_MIN) ?? DEFAULT_MIN_MS
  const max = parseMs(env.VITE_MOCK_LATENCY_MAX) ?? DEFAULT_MAX_MS
  if (max < min) {
    return [min, min]
  }
  return [min, max]
}

/**
 * Resolves after a uniform random delay within `getLatencyRange()`. The
 * mock API awaits this once at the top of every function.
 */
export function simulateLatency(): Promise<void> {
  const [min, max] = getLatencyRange()
  const delay = min + Math.random() * (max - min)
  return new Promise((resolve) => {
    setTimeout(resolve, delay)
  })
}
