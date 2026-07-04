/**
 * Resumes -- the resume lifecycle, segmented (RES-030..037).
 *
 *   Uploads (immutable originals) -> Masters & variants (projections over
 *   career history) -> Exports (rendered, regenerable files).
 *
 * A "resume" is three things across this lifecycle; this screen makes the
 * stages and their provenance legible. UI copy never says "corpus" -- it is
 * "career history". See docs/product/story-map/stories/10-library.md.
 */

import {
  DownloadIcon,
  FileIcon,
  FileTextIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import * as React from "react"
import { useNavigate } from "react-router-dom"
import { EmptyState } from "@/components/atoms/empty-state"
import { FormField } from "@/components/atoms/form-field"
import { ResourceError } from "@/components/atoms/resource-error"
import { ResumeCard } from "@/components/domain/resume-card"
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
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import type { Resume } from "@/data/types"
import {
  useCareerHistory,
  useProjections,
  useResumeExports,
  useResumeLifecycleMutations,
  useResumeMutations,
  useResumeScoring,
  useResumeTemplates,
  useResumeUploads,
} from "@/hooks"

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em]">
          {title}
        </h2>
        <span className="text-[12px] text-[var(--fg-subtle)]">{hint}</span>
      </div>
      {children}
    </section>
  )
}

