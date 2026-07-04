/**
 * Job detail -- the standalone `/jobs/:id` posting page (ADR-006).
 *
 * The first-class job-detail surface that the inbox, shortlist, and (soon)
 * application detail all link to. Renders the full captured payload + match via
 * the shared <JobDetailView>. Match stats live HERE (not on the match-explorer)
 * -- STORY-DEC-058.
 *
 * Picker id: `job-detail`
 * Route path: `/jobs/:id`
 *
 * Contracts: CUR-017 (error + not-found), ORI-014 (toast on Shortlist).
 */

import { ArchiveIcon, PlusIcon } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { ResourceError } from "@/components/atoms/resource-error"
import { JobDetailView } from "@/components/domain/job-detail-view"
import { AppFrame } from "@/components/shell/app-frame"
import { Button } from "@/components/ui/button-eb"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { useAddJobToShortlist, useJob } from "@/hooks"
import { formatSalary } from "@/lib/salary"

export default function JobDetailScreen() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: job, isLoading, error, refetch } = useJob(id)
  const { addToShortlist, isSaving } = useAddJobToShortlist()

  if (!isLoading && error) {
    if (error.kind === "not_found") {
      return (
        <AppFrame active="jobs" title="Job not found" subtitle="<- Jobs">
          <ResourceError
            label="That job"
            notFound
            backLabel="Back to Jobs"
            backTo="/jobs"
          />
        </AppFrame>
      )
    }
    return (
      <AppFrame active="jobs" title="Job" subtitle="<- Jobs">
        <ResourceError label="job" error={error} onRetry={refetch} />
      </AppFrame>
    )
  }

  async function handleShortlist() {
    if (!job) {
      return
    }
    try {
      await addToShortlist({
        jobId: job.id,
        company: job.company,
        role: job.title,
        location: job.location.raw,
        compensation: formatSalary(job.compensation),
        match: job.match?.score ?? 0,
      })
      toast.success({ title: "Saved to shortlist", sub: job.title })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error({ title: "Could not save to shortlist", sub: message })
    }
  }

  return (
    <AppFrame
      active="jobs"
      title={job ? job.title : "Job"}
      subtitle="<- Jobs"
      topbarActions={
        job ? (
          <Button
            variant="default"
            size="sm"
            onClick={handleShortlist}
            disabled={isSaving}
          >
            <PlusIcon className="size-3.5" /> Shortlist
          </Button>
        ) : undefined
      }
    >
      {isLoading || !job ? (
        <Skeleton className="h-96 w-full max-w-3xl" />
      ) : (
        <div className="max-w-3xl">
          <JobDetailView job={job} />
          <div className="mt-6 flex gap-2">
            <Button
              variant="default"
              onClick={handleShortlist}
              disabled={isSaving}
            >
              <PlusIcon className="size-3.5" /> Add to shortlist
            </Button>
            <Button variant="secondary" onClick={() => navigate("/jobs")}>
              <ArchiveIcon className="size-3.5" /> Back to inbox
            </Button>
          </div>
        </div>
      )}
    </AppFrame>
  )
}
