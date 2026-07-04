/**
 * Onboarding wizard - guided, skip-anywhere setup flow (founder-approved 2026-06-01).
 *
 * Picker id: `onboarding`
 * Route path: `/onboarding` (Phase 9)
 *
 * A small state machine that forks on "Got a resume handy?":
 *   Branch A (has resume): Welcome -> Resume upload -> Confirm profile -> Confirm search -> Power-ups -> Done
 *   Branch B (no resume):  Welcome -> Light profile -> First search -> Resume options -> Power-ups -> Done
 * Both branches converge on the Power-ups step. State is local-only (mockup);
 * nothing persists across reload.
 */

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ClipboardIcon,
  ClockIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileUpIcon,
  KeyRoundIcon,
  MailIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  PuzzleIcon,
  RefreshCwIcon,
  SirenIcon,
  TargetIcon,
} from "lucide-react"
import * as React from "react"
import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Chip } from "@/components/ui/chip"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

import {
  ONBOARDING_AGENTS,
  ONBOARDING_INTEGRATIONS,
  ONBOARDING_STANCES,
} from "@/data/fixtures"
import { pathFor } from "@/routes"

const FIRST_NAME = "Wes"

const STANCE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  eye: EyeIcon,
  target: TargetIcon,
  siren: SirenIcon,
  "refresh-cw": RefreshCwIcon,
}

const INTEGRATION_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  key: KeyRoundIcon,
  mail: MailIcon,
  puzzle: PuzzleIcon,
}

const INTEGRATION_CTAS: Record<string, string> = {
  "Bring your own AI key": "Add key",
  "Email forward-to-parse": "Set up forwarding",
  "Browser extension": "Install extension",
}

/** Linear sequence of panels per branch. The Power-ups + Done steps are shared. */
type StepKey =
  | "welcome"
  | "resume-upload"
  | "confirm-profile"
  | "confirm-search"
  | "light-profile"
  | "first-search"
  | "resume-options"
  | "power-ups"
  | "done"

const BRANCH_A: readonly StepKey[] = [
  "welcome",
  "resume-upload",
  "confirm-profile",
  "confirm-search",
  "power-ups",
  "done",
]

const BRANCH_B: readonly StepKey[] = [
  "welcome",
  "light-profile",
  "first-search",
  "resume-options",
  "power-ups",
  "done",
]

function OnbCard({ children }: { children: React.ReactNode }) {
  return <div className="card p-8">{children}</div>
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-[11.5px] font-semibold text-[var(--fg-muted)]">
        {label}
      </div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Welcome + intent + fork
// ---------------------------------------------------------------------------

function OnbWelcome({ onFork }: { onFork: (hasResume: boolean) => void }) {
  const [picked, setPicked] = React.useState<string>("searching")
  return (
    <OnbCard>
      <h1 className="m-0 mb-1.5 display text-[36px] font-normal leading-[1.1]">
        Hey {FIRST_NAME} - let's get you set up.
      </h1>
      <p className="mb-6 max-w-[520px] text-sm text-[var(--fg-muted)]">
        A few quick steps. Skip anytime - you can finish any of this later from
        Settings.
      </p>
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
        What's your situation?
      </div>
      <div className="mb-7 flex flex-col gap-2">
        {ONBOARDING_STANCES.map((stance) => {
          const Icon = STANCE_ICONS[stance.icon] ?? TargetIcon
          return (
            <button
              key={stance.key}
              className="opt"
              aria-checked={picked === stance.key}
              onClick={() => setPicked(stance.key)}
            >
              <div className="opt__icon">
                <Icon className="size-[18px]" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{stance.title}</div>
                <div className="text-[12.5px] text-[var(--fg-muted)]">
                  {stance.description}
                </div>
              </div>
              <div className="opt__radio" />
            </button>
          )
        })}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border bg-[var(--bg-subtle)] p-[18px]">
        <div className="mb-1 text-sm font-semibold">Got a resume handy?</div>
        <p className="mb-3.5 text-[12.5px] text-[var(--fg-muted)]">
          If you do, we'll read it into your career history (and keep the
          original safe). If not, no problem - we'll build it up with you.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" onClick={() => onFork(true)}>
            Yes, upload one <ArrowRightIcon className="size-3.5" />
          </Button>
          <Button variant="secondary" onClick={() => onFork(false)}>
            Not right now
          </Button>
        </div>
      </div>
    </OnbCard>
  )
}

// ---------------------------------------------------------------------------
// Branch A: resume upload
// ---------------------------------------------------------------------------

