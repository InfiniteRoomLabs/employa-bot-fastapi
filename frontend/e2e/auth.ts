// Shared smoke-suite auth. The login throttle (5/min per account, 10/min per
// IP -- backend Settings.LOGIN_THROTTLE_*) means the suite must log in ONCE
// per run, in global-setup, not once per worker: playwright spawns a worker
// process per core locally, and 10+ parallel logins trip the IP window.

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const API_ROOT = process.env.VITE_API_URL ?? "http://localhost:8000"

function envVal(key: string): string {
  const fromProcess = process.env[key]
  if (fromProcess) {
    return fromProcess
  }
  const specDir = dirname(fileURLToPath(import.meta.url))
  const env = readFileSync(resolve(specDir, "../../.env"), "utf-8")
  const line = env.split("\n").find((l) => l.startsWith(`${key}=`))
  if (!line) {
    throw new Error(`${key} not set and not found in ../.env`)
  }
  return line.slice(key.length + 1).trim()
}

export async function fetchAccessToken(): Promise<string> {
  const res = await fetch(`${API_ROOT}/api/v1/login/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username: envVal("FIRST_SUPERUSER"),
      password: envVal("FIRST_SUPERUSER_PASSWORD"),
    }).toString(),
  })
  if (!res.ok) {
    throw new Error(`smoke-suite login failed: ${res.status}`)
  }
  const body = (await res.json()) as { access_token: string }
  return body.access_token
}