export default function ResumesScreen() {
  const navigate = useNavigate()
  const uploads = useResumeUploads()
  const projections = useProjections()
  const exports = useResumeExports()
  const templates = useResumeTemplates()
  const history = useCareerHistory()
  const { duplicateResume, deleteResume } = useResumeMutations()
  const { setScoring } = useResumeScoring()
  const { createProjection, renderExport, regenerateExport, isMutating } =
    useResumeLifecycleMutations()

  const [builderOpen, setBuilderOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [targetRole, setTargetRole] = React.useState("")
  const [templateId, setTemplateId] = React.useState("")
  const [included, setIncluded] = React.useState<Set<string>>(new Set())

  const templateName = (id: string | undefined) =>
    templates.data?.find((t) => t.id === id)?.name ?? "Classic"
  const uploadName = (id: string | undefined) =>
    uploads.data?.find((u) => u.id === id)?.filename ?? "an upload"
  const projectionName = (id: string) =>
    projections.data?.find((p) => p.id === id)?.name ?? "a resume"

  const openBuilder = () => {
    setName("")
    setTargetRole("")
    setTemplateId(templates.data?.[0]?.id ?? "")
    setIncluded(new Set(history.data?.map((h) => h.id) ?? []))
    setBuilderOpen(true)
  }

  const toggleItem = (id: string) => {
    setIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const createMaster = async () => {
    if (name.trim().length === 0) {
      toast.warn({ title: "Give the resume a name" })
      return
    }
    try {
      await createProjection({
        name,
        targetRole: targetRole || undefined,
        itemIds: [...included],
        templateId: templateId || undefined,
      })
      toast.success({
        title: "Master created",
        sub: "Pinned to the items you selected -- adding career history later will not change it.",
      })
      setBuilderOpen(false)
      projections.refetch()
    } catch {
      toast.error({ title: "Could not create resume" })
    }
  }

  const onExport = async (p: Resume) => {
    try {
      await renderExport(p.id)
      toast.success({
        title: "Export rendered",
        sub: "Find it under Exports below.",
      })
      exports.refetch()
    } catch {
      toast.error({ title: "Could not export" })
    }
  }

  const onDuplicate = async (p: Resume) => {
    try {
      await duplicateResume(p.id)
      toast.success({ title: "Duplicated" })
      projections.refetch()
    } catch {
      toast.error({ title: "Could not duplicate" })
    }
  }

  const onDelete = async (p: Resume) => {
    try {
      await deleteResume(p.id)
      toast.success({ title: "Deleted" })
      projections.refetch()
    } catch {
      toast.error({
        title: "Cannot delete",
        sub: "Locked or in-use resumes cannot be deleted.",
      })
    }
  }

  const onRegenerate = async (id: string) => {
    try {
      await regenerateExport(id)
      toast.success({
        title: "Regenerated",
        sub: "New export created; the old one keeps its version.",
      })
      exports.refetch()
    } catch {
      toast.error({ title: "Could not regenerate" })
    }
  }

  // D21: toggle whether a master participates in match scoring.
  const onScoring = async (id: string, enabled: boolean) => {
    try {
      await setScoring(id, enabled)
      projections.refetch()
    } catch {
      toast.error({ title: "Could not update scoring" })
    }
  }

  const anyLoading =
    uploads.isLoading || projections.isLoading || exports.isLoading

  return (
    <AppFrame
      active="resumes"
      title="Resumes"
      subtitle={`${projections.data?.length ?? 0} masters`}
    >
      <PageHead
        eyebrow="Library"
        title="Resumes"
        lede="Your uploaded originals, the masters you shape from your career history, and the files you export. Originals are never overwritten."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/onboarding")}>
              Upload resume
            </Button>
            <Button onClick={openBuilder} disabled={isMutating}>
              <PlusIcon className="size-3.5" /> New master
            </Button>
          </>
        }
      />

      {anyLoading ? <Skeleton className="h-96" /> : null}
      {projections.error ? (
        <ResourceError
          label="resumes"
          error={projections.error}
          onRetry={projections.refetch}
        />
      ) : null}

      {!anyLoading && !projections.error ? (
        <>
          {/* Uploads -- immutable originals (RES-030) */}
          <Section
            title="Uploads"
            hint="Your original files. Never overwritten."
          >
            {(uploads.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={FileIcon}
                headline="No uploads yet"
                body="Upload a resume during onboarding to seed your career history."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {uploads.data?.map((u) => (
                  <Card key={u.id} className="flex flex-col gap-2 p-[18px]">
                    <div className="flex items-center gap-2">
                      <FileIcon
                        className="size-4 text-[var(--fg-muted)]"
                        aria-hidden
                      />
                      <span className="truncate text-[14px] font-semibold">
                        {u.filename}
                      </span>
                      {u.parsed ? (
                        <Badge variant="success">Parsed</Badge>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-[var(--fg-subtle)]">
                      uploaded {u.uploadedAt} - {Math.round(u.sizeBytes / 1024)}{" "}
                      KB
                    </div>
                    <div className="mt-auto flex gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toast.default({
                            title: "Original is preserved (demo)",
                          })
                        }
                      >
                        View original
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toast.default({ title: "Re-parse queued (demo)" })
                        }
                      >
                        Re-parse
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Section>

          {/* Masters & variants -- projections (RES-034) */}
          <Section
            title="Masters & variants"
            hint="Projections over your career history."
          >
            {(projections.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={FileTextIcon}
                headline="No masters yet"
                body="Create a master resume by selecting which career-history items to include."
                cta={{ label: "New master", onClick: openBuilder }}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {projections.data?.map((p) => (
                  <div key={p.id} className="flex flex-col gap-1.5">
                    <ResumeCard
                      resume={p}
                      onSelect={() => navigate(`/resume/${p.id}`)}
                    />
                    {p.sourceUploadId ? (
                      <div className="text-[11px] text-[var(--fg-subtle)]">
                        from {uploadName(p.sourceUploadId)}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/resume/${p.id}`)}
                      >
                        Open builder
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onExport(p)}
                        disabled={isMutating}
                      >
                        Export
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDuplicate(p)}
                      >
                        Duplicate
                      </Button>
                      <button
                        type="button"
                        aria-label={`Delete ${p.name}`}
                        className="ml-auto text-[var(--fg-subtle)] hover:text-[var(--danger)]"
                        onClick={() => onDelete(p)}
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    </div>
                    {/* D21: master-only scoring toggle (eligibility = masters). */}
                    {p.tag === "MASTER" ? (
                      <label className="flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                        <Switch
                          checked={p.scoringEnabled !== false}
                          onCheckedChange={(checked) =>
                            onScoring(p.id, checked)
                          }
                          aria-label={`Use ${p.name} for match scoring`}
                        />
                        <span>Scored for matches</span>
                      </label>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Exports -- rendered, regenerable (RES-037) */}
          <Section
            title="Exports"
            hint="Rendered files. One-way -- regenerate to refresh."
          >
            {(exports.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={DownloadIcon}
                headline="No exports yet"
                body="Export a master through a template to produce a downloadable file."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {exports.data?.map((e) => (
                  <Card key={e.id} className="flex flex-col gap-2 p-[18px]">
                    <div className="flex items-center gap-2">
                      <DownloadIcon
                        className="size-4 text-[var(--fg-muted)]"
                        aria-hidden
                      />
                      <span className="truncate text-[14px] font-semibold">
                        {e.filename}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--fg-subtle)]">
                      generated {e.generatedAt} - template {e.templateVersion}
                    </div>
                    <div className="text-[11px] text-[var(--fg-subtle)]">
                      from {projectionName(e.projectionId)} +{" "}
                      {templateName(e.templateId)}
                    </div>
                    <div className="mt-auto flex gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toast.default({ title: "Download started (demo)" })
                        }
                      >
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRegenerate(e.id)}
                        disabled={isMutating}
                      >
                        <RefreshCwIcon className="size-3.5" /> Regenerate
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Section>

          <p className="text-[12px] text-[var(--fg-subtle)]">
            Looking for layouts? Manage them under{" "}
            <a className="underline" href="/library/templates">
              Templates
            </a>
            .
          </p>
        </>
      ) : null}

      {/* Builder: pick career-history items + name + target + template (RES-034/035) */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New master</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Name" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Backend / DevOps"
                />
              </FormField>
              <FormField label="Target role">
                <Input
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="Staff Engineer"
                />
              </FormField>
            </div>
            <FormField label="Template">
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {templates.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Include from career history"
              helper="Pinned -- new history will not auto-add."
            >
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
                {history.data?.map((h) => (
                  <label
                    key={h.id}
                    className="flex items-center gap-2 text-[13px]"
                  >
                    <input
                      type="checkbox"
                      checked={included.has(h.id)}
                      onChange={() => toggleItem(h.id)}
                    />
                    <span className="font-medium">{h.title}</span>
                    {h.org ? (
                      <span className="text-[var(--fg-subtle)]">- {h.org}</span>
                    ) : null}
                  </label>
                ))}
              </div>
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBuilderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createMaster} disabled={isMutating}>
              Create master
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppFrame>
  )
}
