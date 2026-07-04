/**
 * Integrations panel for the Settings screen. Edits `integrations`
 * slice of `Settings`. Matches `settings.jsx::SetIntegrations`:
 * stacked rows with icon tile + name/description + per-row Connect /
 * Disconnect actions. The connect state toggles locally.
 */

import {
  BriefcaseIcon,
  CalendarIcon,
  LinkIcon,
  MailIcon,
  NotebookTextIcon,
  PlugIcon,
  WorkflowIcon,
} from "lucide-react"
import type * as React from "react"

import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Card } from "@/components/ui/card-eb"
import type { IntegrationRow } from "@/data/types"

import { SectionHeading } from "./section-heading"

export interface IntegrationsPanelProps {
  value: readonly IntegrationRow[]
  onChange: (next: readonly IntegrationRow[]) => void
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  mail: MailIcon,
  calendar: CalendarIcon,
  linkedin: BriefcaseIcon,
  workflow: WorkflowIcon,
  "link-2": LinkIcon,
  "notebook-text": NotebookTextIcon,
}

export function IntegrationsPanel({ value, onChange }: IntegrationsPanelProps) {
  const toggleConnected = (index: number) => {
    const row = value[index]
    if (row.state === "auto") {
      return
    }
    const nextState: IntegrationRow["state"] =
      row.state === "connected" ? "not-connected" : "connected"
    const next = value.map((integrationRow, rowIndex) =>
      rowIndex === index
        ? { ...integrationRow, state: nextState }
        : integrationRow,
    )
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Integrations"
        subtitle="Employa-Bot reads from these services. Read-only Gmail — we never send mail without you clicking."
      />
      <Card className="p-0">
        {value.map((integrationRow, rowIndex) => {
          const Icon = ICONS[integrationRow.icon] ?? PlugIcon
          return (
            <div
              key={integrationRow.name}
              data-testid={`integration-row-${integrationRow.name}`}
              className="flex items-center gap-3.5 px-5 py-4 [&+&]:border-t [&+&]:border-border"
            >
              <div className="grid size-10 place-items-center rounded-[var(--radius-md)] border border-border bg-[var(--bg-subtle)]">
                <Icon className="size-[18px]" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">
                  {integrationRow.name}
                </div>
                <div className="text-[12.5px] text-[var(--fg-muted)]">
                  {integrationRow.description}
                </div>
                {integrationRow.account ? (
                  <div className="mt-0.5 font-mono text-[11px] text-[var(--fg-subtle)]">
                    {integrationRow.account} · last sync{" "}
                    {integrationRow.lastSync ?? "—"}
                  </div>
                ) : null}
              </div>
              {integrationRow.state === "connected" ? (
                <>
                  <Badge variant="success">connected</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleConnected(rowIndex)}
                    aria-label={`Disconnect ${integrationRow.name}`}
                  >
                    Disconnect
                  </Button>
                </>
              ) : null}
              {integrationRow.state === "not-connected" ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => toggleConnected(rowIndex)}
                  aria-label={`Connect ${integrationRow.name}`}
                >
                  Connect
                </Button>
              ) : null}
              {integrationRow.state === "auto" ? (
                <Badge>auto · no auth</Badge>
              ) : null}
            </div>
          )
        })}
      </Card>
    </div>
  )
}
