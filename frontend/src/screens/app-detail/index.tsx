/**
 * Application detail - per-app deep dive: stage tracker, fact cards, timeline,
 * coach nudges, interview rounds.
 *
 * Picker id: `app-detail`
 * Route path: `/applications/:id` (Phase 9)
 *
 * Stories implemented:
 *   TRK-118 -- fully :id-parameterized (title/breadcrumb/coach body/fact cards)
 *   TRK-117 -- interview rounds list with Prep -> /coach, EmptyState when none
 *   CUR-017 -- ResourceError on fetch error, not-found panel for bad :id
 */

import {
  BriefcaseIcon,
  CalendarIcon,
  HistoryIcon,
  LockIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  VideoIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { EmptyState } from "@/components/atoms/empty-state"
import { MatchPill } from "@/components/atoms/match-pill"
import { ResourceError } from "@/components/atoms/resource-error"
import { Section } from "@/components/atoms/section"
import { CoachBlock } from "@/components/domain/coach-block"
import { CompanyHeader } from "@/components/domain/company-header"
import { ResumeSnapshotDialog } from "@/components/domain/resume-snapshot-dialog"
import { TimelineRow } from "@/components/domain/timeline-row"
import { AppFrame } from "@/components/shell/app-frame"
import { Breadcrumbs } from "@/components/shell/breadcrumbs"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { InterviewRound, Stage } from "@/data/types"
import type { InterviewRoundPatch } from "@/hooks"
import {
  useApplication,
  useApplicationTimeline,
  useInterviewMutations,
  useInterviewRounds,
} from "@/hooks"
import { formatSalary } from "@/lib/salary"

// ---------------------------------------------------------------------------
// Stage ordering for fact-card source labels
// ---------------------------------------------------------------------------

const STAGE_ORDER_ARR: readonly Stage[] = [
  "saved",
  "draft",
  "applied",
  "screen",
  "interview",
  "offer",
  "rejected",
  "closed",
]

function isAtOrPastApplied(stage: Stage): boolean {
  return STAGE_ORDER_ARR.indexOf(stage) >= STAGE_ORDER_ARR.indexOf("applied")
}

// ---------------------------------------------------------------------------
// Human-readable source labels
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse ATS",
  workday: "Workday ATS",
  recruiter: "Recruiter referral",
  ashby: "Ashby ATS",
  "hospital-direct": "Hospital direct",
  usajobs: "USAJobs",
  indeed: "Indeed",
}

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source
}

// ---------------------------------------------------------------------------
// Interview round format icon
// ---------------------------------------------------------------------------

function InterviewFormatIcon({ format }: { format: InterviewRound["format"] }) {
  if (format === "video") {
    return <VideoIcon className="size-3.5 text-[var(--fg-subtle)]" />
  }
  if (format === "phone") {
    return <PhoneIcon className="size-3.5 text-[var(--fg-subtle)]" />
  }
  return <MapPinIcon className="size-3.5 text-[var(--fg-subtle)]" />
}

// ---------------------------------------------------------------------------
// InterviewRoundsSection (TRK-117)
// ---------------------------------------------------------------------------

