/**
 * Mark Won modal - celebratory outcome capture. Bypasses AppFrame; renders as
 * an open Dialog over a dimmed background.
 *
 * Picker id: `mark-won`
 * Route path: `/applications/:id/mark-won` (Phase 9)
 */

import { TrophyIcon, XIcon } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { CoLogo } from "@/components/atoms/co-logo"
import { DatePicker } from "@/components/atoms/date-picker"
import { Button } from "@/components/ui/button-eb"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useApplicationLifecycle } from "@/hooks"

export default function MarkWonScreen() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const lifecycle = useApplicationLifecycle()

  // Close returns to the application underneath (the route is stacked over it).
  function handleClose() {
    navigate(id ? `/applications/${id}` : "/applications")
  }

  // Save archives the search + records the win (D18), then lands on the Wins
  // archive with a time-boxed undo. Undo within ~5 min reverses the cascade;
  // after that, a correction becomes a deliberate rescission (state-machines.md).
  async function handleSaveAndArchive() {
    if (!id) {
      navigate("/wins")
      return
    }
    try {
      const result = await lifecycle.markWon(id, {})
      toast.celebrate({
        title: "Win recorded -- search archived",
        sub: "Undo within 5 minutes. Agents for this search are silenced.",
        undo: {
          onUndo: async () => {
            try {
              await lifecycle.undoMarkWon(id, result.undoToken)
              toast.success({
                title: "Win undone",
                sub: "Application restored to your pipeline.",
              })
            } catch {
              toast.error({
                title: "Undo window expired",
                sub: "Mark it won again, or record a rescission.",
              })
            }
          },
        },
      })
      navigate("/wins")
    } catch {
      toast.error({
        title: "Could not record the win",
        sub: "Please try again.",
      })
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[680px]">
        <DialogHeader>
          <div className="mb-3 grid size-14 place-items-center rounded-full bg-[var(--accent-soft)]">
            <TrophyIcon className="size-[26px] text-[var(--lime-700)]" />
          </div>
          <DialogTitle className="text-2xl font-normal tracking-[-0.015em]">
            Congrats on the new role.
          </DialogTitle>
          <DialogDescription>
            Tell us what won, so we can learn for next time. We'll archive this
            search and silence its agents.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
            Which application turned into the win?
          </div>
          <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-[var(--bg-subtle)] p-3">
            <CoLogo name="Vercel" size="default" />
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold">Vercel</div>
              <div className="text-[12px] text-[var(--fg-muted)]">
                Staff Engineer - Edge Runtime - Remote
              </div>
            </div>
            <span className="mono text-[12px] text-[var(--fg-muted)]">
              $265k base + equity
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Start date
            </div>
            <DatePicker />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Negotiated comp
            </div>
            <Input
              defaultValue="$280k + equity + sign-on"
              className="font-mono"
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
            What worked?
          </div>
          <Textarea
            rows={3}
            placeholder='e.g. "Maya at Supabase reaching out on LinkedIn beat anything I applied to cold."'
          />
        </div>

        <DialogFooter className="mt-5">
          <Button variant="ghost" onClick={handleClose}>
            <XIcon className="size-3.5" /> Close
          </Button>
          <Button variant="default" onClick={handleSaveAndArchive}>
            Save & archive search
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