function OnbResumeUpload() {
  return (
    <OnbCard>
      <h1 className="m-0 mb-1.5 display text-[32px] font-normal leading-[1.1]">
        Drop in your resume.
      </h1>
      <p className="mb-6 text-sm text-[var(--fg-muted)]">
        This becomes your <b>master</b>. Tailored revisions fork from it.
      </p>
      <div className="rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] p-10 text-center">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full border border-border bg-[var(--bg-elevated)]">
          <FileUpIcon className="size-6 text-[var(--fg-muted)]" />
        </div>
        <div className="mb-1 text-base font-semibold">
          Drop your resume here
        </div>
        <div className="text-sm text-[var(--fg-muted)]">
          or <u>click to browse</u> - PDF or DOCX
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-[12px] text-[var(--fg-muted)]">
          Already have the text?
        </span>
        <Button variant="ghost" size="sm">
          <ClipboardIcon className="size-3.5" /> Paste it instead
        </Button>
      </div>
      <p className="mt-4 text-[12px] text-[var(--fg-subtle)]">
        We'll read it for you - no charge. Parsing is free.
      </p>
    </OnbCard>
  )
}

// ---------------------------------------------------------------------------
// Shared profile panel (pre-filled for Branch A confirm, empty for Branch B)
// ---------------------------------------------------------------------------

function ProfileFields({ filled }: { filled: boolean }) {
  return (
    <>
      <Field label="Current role / title">
        <Input
          defaultValue={filled ? "Staff Engineer, Platform" : undefined}
          placeholder="e.g. Staff Engineer, Platform"
        />
      </Field>
      <Field label="Years of experience">
        <div className="flex flex-wrap gap-1.5">
          <Chip>0-1 yrs</Chip>
          <Chip>2-4 yrs</Chip>
          <Chip pressed={filled}>5-9 yrs</Chip>
          <Chip>10+ yrs</Chip>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Location">
          <Input
            defaultValue={filled ? "Austin, TX" : undefined}
            placeholder="e.g. Austin, TX"
          />
        </Field>
        <Field label="Comp target">
          <Input
            defaultValue={filled ? "$210,000 base" : undefined}
            placeholder="e.g. $210,000 base"
          />
        </Field>
      </div>
      <Field label="Preferred job type">
        <div className="flex flex-wrap gap-1.5">
          <Chip pressed={filled}>Remote</Chip>
          <Chip>Hybrid</Chip>
          <Chip>Onsite</Chip>
          <Chip pressed={filled}>Full-time</Chip>
          <Chip>Contract</Chip>
        </div>
      </Field>
      <Field label="Currently employed?">
        <div className="flex flex-wrap gap-1.5">
          <Chip pressed={filled}>Employed - searching quietly</Chip>
          <Chip>Between roles</Chip>
          <Chip>About to graduate</Chip>
        </div>
      </Field>
      <Field label="Anything we should know? (optional)">
        <Textarea
          rows={3}
          placeholder='e.g. "fully remote only", "need visa sponsorship"'
        />
      </Field>
    </>
  )
}

function OnbConfirmProfile() {
  return (
    <OnbCard>
      <h1 className="m-0 mb-1.5 display text-[32px] font-normal leading-[1.1]">
        Here's your career history.
      </h1>
      <p className="mb-6 text-sm text-[var(--fg-muted)]">
        We read your resume and pulled this out. Fix anything that's off -- your
        uploaded original is saved untouched, so you can always go back to it.
      </p>
      <ProfileFields filled />
    </OnbCard>
  )
}

function OnbLightProfile() {
  return (
    <OnbCard>
      <h1 className="m-0 mb-1.5 display text-[32px] font-normal leading-[1.1]">
        Tell us the basics.
      </h1>
      <p className="mb-6 text-sm text-[var(--fg-muted)]">
        Just enough to get going. The coach uses this to calibrate tone and
        benchmarks.
      </p>
      <ProfileFields filled={false} />
    </OnbCard>
  )
}

// ---------------------------------------------------------------------------
// First search panel (shared copy; "Confirm" vs "set up" framing varies)
// ---------------------------------------------------------------------------

