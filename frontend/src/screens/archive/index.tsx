/**
 * Archive screen -- shared between /wins and /passed-on.
 *
 * Picker ids: `wins`, `passed-on`
 * Route paths: `/wins`, `/passed-on`
 *
 * Story: ORI-009
 * - /wins   -> kind 'won'  -> lists won applications (company, role, won date)
 * - /passed-on -> kind 'passed' -> lists rejected/withdrawn apps (company, role, reason chip)
 *
 * Three-branch body pattern (same as every other list screen):
 *   isLoading -> Skeleton
 *   error     -> ResourceError + refetch
 *   0 rows    -> EmptyState
 *   else      -> table rows
 */

import { ArchiveIcon, TrophyIcon } from "lucide-react"
import { useLocation } from "react-router-dom"
import { CoLogo } from "@/components/atoms/co-logo"
import { EmptyState } from "@/components/atoms/empty-state"
import { ResourceError } from "@/components/atoms/resource-error"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Button } from "@/components/ui/button-eb"
import { Chip } from "@/components/ui/chip"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { ApplicationView } from "@/data/types"
import { useApplicationLifecycle, useArchive } from "@/hooks"

// ---------------------------------------------------------------------------
// ArchiveRow -- one row in the wins or passed-on table
// ---------------------------------------------------------------------------

interface ArchiveRowProps {
  app: ApplicationView
  kind: "won" | "passed"
  /** D19: reactivate a closed application back into the pipeline (passed-on only). */
  onReactivate?: () => void
}

function ArchiveRow({ app, kind, onReactivate }: ArchiveRowProps) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <CoLogo name={app.company} size="default" />
          <div>
            <div className="font-medium">{app.company}</div>
            <div className="text-[12px] text-[var(--fg-muted)]">{app.role}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-[13px] text-[var(--fg-muted)]">
        {app.location}
      </td>
      {kind === "won" ? (
        <td className="px-3 py-3">
          <span className="font-mono text-[12px] text-[var(--fg-muted)]">
            {app.outcomeAt ?? "--"}
          </span>
        </td>
      ) : (
        <>
          <td className="px-3 py-3">
            {app.outcomeReason ? (
              <Chip
                pressed={false}
                variant="default"
                className="pointer-events-none text-[11px]"
              >
                {app.outcomeReason}
              </Chip>
            ) : (
              <span className="text-[12px] text-[var(--fg-subtle)]">--</span>
            )}
          </td>
          <td className="px-3 py-3 text-right">
            <Button variant="secondary" size="sm" onClick={onReactivate}>
              Reactivate
            </Button>
          </td>
        </>
      )}
    </tr>
  )
}

// ---------------------------------------------------------------------------
// ArchiveScreen
// ---------------------------------------------------------------------------

export default function ArchiveScreen() {
  const location = useLocation()
  const kind: "won" | "passed" =
    location.pathname === "/wins" ? "won" : "passed"
  const isWins = kind === "won"

  const { data, isLoading, error, refetch } = useArchive(kind)
  const lifecycle = useApplicationLifecycle()

  const count = data?.length ?? 0

  // D19: reactivate a closed application back into the active pipeline.
  async function handleReactivate(app: ApplicationView) {
    try {
      await lifecycle.reactivate(app.id)
      toast.success({
        title: "Reactivated",
        sub: `${app.company} is back in your pipeline.`,
      })
      refetch()
    } catch {
      toast.error({ title: "Could not reactivate", sub: "Please try again." })
    }
  }

  const title = isWins ? "Wins" : "Passed on"
  const frameActive = isWins ? "wins" : "passed-on"
  const frameTitle = isWins
    ? `Wins -- ${count} accepted offer${count !== 1 ? "s" : ""}`
    : `Passed on -- ${count} application${count !== 1 ? "s" : ""}`
  const subtitle = isWins
    ? `${count} accepted offer${count !== 1 ? "s" : ""}`
    : `${count} passed${count !== 1 ? "" : ""}`
  const lede = isWins
    ? "Every offer you accepted. A record of your wins and the resumes that got you there."
    : "Applications you declined, withdrew, or were rejected from. Reason chips help you spot patterns over time."

  return (
    <AppFrame active={frameActive} title={frameTitle} subtitle={subtitle}>
      <PageHead eyebrow="Archive" title={title} lede={lede} />

      {isLoading && !data ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <ResourceError
          label={isWins ? "wins" : "passed-on applications"}
          error={error}
          onRetry={refetch}
        />
      ) : count === 0 ? (
        <EmptyState
          icon={isWins ? TrophyIcon : ArchiveIcon}
          headline={
            isWins
              ? "No wins yet -- they will show here when you mark an application won"
              : "Nothing here yet -- passed-on applications will appear as you work through your pipeline"
          }
          body={
            isWins
              ? "When you accept an offer and mark it won, it moves here permanently."
              : "Rejections and withdrawals land here so you can spot patterns and improve."
          }
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="tbl w-full">
            <thead>
              <tr>
                <th>Company - Role</th>
                <th>Location</th>
                {isWins ? (
                  <th>Won date</th>
                ) : (
                  <>
                    <th>Reason</th>
                    <th className="text-right">Action</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data!.map((app) => (
                <ArchiveRow
                  key={app.id}
                  app={app}
                  kind={kind}
                  onReactivate={() => handleReactivate(app)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppFrame>
  )
}
