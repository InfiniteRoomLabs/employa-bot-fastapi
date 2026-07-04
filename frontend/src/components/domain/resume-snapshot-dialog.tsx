/**
 * Read-only view of the immutable resume snapshot submitted with an application
 * (D10). The submitted copy is locked; the editable master lives elsewhere. The
 * body fetch is lazy -- it only runs while the dialog is open.
 *
 * Copy is protective, not punitive: "edit the master to create a new version"
 * rather than "cannot edit".
 */

import { Lock } from "lucide-react"
import { ResourceError } from "@/components/atoms/resource-error"
import { Button } from "@/components/ui/button-eb"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useResumeSnapshot } from "@/hooks"

function SnapshotBody({
  appId,
  onEditMaster,
}: {
  appId: string
  onEditMaster?: () => void
}) {
  const { data, isLoading, error, refetch } = useResumeSnapshot(appId)
  if (isLoading) {
    return <Skeleton className="h-48 w-full" />
  }
  if (error) {
    return (
      <ResourceError label="submitted resume" error={error} onRetry={refetch} />
    )
  }
  if (!data) {
    return null
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-border bg-[var(--bg-subtle)] px-3 py-2 text-[12px] text-[var(--fg-muted)]">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          This is the copy of <strong>{data.name}</strong> you submitted{" "}
          {data.capturedAt} (template {data.templateVersion}). It is locked --
          edit the master to create a new version; this snapshot never changes.
        </span>
      </div>
      <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)] p-3 font-mono text-[12px]">
        {data.body}
      </pre>
      {onEditMaster ? (
        <div>
          <Button variant="secondary" size="sm" onClick={onEditMaster}>
            Edit the master instead
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export interface ResumeSnapshotDialogProps {
  appId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Navigate to the editable master resume. */
  onEditMaster?: () => void
}

export function ResumeSnapshotDialog({
  appId,
  open,
  onOpenChange,
  onEditMaster,
}: ResumeSnapshotDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submitted resume (locked)</DialogTitle>
          <DialogDescription>
            The exact resume that went out with this application.
          </DialogDescription>
        </DialogHeader>
        {/* Lazy: the hook only runs while the dialog is open. */}
        {open ? (
          <SnapshotBody appId={appId} onEditMaster={onEditMaster} />
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
