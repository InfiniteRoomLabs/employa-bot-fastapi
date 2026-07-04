/**
 * JobDetailView -- renders a captured Job's full payload (ADR-006 / DEC-057).
 *
 * The canonical job-detail surface, shared by the standalone `/jobs/:id` page
 * and the inbox detail pane. Reads the normalized `Job` shape directly:
 * structured compensation (formatted on display), atomic employment axes,
 * capture provenance, match strengths/gaps, tags, requirements, raw JD. Partial
 * captures degrade gracefully -- only present fields render, with a "still
 * enriching" affordance instead of empty sections.
 */

import {
  AlertTriangleIcon,
  Building2Icon,
  CheckCircle2Icon,
  ClockIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LandmarkIcon,
  MapPinIcon,
  SparklesIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react"

import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge-eb"
import { Chip } from "@/components/ui/chip"
import type {
  Job,
  JobCaptureMethod,
  JobWorkMode,
  PayCadence,
  TimeCommitment,
  WorkerClassification,
} from "@/data/types"
import { formatSalary } from "@/lib/salary"

const CAPTURE_LABEL: Record<JobCaptureMethod, string> = {
  url: "Pasted URL",
  "jd-text": "Pasted JD text",
  extension: "Browser extension",
  "email-forward": "Forwarded email",
}

const WORK_MODE_LABEL: Record<JobWorkMode, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
}

const CLASSIFICATION_LABEL: Record<WorkerClassification, string> = {
  w2: "W-2",
  contract: "Contract",
  "1099": "1099",
}

const CADENCE_LABEL: Record<PayCadence, string> = {
  hourly: "Hourly",
  salary: "Salaried",
}

const COMMITMENT_LABEL: Record<TimeCommitment, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-[var(--fg-subtle)]" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--fg-subtle)]">
          {label}
        </div>
        <div className="text-[13px] text-[var(--fg-default)]">{value}</div>
      </div>
    </div>
  )
}

export function JobDetailView({ job }: { job: Job }) {
  const enriched = Boolean(
    job.summary ||
      job.description ||
      job.requirements?.length ||
      job.match?.strengths.length ||
      job.match?.gaps.length ||
      job.tags?.length,
  )

  const facts: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string
  }[] = [
    { icon: MapPinIcon, label: "Location", value: job.location.raw },
    {
      icon: WalletIcon,
      label: "Compensation",
      value: formatSalary(job.compensation),
    },
    {
      icon: Building2Icon,
      label: "Work mode",
      value: WORK_MODE_LABEL[job.workMode],
    },
    {
      icon: LandmarkIcon,
      label: "Employment",
      value: `${CLASSIFICATION_LABEL[job.employment.classification]} - ${CADENCE_LABEL[job.employment.cadence]} - ${COMMITMENT_LABEL[job.employment.commitment]}`,
    },
    ...(job.seniority
      ? [{ icon: TrendingUpIcon, label: "Seniority", value: job.seniority }]
      : []),
    { icon: ClockIcon, label: "Posted", value: job.posted },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-2 flex items-center gap-3">
        <h2 className="m-0 text-2xl font-semibold tracking-[-0.015em]">
          {job.title}
        </h2>
        {job.isNew ? <Badge variant="accent">NEW</Badge> : null}
      </div>
      <div className="mb-1 text-[15px] text-[var(--fg-muted)]">
        {job.company}
      </div>

      {/* Capture provenance */}
      <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--fg-subtle)]">
        <SparklesIcon className="size-3.5" />
        <span>
          Captured via {CAPTURE_LABEL[job.source.channel]} -{" "}
          {job.source.capturedAt}
        </span>
        {job.source.url ? (
          <>
            <span aria-hidden>-</span>
            <a
              href={job.source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
            >
              <ExternalLinkIcon className="size-3" /> View original posting
            </a>
          </>
        ) : null}
      </div>

      {/* Key facts grid */}
      <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-border bg-[var(--bg-subtle)] p-4">
        {facts.map((fact) => (
          <Fact
            key={fact.label}
            icon={fact.icon}
            label={fact.label}
            value={fact.value}
          />
        ))}
      </div>

      {/* Summary */}
      {job.summary ? (
        <p className="mb-6 text-[14px] leading-relaxed text-[var(--fg-default)]">
          {job.summary}
        </p>
      ) : null}

      {/* Match panel */}
      {job.match && (job.match.strengths.length || job.match.gaps.length) ? (
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="m-0 text-[15px] font-semibold">Match analysis</h3>
            <Badge variant={job.match.score >= 85 ? "accent" : "default"}>
              {job.match.score}% match
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {job.match.strengths.length ? (
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--success-text)]">
                  <CheckCircle2Icon className="size-3.5" /> Strengths
                </div>
                <ul className="m-0 list-none space-y-1.5 p-0">
                  {job.match.strengths.map((strength, index) => (
                    <li
                      key={index}
                      className="flex gap-2 text-[13px] text-[var(--fg-muted)]"
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--success-text)]" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {job.match.gaps.length ? (
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--warn-text)]">
                  <AlertTriangleIcon className="size-3.5" /> Gaps
                </div>
                <ul className="m-0 list-none space-y-1.5 p-0">
                  {job.match.gaps.map((gap, index) => (
                    <li
                      key={index}
                      className="flex gap-2 text-[13px] text-[var(--fg-muted)]"
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--warn-text)]" />
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* CTX-034: when the posting is captured but no resume has been scored
          against it yet, prompt the user to add one inline. */}
      {enriched && !job.match ? (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-dashed border-border bg-[var(--bg-subtle)] p-4">
          <SparklesIcon className="size-4 shrink-0 text-[var(--accent)]" />
          <div className="flex-1 text-[13px] text-[var(--fg-muted)]">
            No resume scored against this job yet. Add one to see your match.
          </div>
          <Link
            to="/resumes"
            className="shrink-0 rounded-md border border-border bg-[var(--bg-elevated)] px-3 py-1.5 text-[13px] font-medium hover:border-[var(--border-strong)]"
          >
            Add a resume
          </Link>
        </div>
      ) : null}

      {/* Tags */}
      {job.tags?.length ? (
        <section className="mb-6">
          <h3 className="mb-2 mt-0 text-[15px] font-semibold">
            Skills &amp; credentials
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {job.tags.map((tag) => (
              <Chip key={tag} variant="dash">
                {tag}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}

      {/* Requirements */}
      {job.requirements?.length ? (
        <section className="mb-6">
          <h3 className="mb-2 mt-0 text-[15px] font-semibold">
            Key requirements
          </h3>
          <ul className="m-0 list-disc space-y-1 pl-5 text-[13px] text-[var(--fg-muted)]">
            {job.requirements.map((requirement, index) => (
              <li key={index}>{requirement}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Raw JD -- own scroll region */}
      {job.description ? (
        <section className="mb-2">
          <h3 className="mb-2 mt-0 flex items-center gap-1.5 text-[15px] font-semibold">
            <FileTextIcon className="size-4" /> Original job description
          </h3>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-[var(--bg-subtle)] p-4 font-sans text-[13px] leading-relaxed text-[var(--fg-muted)]">
            {job.description}
          </pre>
        </section>
      ) : null}

      {/* Partial-capture affordance */}
      {!enriched ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-border bg-[var(--bg-subtle)] p-4 text-[13px] text-[var(--fg-subtle)]">
          <SparklesIcon className="size-4 animate-pulse" />
          Still enriching this capture - full description, requirements, and
          match analysis will appear here shortly.
        </div>
      ) : null}
    </div>
  )
}
