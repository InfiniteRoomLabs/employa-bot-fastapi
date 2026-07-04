/**
 * Match Explorer - rubric + gaps + strengths for resume vs job pairing.
 *
 * Picker id: `match-explorer`
 * Route path: `/resumes/match-explorer` (Phase 9)
 *
 * Stories implemented:
 *   CUR-020 - "Generate tailored revision" forks a draft + navigates into editor
 *   CUR-017 - error state via <ResourceError>
 *   CUR-024 - empty state via <EmptyState> when rubric is empty
 *   ORI-014 - toast feedback on fork action
 */

import { CheckIcon, MinusIcon, TriangleAlertIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { EmptyState } from "@/components/atoms/empty-state"
import { MatchPill } from "@/components/atoms/match-pill"
import { ResourceError } from "@/components/atoms/resource-error"
import { CostPreviewDialog } from "@/components/domain/cost-preview-dialog"
import { MatchRubricRow } from "@/components/domain/match-rubric-row"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { CostPreview } from "@/data/types"
import { useDeepMatchScore, useMatchReport, useResumeMutations } from "@/hooks"

export default function MatchExplorerScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Forward-compatible: read resumeId/jobId from search params with hardcoded fallbacks.
  // This preserves backward compatibility while allowing CUR-007 parameterization later.
  const resumeId = searchParams.get("resumeId") ?? "distributed-systems"
  const jobId = searchParams.get("jobId") ?? "stripe-staff-engineer"

  const { data, isLoading, error, refetch } = useMatchReport({
    resumeId,
    jobId,
  })
  const { forkResumeAsDraft, isMutating } = useResumeMutations()

  // D8/D8b/D9a: deep (paid) match score with cost preview + cap re-consent.
  const deepScore = useDeepMatchScore()
  const [costOpen, setCostOpen] = useState(false)
  const [costPreview, setCostPreview] = useState<CostPreview | null>(null)
  const [capReached, setCapReached] = useState(false)
  const resumeName = "Distributed-systems v4"

  const openDeepScore = async () => {
    setCapReached(false)
    setCostPreview(null)
    setCostOpen(true)
    try {
      setCostPreview(await deepScore.preview(jobId, [resumeName]))
    } catch {
      // hook captures the error; the dialog surfaces it via deepScore.error
    }
  }

  const runDeepScore = async () => {
    try {
      const result = await deepScore.run(jobId, resumeName)
      setCostOpen(false)
      toast.success({
        title: `Deep score: ${result.score}`,
        sub: `Charged $${result.costUsd.toFixed(2)} to your monthly cap.`,
      })
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "kind" in err &&
        err.kind === "cap_reached"
      ) {
        setCapReached(true)
      } else {
        toast.error({
          title: "Could not run the deep score",
          sub: "Please try again.",
        })
      }
    }
  }

  const reConsent = () => {
    setCapReached(false)
    setCostOpen(false)
    toast.default({
      title: "Re-consented",
      sub: "Paid AI will keep running this cycle.",
    })
  }

  const handleGenerateTailoredRevision = async () => {
    if (!data) {
      return
    }
    try {
      const draft = await forkResumeAsDraft(resumeId, jobId)
      toast.agent({
        title: "Draft forked",
        sub: `Seeded from ${data.gaps.length} gap suggestion${data.gaps.length !== 1 ? "s" : ""}.`,
      })
      // Navigate to editor, passing gaps as navigation state for seed suggestions
      navigate(`/resume/${draft.id}/edit`, {
        state: {
          gaps: data.gaps,
          resumeId: draft.id,
          jobId,
          from: "match-explorer",
        },
      })
    } catch {
      toast.error({ title: "Could not fork resume", sub: "Please try again." })
    }
  }

  return (
    <AppFrame
      active="resumes"
      title="Match Explorer"
      subtitle="Distributed-systems v4 vs Stripe - Staff Engineer, Payments core"
    >
      <PageHead
        eyebrow="Match Explorer"
        title="Distributed-systems v4 vs Stripe"
        lede="Score breakdown by rubric, plus the gaps and strengths the coach can lean on."
        actions={
          data ? (
            <>
              <MatchPill score={data.score} kind="deep" />
              <Button variant="secondary" onClick={openDeepScore}>
                Re-run deep score
              </Button>
            </>
          ) : null
        }
      />

      {/* Loading */}
      {isLoading && <Skeleton className="h-96" />}

      {/* CUR-017: error state */}
      {!isLoading && error && (
        <ResourceError label="match report" error={error} onRetry={refetch} />
      )}

      {/* CUR-024: empty rubric state */}
      {!isLoading && !error && data && data.rubric.length === 0 && (
        <EmptyState
          headline="No match data yet"
          body="Run a match analysis to see results here."
        />
      )}

      {/* Data loaded with content */}
      {!isLoading && !error && data && data.rubric.length > 0 && (
        <div className="grid grid-cols-[2fr_1fr] gap-4">
          <div className="card p-5">
            <h3 className="m-0 mb-3 text-[15px] font-semibold">Rubric</h3>
            <div className="flex flex-col gap-2">
              {data.rubric.map((rubricRow) => (
                <MatchRubricRow key={rubricRow.label} row={rubricRow} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="card p-5">
              <h3 className="m-0 mb-3 flex items-center gap-1.5 text-[14px] font-semibold">
                <TriangleAlertIcon className="size-3.5 text-[var(--warn-text)]" />{" "}
                Gaps
              </h3>
              <div className="flex flex-col gap-2">
                {data.gaps.map((gap, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-[13px]"
                  >
                    <Badge
                      variant={
                        gap.severity === "high"
                          ? "danger"
                          : gap.severity === "medium"
                            ? "warn"
                            : "default"
                      }
                    >
                      {gap.severity}
                    </Badge>
                    <span>{gap.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="m-0 mb-3 flex items-center gap-1.5 text-[14px] font-semibold">
                <CheckIcon className="size-3.5 text-[var(--success-text)]" />{" "}
                Strengths
              </h3>
              <div className="flex flex-col gap-2">
                {data.strengths.map((strength, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-[13px]"
                  >
                    <MinusIcon className="size-3 shrink-0 translate-y-0.5 text-[var(--fg-subtle)]" />
                    <span>{strength}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              variant="default"
              onClick={handleGenerateTailoredRevision}
              disabled={isMutating}
            >
              {isMutating ? "Forking..." : "Generate tailored revision"}
            </Button>
          </div>
        </div>
      )}

      {/* D8b/D9a: cost-preview consent + cap re-consent */}
      <CostPreviewDialog
        open={costOpen}
        onOpenChange={setCostOpen}
        preview={costPreview}
        loading={deepScore.isPreviewing}
        error={capReached ? undefined : deepScore.error}
        onRetry={openDeepScore}
        onConfirm={runDeepScore}
        busy={deepScore.isRunning}
        capReached={capReached}
        onReConsent={reConsent}
        monthSpend="$3.42"
        monthlyCap="$20.00"
      />
    </AppFrame>
  )
}
