/**
 * Answers (ANS-001). Saved responses to recurring application questions so the
 * user stops rewriting them. Reuse-while-applying (ANS-002) is Post-MVP.
 */

import { MessageCircleQuestionIcon, PlusIcon, Trash2Icon } from "lucide-react"
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
import type { Answer, AnswerCategory } from "@/data/types"
import { useAnswers, useLibraryMutations } from "@/hooks"

const CATEGORIES: readonly { value: AnswerCategory; label: string }[] = [
  { value: "compensation", label: "Compensation" },
  { value: "motivation", label: "Motivation" },
  { value: "work-authorization", label: "Work authorization" },
  { value: "logistics", label: "Logistics" },
  { value: "eeo", label: "EEO" },
  { value: "other", label: "Other" },
]

interface FormState {
  question: string
  body: string
  category: AnswerCategory
}

const EMPTY: FormState = { question: "", body: "", category: "other" }

export default function AnswersScreen() {
  const { data, isLoading, error, refetch } = useAnswers()
  const { createAnswer, updateAnswer, deleteAnswer, isMutating } =
    useLibraryMutations()

  const [editing, setEditing] = React.useState<Answer | null>(null)
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  const openEdit = (a: Answer) => {
    setEditing(a)
    setForm({ question: a.question, body: a.body, category: a.category })
    setOpen(true)
  }

  const save = async () => {
    if (form.question.trim().length === 0) {
      toast.warn({ title: "Question is required" })
      return
    }
    const payload = { ...form, tags: [] as string[] }
    try {
      if (editing) {
        await updateAnswer(editing.id, payload)
        toast.success({ title: "Answer updated" })
      } else {
        await createAnswer(payload)
        toast.success({ title: "Answer saved" })
      }
      setOpen(false)
      refetch()
    } catch {
      toast.error({ title: "Could not save answer" })
    }
  }

  const remove = async (a: Answer) => {
    try {
      await deleteAnswer(a.id)
      toast.success({ title: "Answer removed" })
      refetch()
    } catch {
      toast.error({ title: "Could not remove answer" })
    }
  }

  const rows = data ?? []
  const labelFor = (c: AnswerCategory) =>
    CATEGORIES.find((x) => x.value === c)?.label ?? c

  return (
    <AppFrame
      active="answers"
      title="Answers"
      subtitle={`${rows.length} saved`}
    >
      <PageHead
        eyebrow="Library"
        title="Answers"
        lede="Your answers to the questions every application asks -- salary, why-us, work authorization, notice period."
        actions={
          <Button onClick={openCreate}>
            <PlusIcon className="size-3.5" /> New answer
          </Button>
        }
      />

      {isLoading ? <Skeleton className="h-96" /> : null}
      {error ? (
        <ResourceError label="answers" error={error} onRetry={refetch} />
      ) : null}
      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState
          icon={MessageCircleQuestionIcon}
          headline="No saved answers yet"
          body="Write each recurring answer once, then reuse it instead of retyping."
          cta={{ label: "New answer", onClick: openCreate }}
        />
      ) : null}

      {!isLoading && !error && rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((a) => (
            <Card key={a.id} className="flex h-full flex-col gap-2 p-[18px]">
              <div className="flex items-start gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">
                      {a.question}
                    </span>
                    <Badge variant="info">{labelFor(a.category)}</Badge>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove answer`}
                  className="ml-auto text-[var(--fg-subtle)] hover:text-[var(--danger)]"
                  onClick={() => remove(a)}
                  disabled={isMutating}
                >
                  <Trash2Icon className="size-4" />
                </button>
              </div>
              <p className="m-0 line-clamp-4 text-[12.5px] text-[var(--fg-muted)]">
                {a.body}
              </p>
              <div className="mt-auto pt-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit answer" : "New answer"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <FormField label="Question" required>
              <Input
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="What are your compensation expectations?"
              />
            </FormField>
            <FormField label="Category">
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as AnswerCategory,
                  })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Answer">
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={4}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={isMutating}>
              {editing ? "Save" : "Save answer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppFrame>
  )
}