function SearchPanel({ confirm }: { confirm: boolean }) {
  return (
    <OnbCard>
      <h1 className="m-0 mb-1.5 display text-[32px] font-normal leading-[1.1]">
        {confirm ? "Confirm your first search." : "Set up your first search."}
      </h1>
      <p className="mb-6 text-sm text-[var(--fg-muted)]">
        Most people start with one.
      </p>
      <div className="rounded-[var(--radius-lg)] border border-border bg-[var(--bg-subtle)] p-[18px]">
        <Field label="Search name">
          <Input defaultValue="Staff / Principal - Platform - remote" />
        </Field>
        <Field label="Titles to look for">
          <div className="flex flex-wrap gap-1.5">
            <Chip pressed>Staff Engineer</Chip>
            <Chip pressed>Principal Engineer</Chip>
            <Chip pressed>Platform Lead</Chip>
            <Chip variant="dash">+ Add</Chip>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Locations">
            <Input defaultValue="Remote (US) - async-friendly" />
          </Field>
          <Field label="Comp floor">
            <Input defaultValue="$210,000 base" />
          </Field>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)] p-3">
          <div className="text-[12.5px] text-[var(--fg-muted)]">
            Find roles on{" "}
            <a
              href="https://hiring.cafe"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[var(--fg)] underline"
            >
              hiring.cafe <ExternalLinkIcon className="size-3" />
            </a>
            , then paste the link here.
          </div>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="mt-3">
        <PlusIcon className="size-3.5" /> Add another search
      </Button>
    </OnbCard>
  )
}

// ---------------------------------------------------------------------------
// Branch B: resume options
// ---------------------------------------------------------------------------

function OnbResumeOptions() {
  const options = [
    {
      Icon: MessageSquareIcon,
      title: "Build it with your Coach",
      description:
        "Chat-guided. Answer a few questions and we draft it together.",
      cta: "Start with Coach",
    },
    {
      Icon: PencilIcon,
      title: "Build it yourself",
      description: "Open the manual editor and write it your way.",
      cta: "Open editor",
    },
    {
      Icon: ClockIcon,
      title: "Do it later",
      description: "Skip for now. You can add a resume any time from Settings.",
      cta: "Skip for now",
    },
  ] as const
  return (
    <OnbCard>
      <h1 className="m-0 mb-1.5 display text-[32px] font-normal leading-[1.1]">
        Let's start your career history.
      </h1>
      <p className="mb-6 text-sm text-[var(--fg-muted)]">
        Once it's in, we'll spin up a starter master resume from it -- same
        content, our clean default layout (restyle anytime with Templates). It
        unlocks match scoring and tailored revisions. Pick how you'd like to get
        going.
      </p>
      <div className="flex flex-col gap-2.5">
        {options.map((opt) => (
          <div key={opt.title} className="card flex items-center gap-3 p-4">
            <div className="grid size-9 place-items-center rounded-[var(--radius-md)] border border-border bg-[var(--bg-subtle)]">
              <opt.Icon className="size-[18px]" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{opt.title}</div>
              <div className="text-[12.5px] text-[var(--fg-muted)]">
                {opt.description}
              </div>
            </div>
            <Button variant="secondary" size="sm">
              {opt.cta}
            </Button>
          </div>
        ))}
      </div>
    </OnbCard>
  )
}

// ---------------------------------------------------------------------------
// Shared: power-ups
// ---------------------------------------------------------------------------

