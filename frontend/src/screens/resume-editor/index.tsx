/**
 * Resume editor - parameterized by route id.
 *
 * Route paths:
 *   /resume/:id/edit   -- parameterized (resume-editor-param)
 *   /resumes/editor     -- static legacy alias (uses fixture default id)
 *
 * When navigated from match-explorer (CUR-020), the location state carries:
 *   { gaps: MatchGap[], resumeId: string, jobId: string, from: 'match-explorer' }
 *
 * The editor derives coach suggestions from gaps when present, rather than
 * from the hardcoded RESUME_SUGGESTIONS fixture.
 *
 * Stories implemented:
 *   CUR-020 - gaps seed coach suggestions rail from navigation state
 *   CUR-017 - error state via <ResourceError>
 *   ORI-014 - toast feedback on fork action
 */

import { LockIcon, SparklesIcon } from "lucide-react"
import * as React from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { ResourceError } from "@/components/atoms/resource-error"
import { ProseMirrorEditor } from "@/components/domain/prosemirror-editor"
import { AppFrame } from "@/components/shell/app-frame"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { RESUME_ID_DISTRIBUTED } from "@/data/fixtures"
import type { MatchGap, ResumeSuggestion } from "@/data/types"
import { useResumeById, useResumeMutations } from "@/hooks"

// ---------------------------------------------------------------------------
// Nav-state shape from match-explorer (CUR-020)
// ---------------------------------------------------------------------------

interface MatchEditorState {
  gaps?: MatchGap[]
  resumeId?: string
  jobId?: string
  from?: "match-explorer"
}

// ---------------------------------------------------------------------------
// Derive suggestions from match-explorer gaps
// ---------------------------------------------------------------------------

function suggestionsFromGaps(gaps: MatchGap[]): ResumeSuggestion[] {
  return gaps.map((gap) => ({
    type: "tailored" as const,
    title: gap.text,
    question: `Address this gap (severity: ${gap.severity})`,
    cta: "Apply",
  }))
}

// Hardcoded fallback suggestions when NOT coming from match-explorer
const FALLBACK_SUGGESTIONS: ResumeSuggestion[] = [
  {
    type: "tailored",
    title: 'Quantify "reduced p99 latency"',
    question: '"cut p99 from 340ms to 45ms on a 2M-events/sec pipeline"',
    cta: "Apply",
  },
  {
    type: "tailored",
    title: 'Reframe "owned" -> "led"',
    question: "Stronger verb matches the Staff IC level.",
    cta: "Apply",
  },
  {
    type: "generic",
    title: "Add a quantified cost-reduction metric",
    question: "Hiring managers grade on outcomes.",
    cta: "Open",
  },
]

// ---------------------------------------------------------------------------
// Legacy static route: no :id param -> use fixture default
// ---------------------------------------------------------------------------

const LEGACY_RESUME_ID = RESUME_ID_DISTRIBUTED

// ---------------------------------------------------------------------------
// Editable resume body: the ProseMirror surface + its Save / Discard / Cancel
// action bar and dirty tracking. Owns the saved/current baseline so the screen
// stays declarative.
//
// Save persists the editor's serialized HTML through the api mutable store
// (saveResumeBody -- the RES-022 swap-seam for PATCH /resume/:id), so edits +
// formatting survive navigation within the session (reset on full reload).
// Discard re-mounts the editor to the saved baseline.
// ---------------------------------------------------------------------------

