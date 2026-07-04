/**
 * Dashboard - ambient overview. Needs-attention list is the hero.
 *
 * Picker id: `dashboard`
 * Route path: `/dashboard` (Phase 9)
 *
 * Stories implemented:
 *   TRK-117 -- WEEK rows clickable (navigate to app detail); Prep button for
 *              interview-stage rows navigating to /coach
 */

import { Link2Icon, PlusIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { BotPill } from "@/components/atoms/bot-pill"
import { CoLogo } from "@/components/atoms/co-logo"
import { StageDot } from "@/components/atoms/stage-dot"
import { StatCard } from "@/components/atoms/stat-card"
import { AttnRow } from "@/components/domain/attn-row"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { DashboardNudge, Stage } from "@/data/types"
import { useApplications, useShortlist } from "@/hooks"
import { pathFor } from "@/routes"

// Each nudge routes to where its drafted artifact actually lives: the
// application detail (reply / follow-up / offer + counter sit on the app's
// coach block + timeline) or the Coach (interview prep). `to` is the real
// destination so the CTA opens the thing, not a toast.
type DashboardNudgeRow = DashboardNudge & { to: string }

const NUDGES: readonly DashboardNudgeRow[] = [
  {
    tag: "reply",
    label: "Reply",
    title: "Vercel sent times for the offer call",
    meta: "3 slots this week - coach drafted a yes-and-counter",
    cta: "Review",
    primary: true,
    to: "/applications/vercel",
  },
  {
    tag: "stale",
    label: "Stale",
    title: "Stripe - 9 days, no response",
    meta: "Avg reply for this team is 6d - follow-up drafted",
    cta: "Review",
    primary: false,
    to: "/applications/stripe",
  },
  {
    tag: "prep",
    label: "Prep",
    title: "Linear screen - Thursday 11:00 AM",
    meta: "12 likely questions - prep doc ready",
    cta: "Open",
    primary: false,
    to: "/coach",
  },
  {
    tag: "offer",
    label: "Offer",
    title: "Vercel - decide by Friday",
    meta: "Counter drafted: $265k -> $280k + sign-on",
    cta: "Review",
    primary: true,
    to: "/applications/vercel",
  },
]

// Pipeline columns -- items are derived live from the fetched applications.
const PIPE_COLS: readonly { label: string; stage: Stage }[] = [
  { label: "Applied", stage: "applied" },
  { label: "Screen", stage: "screen" },
  { label: "Interview", stage: "interview" },
  { label: "Offer", stage: "offer" },
  { label: "Rejected", stage: "rejected" },
]

/**
 * WEEK entries. `who` must match Application.company values in APPS (or use a
 * substring that includes() will catch). The company-to-id lookup below
 * uses includes() to handle partial matches like "Fly.io" -> "Fly".
 * `appId` is the known fixture id for direct navigation.
 */
const WEEK: readonly {
  day: string
  time: string
  who: string
  what: string
  stage: Stage
  appId: string
}[] = [
  {
    day: "Tue",
    time: "2:00 PM",
    who: "Modal",
    what: "Resume due",
    stage: "draft",
    appId: "modal",
  },
  {
    day: "Thu",
    time: "11:00 AM",
    who: "Linear",
    what: "Recruiter screen",
    stage: "screen",
    appId: "linear",
  },
  {
    day: "Fri",
    time: "3:00 PM",
    who: "Vercel",
    what: "Offer decision call",
    stage: "offer",
    appId: "vercel",
  },
  {
    day: "Mon",
    time: "9:00 AM",
    who: "PlanetScale",
    what: "Onsite interview",
    stage: "interview",
    appId: "planetscale",
  },
]

const AGENT_FEED = [
  {
    title: "Stale-detector flagged Stripe",
    subtitle: "Coach drafted a follow-up",
  },
  {
    title: "Stale-detector checked 14 applications",
    subtitle: "1 newly stale - 4h ago",
  },
  {
    title: "Coach drafted a follow-up for Stripe",
    subtitle: "Awaiting your send - 3h ago",
  },
  {
    title: "Ghost-detector auto-marked Convex",
    subtitle: "28 days silence - undoable",
  },
]

export default function DashboardScreen() {
  const { data: apps, isLoading } = useApplications()
  const { data: shortlist } = useShortlist()
  const navigate = useNavigate()

  // Derived stat-tile + pipeline data (replaces the hardcoded 14/22/8/3/1).
  const list = apps ?? []
  const active = list.filter(
    (application) =>
      application.stage !== "rejected" && application.stage !== "closed",
  ).length
  const interviews = list.filter(
    (application) => application.stage === "interview",
  ).length
  const offers = list.filter(
    (application) => application.stage === "offer",
  ).length
  const awaiting = list.filter(
    (application) =>
      application.stage === "applied" || application.stage === "screen",
  ).length
  const stale = list.filter(
    (application) => application.flag === "stale",
  ).length
  const shortlisted = shortlist?.length ?? 0
  const pipeCols = PIPE_COLS.map((pipeColumn) => ({
    ...pipeColumn,
    items: list.filter((application) => application.stage === pipeColumn.stage),
  }))

  // Each "Needs your attention" CTA opens the drafted artifact at its real
  // destination (app detail or Coach), then confirms.
  function handleNudge(n: DashboardNudgeRow) {
    navigate(n.to)
    toast.agent({ title: `Opening: ${n.title}`, sub: n.meta })
  }

  return (
    <AppFrame
      active="dashboard"
      title="Dashboard"
      subtitle="Overview - Wednesday, March 14"
    >
      <div>
        <PageHead
          eyebrow="Wednesday - March 14"
          title={
            <>
              Morning, Wes - <em>three</em> things to do today.
            </>
          }
          lede="One offer in hand (Vercel), one likely-stale follow-up (Stripe), and a screen Thursday. Capture new roles from hiring.cafe whenever you find them."
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("/applications/new")}
              >
                <Link2Icon className="size-3.5" /> Paste job link
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate("/applications/new")}
              >
                <PlusIcon className="size-3.5" /> Add application
              </Button>
            </>
          }
        />

        <div className="mb-6">
          <div className="mb-2.5 flex items-center gap-2.5 px-1">
            <div className="text-[13px] font-semibold">
              Needs your attention
            </div>
            <Badge>4 items</Badge>
            <div className="flex-1" />
            <BotPill muted>Coach queued 3 drafts</BotPill>
          </div>
          <div className="attn-list">
            {NUDGES.map((nudge) => (
              <AttnRow
                key={nudge.title}
                tag={nudge.tag}
                title={nudge.title}
                meta={nudge.meta}
                cta={
                  <Button
                    variant={nudge.primary ? "default" : "secondary"}
                    size="sm"
                    onClick={() => handleNudge(nudge)}
                  >
                    {nudge.cta}
                  </Button>
                }
              />
            ))}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-5 gap-3">
          <StatCard
            label="Active"
            value={String(active)}
            hint="in progress"
            tone="up"
          />
          <StatCard
            label="Shortlisted"
            value={String(shortlisted)}
            hint="saved for later"
          />
          <StatCard
            label="Awaiting"
            value={String(awaiting)}
            delta={stale > 0 ? `${stale} stale` : undefined}
            tone={stale > 0 ? "down" : undefined}
          />
          <StatCard
            label="Interviews"
            value={String(interviews)}
            hint="scheduled"
          />
          <StatCard
            label="Offers"
            value={String(offers)}
            hint={offers > 0 ? "decide soon" : "none yet"}
            tone={offers > 0 ? "up" : undefined}
          />
        </div>

        <div className="grid grid-cols-[1.7fr_1fr] gap-4">
          <div className="card p-0">
            <div className="card-head">
              <span>Pipeline - Platform search</span>
              <Badge>{active} active</Badge>
              <span className="meta">last 30 days</span>
            </div>
            {isLoading ? (
              <div className="p-4">
                <Skeleton className="h-40" />
              </div>
            ) : (
              <div
                className="pipeline"
                style={{ border: 0, borderRadius: 0, borderTop: 0 }}
              >
                {pipeCols.map((col) => (
                  <div key={col.label} className="pipeline-col">
                    <div className="pipeline-col__head">
                      <StageDot stage={col.stage} />
                      <b>{col.label}</b>
                      <span className="mono">{col.items.length}</span>
                    </div>
                    {col.items.map((application) => (
                      <div
                        key={application.id}
                        className="pipeline-card cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          navigate(`/applications/${application.id}`)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            navigate(`/applications/${application.id}`)
                          }
                        }}
                      >
                        <CoLogo name={application.company} size="sm" />
                        <span className="flex-1 truncate">
                          {application.company}
                        </span>
                      </div>
                    ))}
                    {col.items.length === 0 ? (
                      <div className="py-3 text-center text-[11px] text-[var(--fg-subtle)]">
                        -
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="col gap-4">
            <div className="card p-0">
              <div className="card-head">This week</div>
              {WEEK.map((weekEvent, index) => (
                <div
                  key={index}
                  role="button"
                  tabIndex={0}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-subtle)] transition-colors"
                  style={{
                    borderTop: index > 0 ? "1px solid var(--border)" : 0,
                  }}
                  onClick={() => navigate(`/applications/${weekEvent.appId}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      navigate(`/applications/${weekEvent.appId}`)
                    }
                  }}
                  aria-label={`Open ${weekEvent.who} - ${weekEvent.what}`}
                >
                  <div className="w-10 text-center">
                    <div className="font-mono text-[10px] uppercase text-[var(--fg-subtle)]">
                      {weekEvent.day}
                    </div>
                    <div className="text-[13px] font-semibold">
                      {weekEvent.time.split(" ")[0]}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">
                      {weekEvent.who}
                    </div>
                    <div className="text-[11px] text-[var(--fg-subtle)]">
                      {weekEvent.what}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StageDot stage={weekEvent.stage} />
                    {/* Prep affordance for interview-stage rows (TRK-117) */}
                    {weekEvent.stage === "interview" ||
                    weekEvent.stage === "screen" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-[22px] px-2 text-[11px]"
                        onClick={(ev) => {
                          ev.stopPropagation() // don't navigate to app-detail
                          navigate("/coach")
                        }}
                      >
                        Prep
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="card p-4">
              <div className="mb-2.5 flex items-center gap-2">
                <div className="text-[13px] font-semibold">
                  Recent agent activity
                </div>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-[22px] px-1.5 text-[11px]"
                  onClick={() => navigate(pathFor("agent-log"))}
                >
                  All -&gt;
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {AGENT_FEED.map((feedItem, index) => (
                  <div key={index} className="flex items-start gap-2.5 py-1.5">
                    <div className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] border border-border bg-[var(--bg-subtle)]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium">
                        {feedItem.title}
                      </div>
                      <div className="text-[11px] text-[var(--fg-subtle)]">
                        {feedItem.subtitle}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}