function OnbPowerUps() {
  return (
    <OnbCard>
      <h1 className="m-0 mb-1.5 display text-[32px] font-normal leading-[1.1]">
        Power-ups.
      </h1>
      <p className="mb-6 text-sm text-[var(--fg-muted)]">
        All optional. Set up now or later in Settings.
      </p>

      <div className="flex flex-col gap-2.5">
        {ONBOARDING_INTEGRATIONS.map((integration) => {
          const Icon = INTEGRATION_ICONS[integration.icon] ?? KeyRoundIcon
          const cta = INTEGRATION_CTAS[integration.name] ?? "Connect"
          return (
            <div
              key={integration.name}
              className="card flex items-start gap-3 p-4"
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] border border-border bg-[var(--bg-subtle)]">
                <Icon className="size-[18px]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {integration.name}
                  <Badge variant="default">optional</Badge>
                </div>
                <div className="text-[12.5px] text-[var(--fg-muted)]">
                  {integration.description}
                </div>
              </div>
              <Button variant="secondary" size="sm" className="shrink-0">
                {cta}
              </Button>
            </div>
          )
        })}
      </div>

      <div className="mt-6 rounded-[var(--radius-lg)] border border-border bg-[var(--bg-subtle)] p-[18px]">
        <div className="mb-1 text-sm font-semibold">Your background crew</div>
        <p className="mb-3.5 text-[12.5px] text-[var(--fg-muted)]">
          Opt-in and revocable - you always see what they did.
        </p>
        <div className="flex flex-col gap-2">
          {ONBOARDING_AGENTS.map((agent) => (
            <div
              key={agent.name}
              className="card flex items-center gap-3 p-3.5"
            >
              <div className="flex-1">
                <div className="text-sm font-semibold">{agent.name}</div>
                <div className="text-[12.5px] text-[var(--fg-muted)]">
                  {agent.description}
                </div>
              </div>
              <Switch defaultChecked={agent.on} />
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[12px] text-[var(--fg-subtle)]">
        Interview invites? Forward the .ics and we'll track them.
      </p>
    </OnbCard>
  )
}

// ---------------------------------------------------------------------------
// Shared: done
// ---------------------------------------------------------------------------

function OnbDone({
  onDashboard,
  onAddJob,
}: {
  onDashboard: () => void
  onAddJob: () => void
}) {
  return (
    <OnbCard>
      <h1 className="m-0 mb-1.5 display text-[36px] font-normal leading-[1.1]">
        You're all set.
      </h1>
      <p className="mb-7 max-w-[520px] text-sm text-[var(--fg-muted)]">
        Your workbench is ready, {FIRST_NAME}. Head to the dashboard or drop in
        your first job to get rolling.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="default" onClick={onDashboard}>
          Take me to my dashboard <ArrowRightIcon className="size-3.5" />
        </Button>
        <Button variant="secondary" onClick={onAddJob}>
          <PlusIcon className="size-3.5" /> Add your first job
        </Button>
      </div>
    </OnbCard>
  )
}

// ---------------------------------------------------------------------------
// Wizard shell
// ---------------------------------------------------------------------------

export default function OnboardingScreen() {
  const [hasResume, setHasResume] = React.useState<boolean | null>(null)
  const [index, setIndex] = React.useState(0)
  const navigate = useNavigate()

  // Welcome is shared; once forked, follow the branch sequence.
  const steps = hasResume === false ? BRANCH_B : BRANCH_A
  const total = steps.length
  const current = steps[index]
  const isLast = index === total - 1

  function fork(resume: boolean) {
    setHasResume(resume)
    setIndex(1)
  }

  function back() {
    if (index === 1) {
      // Returning to the (shared) welcome step un-forks.
      setHasResume(null)
    }
    setIndex(Math.max(0, index - 1))
  }

  const goDashboard = () => navigate(pathFor("dashboard"))
  const goAddJob = () => navigate(pathFor("add-app"))

  return (
    <div className="onb">
      <div className="onb__head">
        <img src="design_system/mark.svg" width={28} height={28} alt="" />
        <div className="text-[15px] font-semibold">
          employa<span className="text-[var(--fg-subtle)]">-bot</span>
        </div>
        <div className="flex-1" />
        <div className="onb__progress">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={i < index ? "done" : i === index ? "current" : ""}
            />
          ))}
        </div>
        <span className="font-mono text-[11px] text-[var(--fg-muted)]">
          {index + 1}/{total}
        </span>
        <Button variant="ghost" size="sm" onClick={goDashboard}>
          Skip to dashboard
        </Button>
      </div>

      <div className="mx-auto mt-10 w-full max-w-[680px] px-6">
        {current === "welcome" && <OnbWelcome onFork={fork} />}
        {current === "resume-upload" && <OnbResumeUpload />}
        {current === "confirm-profile" && <OnbConfirmProfile />}
        {current === "confirm-search" && <SearchPanel confirm />}
        {current === "light-profile" && <OnbLightProfile />}
        {current === "first-search" && <SearchPanel confirm={false} />}
        {current === "resume-options" && <OnbResumeOptions />}
        {current === "power-ups" && <OnbPowerUps />}
        {current === "done" && (
          <OnbDone onDashboard={goDashboard} onAddJob={goAddJob} />
        )}

        <div className="mt-7 flex justify-between">
          <Button
            variant="ghost"
            onClick={back}
            style={{ visibility: index === 0 ? "hidden" : "visible" }}
          >
            <ArrowLeftIcon className="size-3.5" /> Back
          </Button>
          <div className="flex gap-2">
            {/* The welcome step advances via its fork buttons, not Continue. */}
            {current !== "welcome" && !isLast ? (
              <>
                <Button variant="ghost" onClick={() => setIndex(index + 1)}>
                  Skip for now
                </Button>
                <Button variant="default" onClick={() => setIndex(index + 1)}>
                  Continue <ArrowRightIcon className="size-3.5" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
