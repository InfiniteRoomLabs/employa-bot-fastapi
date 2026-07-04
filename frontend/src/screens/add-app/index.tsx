/**
 * Add application - 2-step wizard. Method choice, then review.
 *
 * Picker id: `add-app`
 * Route path: `/applications/new` (Phase 9)
 */

import {
  ArrowRightIcon,
  CheckIcon,
  ClipboardPasteIcon,
  DownloadIcon,
  Link2Icon,
  PuzzleIcon,
} from "lucide-react"
import * as React from "react"

import { useNavigate } from "react-router-dom"
import { AppFrame } from "@/components/shell/app-frame"
import { Button } from "@/components/ui/button-eb"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useCreateApplication } from "@/hooks"

function Stepper({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-7 flex items-center gap-3.5">
      {(["Capture", "Review & save"] as const).map((label, i) => {
        const n = (i + 1) as 1 | 2
        const active = step === n
        const done = step > n
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2.5">
              <div
                className={
                  "grid size-7 place-items-center rounded-full border text-xs font-semibold " +
                  (done
                    ? "border-transparent bg-[var(--accent)] text-[var(--fg-on-accent)]"
                    : active
                      ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]"
                      : "border-border bg-[var(--bg-subtle)] text-[var(--fg-subtle)]")
                }
              >
                {done ? <CheckIcon className="size-3" /> : n}
              </div>
              <span
                className={
                  "text-sm " +
                  (active
                    ? "font-semibold"
                    : "font-medium text-[var(--fg-muted)]")
                }
              >
                {label}
              </span>
            </div>
            {i === 0 ? (
              <div className="h-px max-w-56 flex-1 border-t border-dashed border-border" />
            ) : null}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function StepCapture({ onNext }: { onNext: () => void }) {
  return (
    <>
      <h1 className="m-0 mb-2 display text-[32px] font-normal leading-[1.1]">
        How would you like to add this job?
      </h1>
      <p className="mb-6 max-w-[560px] text-sm text-[var(--fg-muted)]">
        Three ways - pick whichever's easiest. Pasting a URL is most accurate.
        The extension is fastest.
      </p>

      <div className="card mb-3 p-5">
        <div className="mb-3.5 flex items-start gap-3.5">
          <div className="grid size-9 place-items-center rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--fg-on-accent)]">
            <Link2Icon className="size-4" />
          </div>
          <div className="flex-1">
            <h3 className="m-0 mb-1 text-[15px] font-semibold">Paste a URL</h3>
            <div className="text-[13px] text-[var(--fg-muted)]">
              We'll scrape the posting. Works best with Greenhouse, Lever,
              Ashby, Workable, and most Workday-hosted career pages.
            </div>
          </div>
        </div>
        <div className="relative">
          <Input
            placeholder="https://boards.greenhouse.io/stripe/jobs/..."
            className="pr-28 font-mono text-[12.5px]"
          />
          <Button
            variant="default"
            size="sm"
            className="absolute right-1 top-1"
            onClick={onNext}
          >
            Fetch <ArrowRightIcon className="size-3" />
          </Button>
        </div>
      </div>

      <div className="card mb-3 p-5">
        <div className="mb-3.5 flex items-start gap-3.5">
          <div className="grid size-9 place-items-center rounded-[var(--radius-md)] border border-border bg-[var(--bg-subtle)]">
            <ClipboardPasteIcon className="size-4" />
          </div>
          <div className="flex-1">
            <h3 className="m-0 mb-1 text-[15px] font-semibold">
              Paste JD text
            </h3>
            <div className="text-[13px] text-[var(--fg-muted)]">
              For union-hall boards, Indeed postings, or anything we can't
              scrape - paste the full text and we'll parse it.
            </div>
          </div>
        </div>
        <Textarea rows={4} placeholder="Paste job description here..." />
        <Button
          variant="secondary"
          size="sm"
          className="mt-2.5"
          onClick={onNext}
        >
          Parse & continue
        </Button>
      </div>

      <div className="card border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] p-5">
        <div className="flex items-center gap-3.5">
          <div className="grid size-9 place-items-center rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)]">
            <PuzzleIcon className="size-4" />
          </div>
          <div className="flex-1">
            <h3 className="m-0 mb-1 text-[15px] font-semibold">
              Capture with the extension
            </h3>
            <div className="text-[13px] text-[var(--fg-muted)]">
              One-click save from any job posting page.{" "}
              <b className="text-[var(--accent-text)]">
                You don't have it installed yet.
              </b>
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() =>
              toast.default({
                title: "Extension install is mocked",
                sub: "In the real product this opens the Chrome Web Store listing.",
              })
            }
          >
            <DownloadIcon className="size-3" /> Install
          </Button>
        </div>
      </div>
    </>
  )
}

function StepReview({
  onBack,
  onSave,
  saving,
}: {
  onBack: () => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <div className="card p-6">
      <h2 className="m-0 mb-2 text-2xl font-semibold">
        Staff Engineer, Payments core
      </h2>
      <div className="mb-4 text-sm text-[var(--fg-muted)]">
        Stripe - Remote - US
      </div>
      <div className="font-mono text-[12.5px] text-[var(--fg-subtle)]">
        $255-305k - full-time - greenhouse.io
      </div>
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button variant="default" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save & open"}
        </Button>
      </div>
    </div>
  )
}

export default function AddAppScreen() {
  const [step, setStep] = React.useState<1 | 2>(1)
  const navigate = useNavigate()
  const { createApplication, isCreating } = useCreateApplication()

  async function handleSave() {
    try {
      // Mock: the review step shows a fixed parsed posting; persist it as a draft.
      const createdApplication = await createApplication({
        company: "Stripe",
        role: "Staff Engineer, Payments core",
        stageLabel: "drafting",
        location: "Remote - US",
        salary: { min: 255000, max: 305000, extra: [] },
        resume: "No resume selected yet",
        match: 0,
        days: 0,
        source: "greenhouse",
      })
      toast.success({
        title: "Added to your pipeline",
        sub: `${createdApplication.company} - ${createdApplication.role} saved as a draft.`,
      })
      navigate(`/applications/${createdApplication.id}`)
    } catch {
      toast.error({
        title: "Couldn't save that application",
        sub: "Try again in a moment.",
      })
    }
  }

  return (
    <AppFrame active="add-app" title="Add application" subtitle="">
      <div className="mx-auto max-w-[820px]">
        <Stepper step={step} />
        {step === 1 ? (
          <StepCapture onNext={() => setStep(2)} />
        ) : (
          <StepReview
            onBack={() => setStep(1)}
            onSave={handleSave}
            saving={isCreating}
          />
        )}
      </div>
    </AppFrame>
  )
}
