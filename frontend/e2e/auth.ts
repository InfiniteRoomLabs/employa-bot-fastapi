// Shared smoke-suite auth. The login throttle (5/min per account, 10/min per
// IP -- backend Settings.LOGIN_THROTTLE_*) means the suite must log in ONCE
// per run, in global-setup, not once per worker: playwright spawns a worker
// process per core locally, and 10+ parallel logins trip the IP window.

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const API_ROOT = process.env.VITE_API_URL ?? "http://localhost:8000"

export function envVal(key: string, fallback?: string): string {
  const fromProcess = process.env[key]
  if (fromProcess) {
    return fromProcess
  }
  // The repo-root .env is gitignored and NOT present in the CI Playwright
  // container, so the read must not throw before the fallback is honored:
  // a provided fallback has to survive an absent file, not just an absent key.
  try {
    const specDir = dirname(fileURLToPath(import.meta.url))
    const env = readFileSync(resolve(specDir, "../../.env"), "utf-8")
    const line = env.split("\n").find((l) => l.startsWith(`${key}=`))
    if (line) {
      return line.slice(key.length + 1).trim()
    }
  } catch {
    // no .env on disk (CI container) -- fall through to the fallback
  }
  if (fallback !== undefined) {
    return fallback
  }
  throw new Error(`${key} not set, not in process.env, and no fallback given`)
}

export async function fetchAccessToken(): Promise<string> {
  // The DEMO user (seeded with SEED_DEMO_DATA=true, the compose default):
  // since sprint-02 the jobs surface is DB-backed and tenant-filtered, and
  // the demo tenant is the one that owns the seeded postings the smoke
  // fixtures (JOB_ID_STRIPE etc.) point at. Defaults mirror Settings.
  const res = await fetch(`${API_ROOT}/api/v1/login/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username: envVal("SEED_DEMO_EMAIL", "wes.gilleland@gmail.com"),
      password: envVal("SEED_DEMO_PASSWORD", "employa-demo-1"),
    }).toString(),
  })
  if (!res.ok) {
    throw new Error(`smoke-suite login failed: ${res.status}`)
  }
  const body = (await res.json()) as { access_token: string }
  return body.access_token
}
