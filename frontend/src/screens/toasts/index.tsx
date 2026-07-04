/**
 * Toasts showcase — bypasses AppFrame.
 *
 * Picker id: `toasts`
 * Route path: `/preview/toasts` (Phase 9)
 *
 * Renders the 6 toast variants as click-to-fire buttons plus a static visual
 * row showing the markup each variant produces. The real `toast.*` helpers
 * live in `@/components/ui/toast`; this surface is purely a visual gallery.
 */

import { Button } from "@/components/ui/button-eb"
import { Toaster, toast } from "@/components/ui/toast"

interface ShowcaseRow {
  kind: "success" | "agent" | "success" | "warn" | "error" | "celebrate"
  fire: () => void
  title: string
  sub: string
  time: string
}

const ROWS: readonly ShowcaseRow[] = [
  {
    kind: "success",
    title: "Marked Stripe as APPLIED.",
    sub: 'Tailored "Distributed-systems v4" -> locked.',
    time: "5s",
    fire: () =>
      toast.success({
        title: "Marked Stripe as APPLIED.",
        sub: 'Tailored "Distributed-systems v4" -> locked.',
        undo: { onUndo: () => undefined },
      }),
  },
  {
    kind: "agent",
    title: "Coach drafted a follow-up for you.",
    sub: "Review and send when ready.",
    time: "8s",
    fire: () =>
      toast.agent({
        title: "Coach drafted a follow-up for you.",
        sub: "Review and send when ready.",
        cta: { label: "Open draft" },
      }),
  },
  {
    kind: "success",
    title: "Convex marked REJECTED.",
    sub: "Ghost-detector - 28d silence.",
    time: "10s",
    fire: () =>
      toast.success({
        title: "Convex marked REJECTED.",
        sub: "Ghost-detector - 28d silence.",
        undo: { onUndo: () => undefined },
      }),
  },
  {
    kind: "warn",
    title: "Couldn't fully parse that posting.",
    sub: "Fill 2 missing fields to continue.",
    time: "persists",
    fire: () =>
      toast.warn({
        title: "Couldn't fully parse that posting.",
        sub: "Fill 2 missing fields to continue.",
        cta: { label: "Review" },
      }),
  },
  {
    kind: "error",
    title: "Gemini key failed - match scoring paused.",
    sub: "Using Anthropic fallback for now.",
    time: "persists",
    fire: () =>
      toast.error({
        title: "Gemini key failed - match scoring paused.",
        sub: "Using Anthropic fallback for now.",
        cta: { label: "Fix key" },
      }),
  },
  {
    kind: "celebrate",
    title: "Offer received from Vercel!",
    sub: "$265k base + equity - respond by Apr 19.",
    time: "persists",
    fire: () =>
      toast.celebrate({
        title: "Offer received from Vercel!",
        sub: "$265k base + equity - respond by Apr 19.",
        cta: { label: "Open" },
      }),
  },
]

export default function ToastsScreen() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="m-0 display text-[36px] font-normal">Action toasts</h1>
      <p className="mt-1.5 mb-8 max-w-[640px] text-sm text-[var(--fg-muted)]">
        Bottom-center. Auto-dismiss in 5-10s except for warn / error / celebrate
        which persist. Toasts always show <b>what</b>, <b>why</b>, and an{" "}
        <b>undo</b> if reversible. Agent-initiated toasts get a bot pill.
      </p>

      <div className="flex flex-col items-center gap-4">
        {ROWS.map((row, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={row.fire}>
              Fire {row.kind}: {row.title}
            </Button>
            <div className="font-mono text-[11px] text-[var(--fg-subtle)]">
              {row.kind} - {row.time}
            </div>
          </div>
        ))}
      </div>

      <Toaster />
    </div>
  )
}
