/**
 * Soft-delete confirmation with a typed dependent-count + drill-down (D24).
 * Shows the blast radius BEFORE the user commits. Copy is protective, not
 * punitive: this moves the item to the trash (recoverable), it does not destroy
 * it -- so the framing is blue/neutral, not red (red is reserved for purge).
 *
 * The impact fetch is lazy -- it only runs while the dialog is open.
 */

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
import type { LibraryKind } from "@/data/types"
import { useDeletionImpact } from "@/hooks"

function ImpactBody({ kind, id }: { kind: LibraryKind; id: string }) {
  const { data, isLoading, error, refetch } = useDeletionImpact(kind, id)
  if (isLoading) {
    return <Skeleton className="h-16 w-full" />
  }
  if (error) {
    return (
      <ResourceError label="deletion impact" error={error} onRetry={refetch} />
    )
  }
  if (!data) {
    return null
  }
  if (data.total === 0) {
    return (
      <p className="text-[13px] text-[var(--fg-muted)]">
        Nothing else references this item. It moves to the trash and can be
        restored anytime.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-[var(--fg-base)]">
        {data.total} item{data.total !== 1 ? "s" : ""} reference this. They will
        show a tombstone until you restore it.
      </p>
      {data.dependents.map((dependent) => (
        <details
          key={dependent.kind}
          className="rounded-[var(--radius-md)] border border-border px-3 py-2"
        >
          <summary className="cursor-pointer text-[12px] font-medium">
            {dependent.count} {dependent.kind}
            {dependent.count !== 1 ? "s" : ""}
          </summary>
          <ul className="mt-1 list-disc pl-5 text-[12px] text-[var(--fg-muted)]">
            {dependent.items.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}

export interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: LibraryKind
  id: string
  label: string
  onConfirm: () => void
  busy?: boolean
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  kind,
  id,
  label,
  onConfirm,
  busy,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move &quot;{label}&quot; to trash?</DialogTitle>
          <DialogDescription>
            This is a soft delete -- the item is recoverable from the trash.
            Permanently purge it later to free up storage.
          </DialogDescription>
        </DialogHeader>
        {open ? <ImpactBody kind={kind} id={id} /> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="secondary" onClick={onConfirm} disabled={busy}>
            {busy ? "Moving..." : "Move to trash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
