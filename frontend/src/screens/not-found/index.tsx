/**
 * NotFound screen (ORI-008)
 *
 * Catch-all for unmatched routes. Renders inside the normal AppFrame shell
 * so the sidebar and topbar remain visible. Provides recovery links to
 * common destinations.
 *
 * Named sections (/wins, /passed-on) get an additional explanation line
 * so the user understands these are planned features, not broken links.
 */

import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { AppFrame } from "@/components/shell/app-frame"

const SECTION_NAMES: Record<string, string> = {
  "/wins": "Wins archive",
  "/passed-on": "Passed on archive",
}

export default function NotFoundScreen() {
  const { pathname } = useLocation()
  const sectionName = SECTION_NAMES[pathname]

  useEffect(() => {
    document.title = "Page not found - employa-bot"
  }, [])

  return (
    <AppFrame title="Page not found" active="dashboard">
      {/* aria-live region announces to screen readers on mount */}
      <div aria-live="assertive" className="sr-only" role="status">
        Page not found
      </div>

      <div className="flex flex-col items-center gap-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-[var(--fg-base)]">
          We could not find that page
        </h1>

        {sectionName ? (
          <p className="max-w-md text-[var(--fg-muted)]">
            <strong>{sectionName}</strong> is a planned feature that is not
            built yet. Check back after a future release.
          </p>
        ) : (
          <p className="max-w-md text-[var(--fg-muted)]">
            The URL{" "}
            <code className="rounded bg-[var(--bg-subtle)] px-1 py-0.5 text-sm font-mono">
              {pathname}
            </code>{" "}
            does not match any known route.
          </p>
        )}

        <div className="flex flex-col items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex h-9 items-center rounded-md bg-[var(--accent-base)] px-4 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
          >
            Back to dashboard
          </Link>

          <div className="flex gap-4 text-sm text-[var(--fg-muted)]">
            <Link
              to="/applications"
              className="underline underline-offset-2 hover:text-[var(--fg-base)]"
            >
              Applications
            </Link>
            <Link
              to="/coach"
              className="underline underline-offset-2 hover:text-[var(--fg-base)]"
            >
              Coach
            </Link>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}