function ResumeBodyEditor({
  resumeId,
  body,
  editable,
  onCancel,
}: {
  resumeId: string
  body: string
  editable: boolean
  onCancel: () => void
}) {
  const [saved, setSaved] = React.useState(body)
  const [current, setCurrent] = React.useState(body)
  // `mountText` is what the editor mounts with; it only changes on discard or
  // a resume switch (NOT on save), so saving keeps the live doc + its marks.
  const [mountText, setMountText] = React.useState(body)
  const [nonce, setNonce] = React.useState(0)
  const dirty = current !== saved
  const { saveResumeBody, isMutating } = useResumeMutations()

  // Baselines initialize from `body` on mount. The screen passes `key={data.id}`
  // so a resume switch remounts this component with fresh state -- no reset
  // effect (and no setState-in-effect) needed.

  const handleSave = async () => {
    try {
      // Persists the serialized HTML through the api store (RES-022 swap-seam).
      await saveResumeBody(resumeId, current)
      setSaved(current)
      toast.success({
        title: "Resume saved",
        sub: "Formatting + edits kept for this session.",
      })
    } catch {
      toast.error({ title: "Could not save", sub: "Please try again." })
    }
  }

  const handleDiscard = () => {
    setCurrent(saved)
    setMountText(saved)
    setNonce((value) => value + 1)
  }

  return (
    <>
      {editable && (
        <div className="mb-3 flex items-center justify-end gap-2">
          {dirty && (
            <span className="mr-auto text-[12px] text-[var(--fg-muted)]">
              Unsaved changes
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDiscard}
            disabled={!dirty || isMutating}
          >
            Discard
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!dirty || isMutating}
          >
            {isMutating ? "Saving..." : "Save"}
          </Button>
        </div>
      )}
      <ProseMirrorEditor
        key={`${resumeId}:${nonce}`}
        initialText={mountText}
        editable={editable}
        onChange={setCurrent}
        className="prose-resume text-[14px] leading-[1.7]"
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ResumeEditorScreen() {
  const params = useParams<{ id?: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  // Resolve resume id: from route param or fall back to the legacy static fixture id
  const resolvedId = params.id ?? LEGACY_RESUME_ID

  // Navigation state from match-explorer (CUR-020)
  const navState = (location.state ?? {}) as MatchEditorState
  const fromMatchExplorer = navState.from === "match-explorer"
  const gapsFromNav = navState.gaps

  const { data, isLoading, error, refetch } = useResumeById(resolvedId)
  const { forkResumeAsDraft, isMutating } = useResumeMutations()

  const isLocked = data ? data.tag === "TAILORED" || data.usedIn > 0 : false

  // Derive suggestions: gaps from nav state if present, else fallback
  const suggestions: ResumeSuggestion[] =
    fromMatchExplorer && gapsFromNav && gapsFromNav.length > 0
      ? suggestionsFromGaps(gapsFromNav)
      : FALLBACK_SUGGESTIONS

  const handleForkToDraft = async () => {
    if (!data) {
      return
    }
    try {
      const draft = await forkResumeAsDraft(
        data.id,
        navState.jobId ?? "general",
      )
      toast.success({
        title: "Forked to draft",
        sub: `"${draft.name}" is ready to edit.`,
      })
      navigate(`/resume/${draft.id}/edit`)
    } catch {
      toast.error({ title: "Could not fork resume", sub: "Please try again." })
    }
  }

  const title = data ? `Resume editor - ${data.name}` : "Resume editor"

  const subtitle =
    fromMatchExplorer && navState.jobId
      ? `Tailored from match report for ${navState.jobId}`
      : data?.subtitle
        ? `For ${data.subtitle}`
        : "For Stripe - Staff Engineer"

  return (
    <AppFrame active="resumes" title={title} subtitle={subtitle} bleed>
      <div className="flex h-full flex-col">
        {/* Loading */}
        {isLoading && (
          <div className="p-8">
            <Skeleton className="h-96" />
          </div>
        )}

        {/* CUR-017: error state */}
        {!isLoading && error && (
          <div className="p-8">
            {error.kind === "not_found" ? (
              <ResourceError
                label="This resume"
                notFound
                backLabel="Back to library"
                backTo="/resumes"
              />
            ) : (
              <ResourceError label="resume" error={error} onRetry={refetch} />
            )}
          </div>
        )}

        {/* Data loaded */}
        {!isLoading && !error && data && (
          <>
            {/* Lock / match-explorer banner */}
            {(isLocked || fromMatchExplorer) && (
              <div className="flex items-center gap-3 border-b border-border bg-[var(--bg-subtle)] px-8 py-3">
                {isLocked ? (
                  <>
                    <Badge variant="warn">
                      <LockIcon className="size-3" /> Locked - applied
                    </Badge>
                    <span className="text-[13px] text-[var(--fg-muted)]">
                      This revision is locked because it was used in an
                      application.
                    </span>
                    <div className="flex-1" />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleForkToDraft}
                      disabled={isMutating}
                    >
                      {isMutating ? "Forking..." : "Fork to draft"}
                    </Button>
                  </>
                ) : fromMatchExplorer ? (
                  <>
                    <SparklesIcon className="size-3.5 text-[var(--accent-text)]" />
                    <span className="text-[13px] text-[var(--fg-muted)]">
                      Seeded from match report gaps. Apply suggestions from the
                      rail to tailor this draft.
                    </span>
                    <div className="flex-1" />
                    <Link
                      to="/resumes/match-explorer"
                      className="text-sm text-[var(--accent-base)] hover:underline"
                    >
                      Back to match explorer
                    </Link>
                  </>
                ) : null}
              </div>
            )}

            <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px]">
              {/* Resume body */}
              <div className="relative overflow-y-auto p-8">
                <div className="mx-auto max-w-[720px]">
                  <h1 className="m-0 mb-2 text-2xl font-semibold tracking-[-0.015em]">
                    {data.name}
                  </h1>
                  <p className="m-0 text-[13.5px] text-[var(--fg-muted)]">
                    {data.subtitle}
                  </p>
                  <hr className="my-6 border-border" />
                  {/* RES-022: interactable ProseMirror editor with a formatting
                      toolbar + Save / Discard / Cancel. Read-only (no toolbar,
                      no actions) when the resume is locked (applied). */}
                  <ResumeBodyEditor
                    key={data.id}
                    resumeId={data.id}
                    body={
                      data.body ??
                      "Summary\n\nExperienced professional. Replace this with your tailored resume content -- click in and start editing."
                    }
                    editable={!isLocked}
                    onCancel={() => navigate("/resumes")}
                  />
                </div>
                {isLocked && (
                  <div className="pointer-events-none absolute inset-0 bg-[var(--bg)]/30" />
                )}
              </div>

              {/* Coach suggestions rail */}
              <aside className="overflow-y-auto border-l border-border bg-[var(--bg-subtle)] p-5">
                <h3 className="m-0 mb-3 text-[14px] font-semibold">
                  Coach suggestions
                </h3>
                {fromMatchExplorer && gapsFromNav && gapsFromNav.length > 0 && (
                  <p className="mb-3 text-[12px] text-[var(--accent-text)]">
                    Seeded from {gapsFromNav.length} gap
                    {gapsFromNav.length !== 1 ? "s" : ""} in your match report.
                  </p>
                )}
                <div className="flex flex-col gap-3">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)] p-3"
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        <SparklesIcon className="size-3 text-[var(--accent-text)]" />
                        <span className="text-[12.5px] font-semibold">
                          {suggestion.title}
                        </span>
                      </div>
                      <div className="mb-2 text-[12px] text-[var(--fg-muted)]">
                        {suggestion.question}
                      </div>
                      <Button variant="secondary" size="sm" disabled>
                        {suggestion.cta}
                      </Button>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </AppFrame>
  )
}