function InterviewRoundsSection({ appId }: { appId: string }) {
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useInterviewRounds(appId)
  // D3 / TRK-127: interview records are editable, but only across an allowlist.
  const { patchRound, isBusy } = useInterviewMutations()
  const [editing, setEditing] = useState<InterviewRound | null>(null)
  const [draft, setDraft] = useState<InterviewRoundPatch>({})

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />
  }
  if (error) {
    return (
      <ResourceError label="interview rounds" error={error} onRetry={refetch} />
    )
  }
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={CalendarIcon}
        headline="No interviews scheduled yet"
        body="When interviews are set up, they will appear here."
      />
    )
  }

  const TYPE_LABELS: Record<InterviewRound["type"], string> = {
    "recruiter-screen": "Recruiter screen",
    technical: "Technical interview",
    onsite: "Onsite interview",
    final: "Final round",
  }
  const STATUS_CLASSES: Record<InterviewRound["status"], string> = {
    scheduled: "text-[var(--accent-base)]",
    completed: "text-[var(--fg-subtle)]",
    cancelled: "text-[var(--danger-text)] line-through",
  }

  const openEdit = (round: InterviewRound) => {
    setEditing(round)
    setDraft({
      date: round.date,
      type: round.type,
      format: round.format,
      status: round.status,
    })
  }

  const handleSaveEdit = async () => {
    if (!editing) {
      return
    }
    try {
      await patchRound(appId, editing.id, draft)
      setEditing(null)
      refetch()
      toast.success({ title: "Interview updated" })
    } catch {
      toast.error({
        title: "Could not update the interview",
        sub: "Please try again.",
      })
    }
  }

  const TYPE_OPTIONS: InterviewRound["type"][] = [
    "recruiter-screen",
    "technical",
    "onsite",
    "final",
  ]
  const FORMAT_OPTIONS: InterviewRound["format"][] = [
    "video",
    "phone",
    "onsite",
  ]
  const STATUS_OPTIONS: InterviewRound["status"][] = [
    "scheduled",
    "completed",
    "cancelled",
  ]

  return (
    <>
      <div className="flex flex-col gap-2">
        {data.map((round) => (
          <div
            key={round.id}
            className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)] px-4 py-3"
          >
            <InterviewFormatIcon format={round.format} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">
                {TYPE_LABELS[round.type]}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[var(--fg-subtle)]">
                <span>{round.date}</span>
                <span aria-hidden>-</span>
                <span className={STATUS_CLASSES[round.status]}>
                  {round.status}
                </span>
              </div>
            </div>
            {round.status === "scheduled" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("/coach")}
              >
                Prep
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Edit interview"
              onClick={() => openEdit(round)}
            >
              <PencilIcon className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {/* D3 / TRK-127: edit an interview record across the field allowlist. */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit interview</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="font-medium">Date</span>
              <Input
                value={draft.date ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, date: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="font-medium">Type</span>
              <Select
                value={draft.type}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, type: v as InterviewRound["type"] }))
                }
              >
                <SelectTrigger aria-label="Interview type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="font-medium">Format</span>
              <Select
                value={draft.format}
                onValueChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    format: v as InterviewRound["format"],
                  }))
                }
              >
                <SelectTrigger aria-label="Interview format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="font-medium">Status</span>
              <Select
                value={draft.status}
                onValueChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    status: v as InterviewRound["status"],
                  }))
                }
              >
                <SelectTrigger aria-label="Interview status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="default"
              onClick={handleSaveEdit}
              disabled={isBusy}
            >
              {isBusy ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// TimelineSection (TRK-118)
// ---------------------------------------------------------------------------

function TimelineSection({ appId }: { appId: string }) {
  const { data, isLoading, error, refetch } = useApplicationTimeline(appId)

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />
  }
  if (error) {
    return (
      <ResourceError label="event timeline" error={error} onRetry={refetch} />
    )
  }
  if (!data || data.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((ev) => (
        <TimelineRow
          key={ev.id}
          time={ev.time}
          who={ev.who}
          msg={ev.message}
          badge={ev.badge ? <Badge>{ev.badge}</Badge> : undefined}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AppDetailScreen
// ---------------------------------------------------------------------------

const STAGES: readonly Stage[] = [
  "saved",
  "draft",
  "applied",
  "screen",
  "interview",
  "offer",
  "rejected",
  "closed",
]

export default function AppDetailScreen() {
  // URL drives the fetch when the screen is mounted via the router. The
  // `'stripe'` fallback keeps the standalone screen (Storybook, picker
  // previews, isolated tests with no `:id` in the URL) showing real data.
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const appId = params.id ?? "stripe"
  const { data, isLoading, error, refetch } = useApplication(appId)

  // Local stage override so the "click to change" tracker is interactive.
  // Mock-only: not persisted; resets when a different application loads
  // (mirrors the applications-list local-mutation pattern).
  const [stageOverride, setStageOverride] = useState<Stage | undefined>(
    undefined,
  )
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStageOverride(undefined)
  }, [appId])

  // D10: read-only view of the locked submitted-resume snapshot.
  const [snapOpen, setSnapOpen] = useState(false)

  // ----- Error branches (CUR-017)
  if (!isLoading && error) {
    if (error.kind === "not_found") {
      return (
        <AppFrame
          active="app-detail"
          title="Application not found"
          subtitle={
            <Breadcrumbs
              items={[
                { label: "Applications", to: "/applications" },
                { label: "Not found" },
              ]}
            />
          }
        >
          <ResourceError
            label="That application"
            notFound
            backLabel="Back to Applications"
            backTo="/applications"
          />
        </AppFrame>
      )
    }
    return (
      <AppFrame
        active="app-detail"
        title="Application"
        subtitle={
          <Breadcrumbs
            items={[
              { label: "Applications", to: "/applications" },
              { label: "Error" },
            ]}
          />
        }
      >
        <ResourceError label="application" error={error} onRetry={refetch} />
      </AppFrame>
    )
  }

  // ----- Loading
  if (isLoading || !data) {
    return (
      <AppFrame
        active="app-detail"
        title="Application"
        subtitle={
          <Breadcrumbs
            items={[
              { label: "Applications", to: "/applications" },
              { label: "Detail" },
            ]}
          />
        }
      >
        <Skeleton className="h-96" />
      </AppFrame>
    )
  }

  // ----- Derived labels (TRK-118)
  const stage = stageOverride ?? data.stage
  const resumeSubLabel = isAtOrPastApplied(stage)
    ? "locked (applied)"
    : "draft (not submitted)"
  const srcLabel = sourceLabel(data.source)
  const contactSubLabel = data.contact ? "Talent acquisition" : "Add manually"

  return (
    <AppFrame
      active="app-detail"
      title={`${data.company} - ${data.role}`}
      subtitle={
        <Breadcrumbs
          items={[
            { label: "Applications", to: "/applications" },
            { label: data.company },
          ]}
        />
      }
    >
      <div className="mb-6 flex items-start gap-4">
        <CompanyHeader
          name={data.company}
          role={data.role}
          loc={data.location}
          salary={formatSalary(data.salary)}
          match={data.match}
        />
        {/* ADR-006: hop to the underlying job posting. */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/jobs/${data.jobId}`)}
        >
          <BriefcaseIcon className="size-3.5" /> View job posting
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            toast.default({
              title: "Full history is below",
              sub: "See the Event timeline section for this application.",
            })
          }
        >
          <HistoryIcon className="size-3.5" /> History
        </Button>
        <MatchPill score={data.match} />
      </div>

      {/* Stage tracker */}
      <div className="card-tight mb-5 rounded-[var(--radius-lg)] border border-border bg-[var(--bg-subtle)] p-3.5">
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
          Stage - click to change
        </div>
        <div className="stage-track">
          {STAGES.map((stage, index) => (
            <button
              key={stage}
              onClick={() => {
                if (stage === stage) {
                  return
                }
                setStageOverride(stage)
                toast.success({ title: `Stage -> ${stage}`, sub: data.company })
              }}
              className={
                "stage-step " +
                (stage === stage
                  ? "stage-step--current "
                  : STAGES.indexOf(stage) > index
                    ? "stage-step--past "
                    : "") +
                (index >= 6 ? "stage-step--terminal" : "")
              }
            >
              {stage}
            </button>
          ))}
        </div>
      </div>

      {/* Fact cards */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
            Résumé used
          </div>
          <div className="text-[13px] font-medium">{data.resumeName}</div>
          <div className="mt-0.5 text-[11px] text-[var(--fg-subtle)]">
            {resumeSubLabel}
          </div>
          {isAtOrPastApplied(stage) ? (
            <button
              type="button"
              onClick={() => setSnapOpen(true)}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-text)] hover:underline"
            >
              <LockIcon className="size-3" aria-hidden /> View submitted copy
            </button>
          ) : null}
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
            Source
          </div>
          <div className="text-[13px] font-medium">{data.source}</div>
          <div className="mt-0.5 text-[11px] text-[var(--fg-subtle)]">
            {srcLabel}
          </div>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
            Contact
          </div>
          <div className="text-[13px] font-medium">
            {data.contact ?? "Not captured"}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--fg-subtle)]">
            {contactSubLabel}
          </div>
        </div>
      </div>

      {/* D10: locked submitted-resume snapshot */}
      <ResumeSnapshotDialog
        appId={data.id}
        open={snapOpen}
        onOpenChange={setSnapOpen}
        onEditMaster={() => navigate("/resumes")}
      />

      {/* Coach nudge (TRK-118 -- interpolated copy) */}
      {data.coachNudge ? (
        <CoachBlock>
          You have waited {data.days} days without a reply from {data.company}.
          A short, non-needy follow-up can lift response rate.
          <div className="mt-2 flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/coach")}
            >
              Open follow-up draft
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/coach")}
            >
              Rewrite with coach
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStageOverride("rejected")
                toast.warn({
                  title: "Marked as ghosted",
                  sub: `${data.company} moved to no-response.`,
                })
              }}
            >
              Mark ghosted
            </Button>
          </div>
        </CoachBlock>
      ) : null}

      {/* Interview rounds (TRK-117) */}
      <div className="mt-6">
        <Section title="Interview rounds">
          <InterviewRoundsSection appId={appId} />
        </Section>
      </div>

      {/* Event timeline (TRK-118 -- fixture-driven) */}
      <div className="mt-6">
        <Section title="Event timeline">
          <TimelineSection appId={appId} />
        </Section>
      </div>
    </AppFrame>
  )
}
