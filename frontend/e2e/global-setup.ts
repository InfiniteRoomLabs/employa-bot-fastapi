// One login for the whole run; workers read the token from the environment
// (globalSetup runs in the runner process, whose env propagates to workers).

import { fetchAccessToken } from "./auth"

export default async function globalSetup(): Promise<void> {
  process.env.SMOKE_ACCESS_TOKEN = await fetchAccessToken()
}
