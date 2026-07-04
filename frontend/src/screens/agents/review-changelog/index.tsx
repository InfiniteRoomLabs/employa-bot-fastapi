/**
 * Review Changelog (AGT-030). Where autonomous-agent changes land for the user
 * to accept / edit / reject before they take effect. Lives in the Intelligence
 * sidebar section, below Agents. The full review queue is exercised on the
 * existing agent review-queue screen; this is the changelog surface the
 * 2026-06-02 round named.
 */

import { ClipboardCheckIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { EmptyState } from "@/components/atoms/empty-state"
import { ResourceError } from "@/components/atoms/resource-error"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Button } from "@/components/ui/button-eb"
import { Skeleton } from "@/components/ui/skeleton"
import { useReviewQueue } from "@/hooks"
import { pathFor } from "@/routes"

export default function ReviewChangelogScreen() {
  const { data, isLoading, error, refetch } = useReviewQueue()
  const rows = data ?? []

  return (
    <AppFrame
      active="review-changelog"
      title="Review Changelog"
      subtitle={`${rows.length} pending`}
    >
      <PageHead
        eyebrow="Intelligence"
        title="Review Changelog"
        lede="Every autonomous-agent change lands here for you to accept, edit, or reject before it touches your record. Nothing an agent does is applied without your approval."
        actions={
          <Link to={pathFor("agent-review-queue")}>
            <Button variant="secondary">Open review queue</Button>
          </Link>
        }
      />

      {isLoading ? <Skeleton className="h-72" /> : null}
      {error ? (
        <ResourceError
          label="review changelog"
          error={error}
          onRetry={refetch}
        />
      ) : null}
      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheckIcon}
          headline="Nothing waiting on you"
          body="When an agent proposes a change (a researched contact, a drafted follow-up), it appears here for review first."
        />
      ) : null}

      {!isLoading && !error && rows.length > 0 ? (
        <div className="flex flex-col gap-2">
          {rows.map((item) => (
            <Link
              key={item.ref}
              to={pathFor("agent-review-queue")}
              className="rounded-lg border border-border p-3 text-[13px] hover:bg-[var(--bg-subtle)]"
            >
              {item.message}
            </Link>
          ))}
        </div>
      ) : null}
    </AppFrame>
  )
}
