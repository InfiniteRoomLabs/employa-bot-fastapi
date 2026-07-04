/**
 * ResumePreviewScreen (RES-020) -- full resume preview / locked state.
 *
 * Reads the resume id from URL params via useResumeById().
 * - DRAFT/VARIANT/FORMAT/MASTER: shows body content (editable placeholder).
 * - TAILORED (locked, usedIn > 0): shows the locked overlay + "Fork to draft" CTA.
 * - Error/not-found: CUR-017 ResourceError with back-link.
 */

import { FileTextIcon, LockIcon } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ResourceError } from "@/components/atoms/resource-error"
import { AppFrame } from "@/components/shell/app-frame"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { Resume } from "@/data/types"
import { useResumeById, useResumeMutations } from "@/hooks"

// ---------------------------------------------------------------------------
// Tag-to-Badge-variant helper
// ---------------------------------------------------------------------------

function tagBadgeVariant(
  tag: Resume["tag"],
): "default" | "accent" | "warn" | "info" {
  if (tag === "DEFAULT") {
    return "accent"
  }
  if (tag === "TAILORED") {
    return "warn"
  }
  if (tag === "MASTER") {
    return "info"
  }
  return "default"
}

// ---------------------------------------------------------------------------
// Locked overlay panel
// ---------------------------------------------------------------------------

interface LockedPanelProps {
  resume: Resume
  onFork: () => void
  isMutating: boolean
}

function LockedPanel({ resume, onFork, isMutating }: LockedPanelProps) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-border">
      {/* Dim overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[var(--bg)]/40" />

      {/* Lock badge row */}
      <div className="relative z-20 flex items-center gap-3 border-b border-border bg-[var(--bg-subtle)] px-6 py-3">
        <Badge variant="warn">
          <LockIcon className="size-3" /> Locked - applied
        </Badge>
        <span className="text-[13px] text-[var(--fg-muted)]">
          This revision is locked because it was used in an application.
        </span>
        <div className="flex-1" />
        <Button
          variant="secondary"
          size="sm"
          onClick={onFork}
          disabled={isMutating}
        >
          {isMutating ? "Forking..." : "Fork to draft"}
        </Button>
      </div>

      {/* Body content (dimmed) */}
      <div className="relative p-8">
        <div className="mx-auto max-w-[720px]">
          <h1 className="m-0 mb-2 text-2xl font-semibold tracking-[-0.015em]">
            {resume.name}
          </h1>
          <p className="m-0 text-[13.5px] text-[var(--fg-muted)]">
            {resume.subtitle}
          </p>
          <hr className="my-6 border-border" />
          {resume.body ? (
            <p className="text-[14px] leading-[1.7] text-[var(--fg-base)]">
              {resume.body}
            </p>
          ) : (
            <p className="text-[14px] leading-[1.7] text-[var(--fg-muted)] italic">
              Resume body content is locked with this revision.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

// Fallback id shown in Storybook / isolated test renders without a router :id param.
const PREVIEW_FALLBACK_ID = "master"

export default function ResumePreviewScreen() {
  const params = useParams<{ id: string }>()
  // Use route param when available; fall back to fixture for Storybook/test renders.
  const id = params.id ?? PREVIEW_FALLBACK_ID
  const navigate = useNavigate()
  const { data, error, isLoading, refetch } = useResumeById(id)
  const { forkResumeAsDraft, isMutating } = useResumeMutations()

  const isLocked = data ? data.tag === "TAILORED" || data.usedIn > 0 : false

  const handleFork = async () => {
    if (!data) {
      return
    }
    try {
      const draft = await forkResumeAsDraft(data.id, "general")
      toast.success({
        title: "Forked to draft",
        sub: `"${draft.name}" is ready to edit.`,
      })
      navigate(`/resume/${draft.id}/edit`)
    } catch {
      toast.error({ title: "Could not fork resume", sub: "Please try again." })
    }
  }

  return (
    <AppFrame
      title={data ? data.name : "Resume"}
      subtitle={
        <Link
          to="/resumes"
          className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
        >
          &larr; Resumes library
        </Link>
      }
      active="resumes"
    >
      {/* Loading */}
      {isLoading && <Skeleton className="h-64 w-full" />}

      {/* CUR-017: error states */}
      {!isLoading &&
        error &&
        (error.kind === "not_found" ? (
          <ResourceError
            label="This resume"
            notFound
            backLabel="Back to library"
            backTo="/resumes"
          />
        ) : (
          <ResourceError label="resume" error={error} onRetry={refetch} />
        ))}

      {/* Data loaded */}
      {!isLoading && !error && data && (
        <div className="flex flex-col gap-6">
          {/* Header strip */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={tagBadgeVariant(data.tag)}>{data.tag}</Badge>
            <span className="font-mono text-[11px] text-[var(--fg-subtle)]">
              {data.version}
            </span>
            <span className="text-[12px] text-[var(--fg-subtle)]">
              used in{" "}
              <strong className="font-mono text-[var(--fg)]">
                {data.usedIn}
              </strong>{" "}
              {data.usedIn === 1 ? "application" : "applications"}
            </span>
            <span className="text-[12px] text-[var(--fg-subtle)]">
              updated {data.updated}
            </span>
            {!isLocked && (
              <div className="ml-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/resume/${data.id}/edit`)}
                >
                  Edit
                </Button>
              </div>
            )}
          </div>

          {/* Locked state */}
          {isLocked ? (
            <LockedPanel
              resume={data}
              onFork={handleFork}
              isMutating={isMutating}
            />
          ) : (
            /* Editable / preview body */
            <div className="rounded-[var(--radius-md)] border border-border p-8">
              <div className="mx-auto max-w-[720px]">
                <div className="mb-2 flex items-center gap-2">
                  <FileTextIcon
                    className="size-4 text-[var(--fg-subtle)]"
                    aria-hidden
                  />
                  <h1 className="m-0 text-2xl font-semibold tracking-[-0.015em]">
                    {data.name}
                  </h1>
                </div>
                <p className="m-0 text-[13.5px] text-[var(--fg-muted)]">
                  {data.subtitle}
                </p>
                <hr className="my-6 border-border" />
                {data.body ? (
                  <p className="text-[14px] leading-[1.7] text-[var(--fg-base)]">
                    {data.body}
                  </p>
                ) : (
                  <p className="text-[14px] leading-[1.7] text-[var(--fg-muted)] italic">
                    No content yet. Open the editor to start writing.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </AppFrame>
  )
}
