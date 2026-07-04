/**
 * Accomplishments (ACC-001/003). Reusable quantified wins / STAR stories,
 * authored directly or derived from a Project (ACC-002, snapshot + backlink).
 */

import { AwardIcon, PlusIcon, Trash2Icon } from "lucide-react"
import * as React from "react"
import { EmptyState } from "@/components/atoms/empty-state"
import { FormField } from "@/components/atoms/form-field"
import { ResourceError } from "@/components/atoms/resource-error"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Card } from "@/components/ui/card-eb"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import type { Accomplishment } from "@/data/types"
import { useAccomplishments, useLibraryMutations } from "@/hooks"

interface FormState {
  title: string
  summary: string
  tags: string
}

const EMPTY: FormState = { title: "", summary: "", tags: "" }

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

export default function AccomplishmentsScreen() {
  const { data, isLoading, error, refetch } = useAccomplishments()
  const {
    createAccomplishment,
    updateAccomplishment,
    deleteAccomplishment,
    isMutating,
  } = useLibraryMutations()

  const [editing, setEditing] = React.useState<Accomplishment | null>(null)
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  const openEdit = (a: Accomplishment) => {
    setEditing(a)
    setForm({ title: a.title, summary: a.summary, tags: a.tags.join(", ") })
    setOpen(true)
  }

  const save = async () => {
    if (form.title.trim().length === 0) {
      toast.warn({ title: "Title is required" })
      return
    }
    const payload = {
      title: form.title,
      summary: form.summary,
      tags: parseTags(form.tags),
    }
    try {
      if (editing) {
        await updateAccomplishment(editing.id, payload)
        toast.success({ title: "Accomplishment updated" })
      } else {
        await createAccomplishment({ ...payload, source: null })
        toast.success({ title: "Accomplishment added" })
      }
      setOpen(false)
      refetch()
    } catch {
      toast.error({ title: "Could not save accomplishment" })
    }
  }

  const remove = async (a: Accomplishment) => {
    try {
      await deleteAccomplishment(a.id)
      toast.success({ title: "Accomplishment removed" })
      refetch()
    } catch {
      toast.error({ title: "Could not remove accomplishment" })
    }
  }

  const rows = data ?? []

  return (
    <AppFrame
      active="accomplishments"
      title="Accomplishments"
      subtitle={`${rows.length} wins`}
    >
      <PageHead
        eyebrow="Library"
        title="Accomplishments"
        lede="Quantified wins and STAR-shaped stories you reuse across resumes, answers, and interview prep."
        actions={
          <Button onClick={openCreate}>
            <PlusIcon className="size-3.5" /> New accomplishment
          </Button>
        }
      />

      {isLoading ? <Skeleton className="h-96" /> : null}
      {error ? (
        <ResourceError
          label="accomplishments"
          error={error}
          onRetry={refetch}
        />
      ) : null}
      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState
          icon={AwardIcon}
          headline="No accomplishments yet"
          body="Capture your best quantified wins once, then pull them into any resume or answer."
          cta={{ label: "New accomplishment", onClick: openCreate }}
        />
      ) : null}

      {!isLoading && !error && rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((a) => (
            <Card key={a.id} className="flex flex-col gap-2 p-[18px]">
              <div className="flex items-start gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">{a.title}</span>
                    {a.source ? (
                      <Badge variant="info">From project</Badge>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${a.title}`}
                  className="ml-auto text-[var(--fg-subtle)] hover:text-[var(--danger)]"
                  onClick={() => remove(a)}
                  disabled={isMutating}
                >
                  <Trash2Icon className="size-4" />
                </button>
              </div>
              <p className="m-0 text-[12.5px] text-[var(--fg-muted)]">
                {a.summary}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                  Edit
                </Button>
                {a.usedIn > 0 ? (
                  <span
                    className="text-[11px] text-[var(--fg-subtle)]"
                    title="Times this accomplishment has been pulled into a resume or answer"
                  >
                    Reused {a.usedIn}x
                  </span>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit accomplishment" : "New accomplishment"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <FormField label="Title" required>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Cut ingest p99 by 87%"
              />
            </FormField>
            <FormField label="Summary">
              <Textarea
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                rows={3}
              />
            </FormField>
            <FormField label="Tags" helper="Comma-separated">
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="performance, distributed-systems"
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={isMutating}>
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppFrame>
  )
}
