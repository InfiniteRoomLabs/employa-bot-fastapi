/**
 * Library Trash (D24). Lists soft-deleted bounded entities with restore +
 * permanent-purge. Restore is a quick, safe action; purge is irreversible and
 * gated by a confirm (it frees storage). Route: /library/trash.
 */

import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { EmptyState } from "@/components/atoms/empty-state"
import { ResourceError } from "@/components/atoms/resource-error"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Badge } from "@/components/ui/badge-eb"
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
import { toast } from "@/components/ui/toast"
import type { TrashEntry } from "@/data/types"
import { useLibraryTrashMutations, useTrash } from "@/hooks"

export default function TrashScreen() {
  const { data, isLoading, error, refetch } = useTrash()
  const { restore, purge, isBusy } = useLibraryTrashMutations()
  const [purgeTarget, setPurgeTarget] = useState<TrashEntry | null>(null)

  const count = data?.length ?? 0

  const handleRestore = async (entry: TrashEntry) => {
    try {
      await restore(entry.kind, entry.id)
      toast.success({ title: "Restored", sub: entry.label })
      refetch()
    } catch {
      toast.error({ title: "Could not restore", sub: "Please try again." })
    }
  }

  const confirmPurge = async () => {
    if (!purgeTarget) {
      return
    }
    const entry = purgeTarget
    setPurgeTarget(null)
    try {
      await purge(entry.kind, entry.id)
      toast.success({
        title: "Permanently deleted",
        sub: `${entry.label} -- storage freed.`,
      })
      refetch()
    } catch {
      toast.error({ title: "Could not purge", sub: "Please try again." })
    }
  }

  return (
    <AppFrame
      active="library-trash"
      title="Trash"
      subtitle={`${count} recoverable item${count !== 1 ? "s" : ""}`}
    >
      <PageHead
        eyebrow="Library"
        title="Trash"
        lede="Soft-deleted Library items. Restore them, or purge to permanently free storage. Dependents of a deleted item show a tombstone until you restore it."
      />

      {isLoading && !data ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <ResourceError label="trash" error={error} onRetry={refetch} />
      ) : count === 0 ? (
        <EmptyState
          icon={Trash2Icon}
          headline="Trash is empty"
          body="Deleted Library items land here and can be restored anytime."
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="tbl w-full">
            <thead>
              <tr>
                <th>Item</th>
                <th>Kind</th>
                <th>Deleted</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data!.map((entry) => (
                <tr
                  key={`${entry.kind}-${entry.id}`}
                  className="border-t border-border"
                >
                  <td className="px-3 py-3 font-medium">{entry.label}</td>
                  <td className="px-3 py-3">
                    <Badge variant="default">{entry.kind}</Badge>
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px] text-[var(--fg-muted)]">
                    {entry.deletedAt.slice(0, 10)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRestore(entry)}
                        disabled={isBusy}
                      >
                        Restore
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setPurgeTarget(entry)}
                        disabled={isBusy}
                      >
                        Purge
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Irreversible purge confirm */}
      <Dialog
        open={purgeTarget !== null}
        onOpenChange={(open) => !open && setPurgeTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete?</DialogTitle>
            <DialogDescription>
              &quot;{purgeTarget?.label}&quot; will be purged and its storage
              freed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="danger" onClick={confirmPurge} disabled={isBusy}>
              {isBusy ? "Purging..." : "Purge permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppFrame>
  )
}
