/**
 * Browser extension popup - bypasses AppFrame.
 *
 * Picker id: `extension`
 * Route path: `/preview/extension` (Phase 9)
 *
 * Renders the 3 popup states (detected / empty / signed-out) side by side
 * on a tiled canvas, mimicking the Chrome popup at ~360px wide.
 */

import {
  ArrowUpRightIcon,
  BookmarkIcon,
  CheckIcon,
  ExternalLinkIcon,
  HandIcon,
  InfoIcon,
  MessageSquareHeartIcon,
  SearchXIcon,
} from "lucide-react"
import type * as React from "react"
import { MatchPill } from "@/components/atoms/match-pill"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Skeleton } from "@/components/ui/skeleton"
import { useExtensionState } from "@/hooks"

function ExtFrame({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline gap-2">
        <div className="text-[13px] font-semibold">{label}</div>
      </div>
      <div className="ext-popup">
        <div className="ext-popup__head">
          <img src="design_system/mark.svg" width={20} height={20} alt="" />
          <span className="font-semibold">employa-bot</span>
          <span className="mono ml-auto text-[10px] text-[var(--fg-subtle)]">
            chrome ext - v1.2
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}

function ExtDetected() {
  return (
    <div className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="accent">job detected</Badge>
        <div className="flex-1" />
        <span className="mono text-[10px] text-[var(--fg-subtle)]">
          greenhouse.io
        </span>
      </div>
      <h3 className="m-0 text-[15px] font-semibold">
        Staff Engineer, Payments core
      </h3>
      <div className="mt-0.5 text-[13px] text-[var(--fg-muted)]">Stripe</div>
      <div className="mt-0.5 font-mono text-[12px] text-[var(--fg-subtle)]">
        Remote - $230-265k - full-time
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <MatchPill score={87} />
        <Badge>vs Platform search</Badge>
      </div>
      <div className="mt-3 rounded-[var(--radius-md)] border border-border bg-[var(--bg-subtle)] p-2.5 text-[12px] leading-[1.5]">
        <div className="flex items-start gap-1.5">
          <InfoIcon className="size-3 shrink-0 text-[var(--info)]" />
          <span>
            1 application already exists for this URL. Last touched 9d ago -
            you're in <b>APPLIED</b>.
          </span>
        </div>
      </div>
      <div className="mt-3.5 flex flex-col gap-1.5">
        <Button variant="default" size="sm" className="w-full justify-center">
          <ExternalLinkIcon className="size-3" /> Open in employa-bot
        </Button>
        <Button variant="secondary" size="sm" className="w-full justify-center">
          <BookmarkIcon className="size-3" /> Save to Shortlist
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-center">
          <CheckIcon className="size-3" /> Add as Applied
        </Button>
      </div>
      <div className="mt-3.5 text-center text-[11.5px] text-[var(--fg-subtle)]">
        <MessageSquareHeartIcon className="inline size-3" /> Coach can prep a
        tailored résumé - <u>open editor</u>
      </div>
    </div>
  )
}

function ExtEmpty({
  captures,
}: {
  captures: ReadonlyArray<{ title: string; detail: string }>
}) {
  return (
    <div className="p-[18px]">
      <div className="py-3 text-center">
        <div className="mb-2 inline-grid size-11 place-items-center rounded-full border border-border bg-[var(--bg-subtle)]">
          <SearchXIcon className="size-5 text-[var(--fg-subtle)]" />
        </div>
        <h3 className="m-0 text-[15px] font-semibold">No job here</h3>
        <p className="my-1 mb-3 text-[12.5px] text-[var(--fg-muted)]">
          We don't see a job posting on this page. If it is one, paste the URL
          into the app instead.
        </p>
        <Button variant="secondary" size="sm" className="w-full justify-center">
          Open dashboard
        </Button>
      </div>
      <div className="mt-3 border-t border-border pt-2.5">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
          Recently captured
        </div>
        {captures.map((capture) => (
          <div
            key={capture.title}
            className="flex items-center gap-2 py-1.5 text-[12.5px]"
          >
            <ArrowUpRightIcon className="size-3 text-[var(--fg-subtle)]" />
            <span className="flex-1">{capture.title}</span>
            <span className="mono text-[10px] text-[var(--fg-subtle)]">
              {capture.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExtSignedOut() {
  return (
    <div className="p-6 text-center">
      <div className="mb-3 inline-grid size-12 place-items-center rounded-full bg-[var(--accent-soft)]">
        <HandIcon className="size-[22px] text-[var(--accent-text)]" />
      </div>
      <h3 className="m-0 text-[15px] font-semibold">
        Sign in to start capturing
      </h3>
      <p className="my-1 mb-4 text-[12.5px] text-[var(--fg-muted)]">
        One-click save from any job board.
      </p>
      <Button variant="default" size="sm" className="w-full justify-center">
        Sign in
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="mt-1.5 w-full justify-center"
      >
        Make an account
      </Button>
    </div>
  )
}

export default function ExtensionScreen() {
  const { data, isLoading } = useExtensionState("empty")

  return (
    <div className="ext-wrap min-h-screen">
      <div className="mb-6 w-full text-center">
        <h1 className="m-0 display text-[32px] font-normal">
          Browser extension
        </h1>
        <p className="mx-auto mt-1.5 max-w-[540px] text-[13.5px] text-[var(--fg-muted)]">
          Chrome popup, ~360px wide. Detects job postings via known DOM patterns
          + meta tags. The fastest capture path.
        </p>
      </div>
      <ExtFrame label="On a recognized job posting">
        <ExtDetected />
      </ExtFrame>
      <ExtFrame label="Page isn't a job posting - fallback">
        {isLoading || !data ? (
          <Skeleton className="m-4 h-40" />
        ) : (
          <ExtEmpty captures={data.recentCaptures} />
        )}
      </ExtFrame>
      <ExtFrame label="First-run - not signed in">
        <ExtSignedOut />
      </ExtFrame>
    </div>
  )
}
