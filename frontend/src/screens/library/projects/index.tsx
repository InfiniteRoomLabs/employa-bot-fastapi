/**
 * Projects (PRJ-001). Per-employer brain-dumps -- the raw evidence reservoir
 * that feeds resumes, accomplishments, and answers. Group-by-employer (PRJ-002)
 * is Post-MVP; this lists projects with their employer shown.
 */

import { FolderGit2Icon, PlusIcon, Trash2Icon } from "lucide-react"
import * as React from "react"
import { EmptyState } from "@/components/atoms/empty-state"
import { FormField } from "@/components/atoms/form-field"
import { ResourceError } from "@/components/atoms/resource-error"
import { DeleteConfirmDialog } from "@/components/domain/delete-confirm-dialog"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
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
import type { Project } from "@/data/types"
import { useLibraryMutations, useProjects } from "@/hooks"

interface FormState {
  title: string
  employer: string
  body: string
  tags: string
}

const EMPTY: FormState = { title: "", employer: "", body: "", tags: "" }

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

export default function ProjectsScreen() {
  const { data, isLoading, error, refetch } = useProjects()
  const { createProject, updateProject, deleteProject, isMutating } =
    useLibraryMutations()

  const [editing, setEditing] = React.useState<Project | null>(null)
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  const openEdit = (p: Project) => {
    setEditing(p)
    setForm({
      title: p.title,
      employer: p.employer,
      body: p.body,
      tags: p.tags.join(", "),
    })
    setOpen(true)
  }

  const save = async () => {
    if (form.title.trim().length === 0) {
      toast.warn({ title: "Title is required" })
      return
    }
    const payload = {
      title: form.title,
      employer: form.employer,
      body: form.body,
      tags: parseTags(form.tags),
    }
    try {
      if (editing) {
        await updateProject(editing.id, payload)
        toast.success({ title: "Project updated" })
      } else {
        await createProject(payload)
        toast.success({ title: "Project added" })
      }
      setOpen(false)
      refetch()
    } catch {
      toast.error({ title: "Could not save project" })
    }
  }

  // D24: deleting a project is soft + goes through a dependent-count confirm.
  const [deleteTarget, setDeleteTarget] = React.useState<Project | null>(null)

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return
    }
    const p = deleteTarget
    setDeleteTarget(null)
    try {
      await deleteProject(p.id)
      toast.success({
        title: "Moved to trash",
        sub: `${p.title} -- restore it from Library > Trash.`,
      })
      refetch()
    } catch {
      toast.error({ title: "Could not delete", sub: "Please try again." })
    }
  }

  const rows = data ?? []

  return (
    <AppFrame
      active="projects"
      title="Projects"
      subtitle={`${rows.length} projects`}
    >
      <PageHead
        eyebrow="Library"
        title="Projects"
        lede="Brain-dump the projects you worked on, by employer. Raw material you distill into accomplishments and resume bullets."
        actions={
          <Button onClick={openCreate}>
            <PlusIcon className="size-3.5" /> New project
          </Button>
        }
      />

      {isLoading ? <Skeleton className="h-96" /> : null}
      {error ? (
        <ResourceError label="projects" error={error} onRetry={refetch} />
      ) : null}
      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState
          icon={FolderGit2Icon}
          headline="No projects yet"
          body="Capture the messy details now -- they become resume bullets and STAR stories later."
          cta={{ label: "New project", onClick: openCreate }}
        />
      ) : null}

      {!isLoading && !error && rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((p) => (
            <Card key={p.id} className="flex flex-col gap-2 p-[18px]">
              <div className="flex items-start gap-2">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold">{p.title}</div>
                  <div className="text-[12.5px] text-[var(--fg-muted)]">
                    {p.employer}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${p.title}`}
                  className="ml-auto text-[var(--fg-subtle)] hover:text-[var(--danger)]"
                  onClick={() => setDeleteTarget(p)}
                  disabled={isMutating}
                >
                  <Trash2Icon className="size-4" />
                </button>
              </div>
              <p className="m-0 line-clamp-3 text-[12.5px] text-[var(--fg-muted)]">
                {p.body}
              </p>
              <div className="pt-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
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
            <DialogTitle>
              {editing ? "Edit project" : "New project"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Title" required>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </FormField>
              <FormField label="Employer">
                <Input
                  value={form.employer}
                  onChange={(e) =>
                    setForm({ ...form, employer: e.target.value })
                  }
                />
              </FormField>
            </div>
            <FormField label="Brain-dump">
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={5}
              />
            </FormField>
            <FormField label="Tags" helper="Comma-separated">
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
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

      {/* D24: soft-delete confirm with dependent-count drill-down */}
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        kind="project"
        id={deleteTarget?.id ?? ""}
        label={deleteTarget?.title ?? ""}
        onConfirm={confirmDelete}
        busy={isMutating}
      />
    </AppFrame>
  )
}
