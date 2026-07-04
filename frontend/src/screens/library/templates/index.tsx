/**
 * Templates (TPL-001). Browse the resume layout templates a projection can
 * render through. Assigning a template happens from the resume builder
 * (TPL-002, RES-037). The template EDITOR (TPL-003) is Post-MVP -- a fork of an
 * OSS block editor -- so it shows as a clearly-labeled stub here.
 */

import { LayoutTemplateIcon } from "lucide-react"
import { EmptyState } from "@/components/atoms/empty-state"
import { ResourceError } from "@/components/atoms/resource-error"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Badge } from "@/components/ui/badge-eb"
import { Card } from "@/components/ui/card-eb"
import { Skeleton } from "@/components/ui/skeleton"
import { useResumeTemplates } from "@/hooks"

export default function TemplatesScreen() {
  const { data, isLoading, error, refetch } = useResumeTemplates()
  const rows = data ?? []

  return (
    <AppFrame
      active="templates"
      title="Templates"
      subtitle={`${rows.length} layouts`}
    >
      <PageHead
        eyebrow="Library"
        title="Templates"
        lede="The layouts your resumes render through. Pick one when you export a resume; the content stays the same."
      />

      {isLoading ? <Skeleton className="h-72" /> : null}
      {error ? (
        <ResourceError label="templates" error={error} onRetry={refetch} />
      ) : null}
      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState icon={LayoutTemplateIcon} headline="No templates yet" />
      ) : null}

      {!isLoading && !error && rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <Card key={t.id} className="flex flex-col gap-3 p-[18px]">
              <div
                aria-hidden
                className="flex h-32 items-center justify-center rounded-md border border-dashed border-border bg-[var(--bg-subtle)] text-[11px] uppercase tracking-wide text-[var(--fg-subtle)]"
              >
                {t.previewKind} preview
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold">{t.name}</span>
              </div>
              <p className="m-0 text-[12.5px] text-[var(--fg-muted)]">
                {t.description}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        <Card variant="tight" className="flex items-center gap-3">
          <Badge variant="info">Coming soon</Badge>
          <span className="text-[12.5px] text-[var(--fg-muted)]">
            A visual template editor (build a layout from blocks) is planned.
            For now, choose from the templates above when exporting a resume.
          </span>
        </Card>
      </div>
    </AppFrame>
  )
}
