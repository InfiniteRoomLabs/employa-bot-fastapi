/**
 * CoachPanel (COA-030..036). The one omnipresent assistant: a collapsible
 * right-side Sheet, summonable from any framed screen. Opens with a
 * context-scoped greeting + suggested-action chips (COA-031), but its
 * capabilities are never limited by the current screen. Edits arrive as
 * reviewable proposals the user accepts (gate 1) then saves (gate 2, COA-032);
 * saved changes are attributed to Coach (COA-036).
 *
 * Mounted ONCE in App.tsx (a Toaster sibling). Do not mount elsewhere.
 */

import * as React from "react"
import { CoachActorBadge } from "@/components/atoms/coach-actor-badge"
import { CoachMessage } from "@/components/domain/coach-message"
import { Button } from "@/components/ui/button-eb"
import { Chip } from "@/components/ui/chip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type {
  CoachMessage as CoachMessageType,
  CoachProposal,
  TimelineEvent,
} from "@/data/types"
import { useCoachGreeting, useCoachProposal } from "@/hooks"
import { useCoachPanel } from "./coach-panel-provider"
import { CoachProposalCard } from "./coach-proposal-card"

let msgSeq = 0
function nextId(): string {
  msgSeq += 1
  return `coach-msg-${msgSeq}`
}

export function CoachPanel() {
  const { isOpen, subject, close } = useCoachPanel()
  const greeting = useCoachGreeting(subject.scope)
  const { propose, save, isMutating } = useCoachProposal()

  const [messages, setMessages] = React.useState<CoachMessageType[]>([])
  const [input, setInput] = React.useState("")
  const [proposal, setProposal] = React.useState<CoachProposal | null>(null)
  const [savedEvent, setSavedEvent] = React.useState<TimelineEvent | null>(null)

  // D22: a gate-1-accepted proposal is client-side only -- guard against losing
  // it. BrowserRouter has no useBlocker, so we cover the real loss vectors:
  // tab close/refresh (beforeunload) and closing the panel (confirm dialog).
  // In-app route changes keep the panel mounted, so the proposal survives them.
  const hasUnsaved = proposal?.status === "accepted"
  const [confirmClose, setConfirmClose] = React.useState(false)

  React.useEffect(() => {
    if (!hasUnsaved) {
      return
    }
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [hasUnsaved])

  const requestClose = () => {
    if (hasUnsaved) {
      setConfirmClose(true)
      return
    }
    close()
  }

  const pushBot = (text: string) =>
    setMessages((m) => [...m, { id: nextId(), author: "bot", text }])
  const pushUser = (text: string) =>
    setMessages((m) => [...m, { id: nextId(), author: "user", text }])

  const send = (text: string) => {
    const trimmed = text.trim()
    if (trimmed.length === 0) {
      return
    }
    pushUser(trimmed)
    setInput("")
    // Mock assistant turn -- no real LLM in the mockup.
    window.setTimeout(
      () =>
        pushBot(
          "Here is how I would approach that. Want me to draft a change?",
        ),
      0,
    )
  }

  const handlePropose = async () => {
    setSavedEvent(null)
    try {
      const p = await propose(subject)
      setProposal(p)
      pushBot(
        "I drafted a change -- review the diff below, then accept and save.",
      )
    } catch {
      pushBot("I could not draft a change just now.")
    }
  }

  const handleSave = async () => {
    if (!proposal) {
      return
    }
    try {
      const ev = await save(proposal)
      setSavedEvent(ev)
      setProposal(null)
    } catch {
      pushBot("I could not save that change.")
    }
  }

  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={(o) => {
          if (!o) {
            requestClose()
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-md"
          data-slot="coach-panel"
        >
          <SheetHeader className="border-b border-border">
            <SheetTitle>Coach</SheetTitle>
            <p className="text-[12.5px] text-[var(--fg-muted)]">
              {greeting.data?.greeting ?? ""}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {greeting.data?.chips.map((chip) => (
                <Chip key={chip} onClick={() => send(chip)}>
                  {chip}
                </Chip>
              ))}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="text-[12.5px] text-[var(--fg-subtle)]">
                Ask me anything about {subject.label}, or pick a suggestion
                above. I can pull from your whole library, not just this screen.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m) => (
                  <CoachMessage key={m.id} message={m} />
                ))}
              </div>
            )}

            {proposal ? (
              <div className="mt-3">
                <CoachProposalCard
                  proposal={proposal}
                  onAccept={() =>
                    setProposal({ ...proposal, status: "accepted" })
                  }
                  onReject={() =>
                    setProposal({ ...proposal, status: "rejected" })
                  }
                  onSave={handleSave}
                  saving={isMutating}
                />
              </div>
            ) : null}

            {savedEvent ? (
              <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--fg-muted)]">
                <span>Saved:</span>
                <CoachActorBadge
                  actor={savedEvent.actor ?? "coach-on-behalf"}
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 border-t border-border p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  send(input)
                }
              }}
              placeholder="Ask the coach..."
              aria-label="Message the coach"
            />
            <Button
              variant="ghost"
              onClick={handlePropose}
              disabled={isMutating}
            >
              Suggest edit
            </Button>
            <Button onClick={() => send(input)}>Send</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* D22: unsaved-Coach-changes guard when closing the panel */}
      <Dialog
        open={confirmClose}
        onOpenChange={(open) => !open && setConfirmClose(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Coach changes</DialogTitle>
            <DialogDescription>
              You accepted a Coach edit but have not saved it yet. Save it,
              discard it, or keep editing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmClose(false)}>
              Keep editing
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setProposal(null)
                setConfirmClose(false)
                close()
              }}
            >
              Discard
            </Button>
            <Button
              variant="default"
              onClick={async () => {
                await handleSave()
                setConfirmClose(false)
                close()
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
