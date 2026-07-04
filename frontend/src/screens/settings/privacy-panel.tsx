/**
 * Privacy panel for the Settings screen.
 *
 * AUTH-031: Last-updated timestamp, per-toggle consequence copy (chat-logs
 * toggle shows purge warning when OFF), and the full dirty-check wiring.
 *
 * AUTH-022: Stateful data-export job machine.
 *   idle -> in-progress (3-second simulated delay) -> ready -> expired
 *   All state is local and independent of the Settings form dirty-check.
 */

import { CheckIcon, DownloadIcon, Loader2Icon, Trash2Icon } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button-eb"
import { Card } from "@/components/ui/card-eb"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import type { PrivacyToggle } from "@/data/types"

import { SectionHeading } from "./section-heading"

// ---------------------------------------------------------------------------
// Export job state machine (AUTH-022)
// ---------------------------------------------------------------------------

type ExportJobState = "idle" | "in-progress" | "ready" | "expired"

function useExportJob() {
  const [state, setState] = React.useState<ExportJobState>("idle")

  // When we enter in-progress, simulate a 3-second async job then move to ready.
  React.useEffect(() => {
    if (state !== "in-progress") {
      return
    }
    const timer = setTimeout(() => {
      setState("ready")
    }, 3000)
    return () => clearTimeout(timer)
  }, [state])

  const startExport = () => {
    if (state === "in-progress") {
      toast.default({
        title: "Export already in progress",
        sub: "Check your email — we will notify you when the file is ready.",
      })
      return
    }
    setState("in-progress")
    toast.default({
      title: "Export started",
      sub: "We will email you when it is ready. (~3 seconds in demo)",
    })
  }

  const download = () => {
    if (state !== "ready") {
      return
    }
    toast.success({
      title: "Export downloaded",
      sub: "Demo only -- no file was generated.",
    })
    // Simulates consuming the 48-hour download window.
    setState("expired")
  }

  const reset = () => setState("idle")

  return { state, startExport, download, reset }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PrivacyPanelProps {
  value: readonly PrivacyToggle[]
  onChange: (next: readonly PrivacyToggle[]) => void
  /** ISO-ish date string, e.g. 'May 15, 2026'. */
  privacyLastUpdated?: string
}

// The index of the "Keep chat logs after 30 days" toggle in the fixture.
// We identify it by title text to be robust against fixture reordering.
const CHAT_LOGS_TITLE = "Keep chat logs after 30 days"

export function PrivacyPanel({
  value,
  onChange,
  privacyLastUpdated,
}: PrivacyPanelProps) {
  const exportJob = useExportJob()

  const setToggleAt = (targetIndex: number, on: boolean) => {
    onChange(
      value.map((row, index) => (index === targetIndex ? { ...row, on } : row)),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Privacy & data"
        subtitle="What we store, what we share, how to get it all back."
      />

      {/* AUTH-031: last-updated timestamp */}
      {privacyLastUpdated ? (
        <p className="text-[12px] text-[var(--fg-subtle)]">
          Last updated: {privacyLastUpdated}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {value.map((row, i) => {
          const switchId = `privacy-toggle-${i}`
          const isChatLogs = row.title === CHAT_LOGS_TITLE
          // AUTH-031: show consequence copy when the chat-logs toggle is OFF
          const showConsequence = isChatLogs && !row.on

          return (
            <Card key={row.title} className="flex flex-col gap-0 p-4">
              <div className="flex flex-row items-center gap-3">
                <div className="flex-1">
                  <label
                    htmlFor={switchId}
                    className="block text-sm font-semibold"
                  >
                    {row.title}
                  </label>
                  <div className="text-[12.5px] text-[var(--fg-muted)]">
                    {row.description}
                  </div>
                </div>
                <Switch
                  id={switchId}
                  checked={row.on}
                  onCheckedChange={(checked) => setToggleAt(i, checked)}
                  aria-label={row.title}
                />
              </div>
              {/* AUTH-031: consequence note for chat-logs toggle */}
              {showConsequence ? (
                <p className="mt-2 text-[12px] text-[var(--warn-text)]">
                  Threads older than 30 days would be purged.
                </p>
              ) : null}
            </Card>
          )
        })}
      </div>

      {/* Your data card */}
      <Card className="p-5">
        <h3 className="mb-2 text-sm font-semibold">Your data</h3>
        <div className="flex flex-col gap-3">
          {/* AUTH-022: stateful export job */}
          <ExportJobRow exportJob={exportJob} />

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              icon={<Trash2Icon />}
              onClick={() =>
                toast.warn({
                  title: "Purge coach history",
                  sub: "Demo only -- no data removed.",
                })
              }
            >
              Purge coach history
            </Button>
            <span className="text-xs text-[var(--fg-muted)]">
              keeps applications, removes chat
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExportJobRow -- renders state-specific UI for the data export flow
// ---------------------------------------------------------------------------

interface ExportJobRowProps {
  exportJob: ReturnType<typeof useExportJob>
}

function ExportJobRow({ exportJob }: ExportJobRowProps) {
  const { state, startExport, download, reset } = exportJob

  if (state === "idle") {
    return (
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          icon={<DownloadIcon />}
          onClick={startExport}
        >
          Download all my data (.zip)
        </Button>
        <span className="text-xs text-[var(--fg-muted)]">
          resumes, applications, coach threads, timeline, match scores
        </span>
      </div>
    )
  }

  if (state === "in-progress") {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-[var(--bg-subtle)] px-3 py-2">
        <Loader2Icon
          className="size-4 animate-spin text-[var(--fg-muted)]"
          aria-hidden
        />
        <span className="text-[13px] text-[var(--fg-muted)]">
          Export in progress -- check your email when it is ready.
        </span>
      </div>
    )
  }

  if (state === "ready") {
    return (
      <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--success)] bg-[var(--success-soft,hsl(140_60%_97%))] px-3 py-3">
        <div className="flex items-center gap-2">
          <CheckIcon
            className="size-4 text-[var(--success-text,hsl(140_40%_35%))]"
            aria-hidden
          />
          <span className="text-[13px] font-semibold text-[var(--success-text,hsl(140_40%_35%))]">
            Ready -- valid for 48 hours
          </span>
        </div>
        <p className="text-[12px] text-[var(--fg-muted)]">
          Archive includes: resumes, applications, coach threads, timeline, and
          match scores.
        </p>
        <Button
          variant="secondary"
          size="sm"
          icon={<DownloadIcon />}
          onClick={download}
        >
          Download (.zip)
        </Button>
      </div>
    )
  }

  // expired
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-[var(--bg-subtle)] px-3 py-3">
      <p className="text-[13px] text-[var(--fg-muted)]">
        This export link expired -- request a new one.
      </p>
      <Button
        variant="secondary"
        size="sm"
        icon={<DownloadIcon />}
        onClick={reset}
      >
        Request new export
      </Button>
    </div>
  )
}
