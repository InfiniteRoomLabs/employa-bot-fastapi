import {
  ClipboardCopyIcon,
  DownloadIcon,
  PaperclipIcon,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import * as React from "react"

import { Avatar } from "@/components/ui/avatar-eb"
import { Button } from "@/components/ui/button-eb"
import { toast } from "@/components/ui/toast"
import type { CoachMessage as CoachMessageType } from "@/data/types"
import { cn } from "@/lib/utils"

export type CoachMessageFeedback = "up" | "down"

export interface CoachMessageProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Coach message to render. Field names match `@/data/types::CoachMessage`. */
  message: CoachMessageType
  /** Fired when the user clicks a feedback button (bot messages only). */
  onFeedback?: (kind: CoachMessageFeedback) => void
}

// ---------------------------------------------------------------------------
// DraftBlock (COA-018)
//
// Renders when message.draft is truthy. Shows a visually distinct card with a
// monospace draft text area and a Copy button.
// ---------------------------------------------------------------------------

interface DraftBlockProps {
  draft: string
  attachments?: readonly {
    name: string
    kind: "resume" | "cover-letter" | "file"
  }[]
}

const ATTACHMENT_KIND_LABEL: Record<
  "resume" | "cover-letter" | "file",
  string
> = {
  resume: "Resume",
  "cover-letter": "Cover letter",
  file: "File",
}

function DraftBlock({ draft, attachments }: DraftBlockProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft)
      toast.success({ title: "Copied to clipboard" })
    } catch {
      // Fallback for non-secure contexts (e.g. Storybook over http)
      try {
        const ta = document.createElement("textarea")
        ta.value = draft
        ta.style.position = "fixed"
        ta.style.left = "-9999px"
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
        toast.success({ title: "Copied to clipboard" })
      } catch {
        toast.warn({
          title: "Could not copy",
          sub: "Please copy the text manually.",
        })
      }
    }
  }

  return (
    <div
      data-slot="draft-block"
      className={cn(
        "mt-3 rounded-[var(--radius-md)] border border-[var(--accent-base)] bg-[var(--bg-subtle)]",
        "border-l-4 border-l-[var(--accent-base)] p-3",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-text)]">
          Draft - copy into your email
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Copy draft to clipboard"
          onClick={handleCopy}
          className="h-6 w-6"
        >
          <ClipboardCopyIcon className="size-3" />
        </Button>
      </div>
      <div className="whitespace-pre-wrap font-mono text-[12px] leading-[1.6] text-[var(--fg-base)]">
        {draft}
      </div>

      {/* COA-024: content-library attachments to include. The product never
          sends mail (no Gmail integration) -- the user copies the body and
          attaches these in their own email client. */}
      {attachments && attachments.length > 0 ? (
        <div className="mt-3 border-t border-[var(--border)] pt-2.5">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
            Attach from your library
          </div>
          <div className="flex flex-col gap-1.5">
            {attachments.map((attachment) => (
              <div
                key={attachment.name}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] px-2.5 py-1.5"
              >
                <PaperclipIcon
                  className="size-3 shrink-0 text-[var(--fg-subtle)]"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[12px]">
                  {attachment.name}
                </span>
                <span className="text-[10px] text-[var(--fg-subtle)]">
                  {ATTACHMENT_KIND_LABEL[attachment.kind]}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Download ${attachment.name}`}
                  onClick={() =>
                    toast.default({
                      title: `Downloading ${attachment.name}`,
                      sub: "(mock) Save it, then attach it in your email.",
                    })
                  }
                  className="h-6 w-6"
                >
                  <DownloadIcon className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * One bubble in a coach conversation. User messages render right-aligned
 * with the user avatar trailing. Bot messages render left-aligned with
 * the Ava (accent) avatar leading, plus a row of thumbs feedback buttons
 * under the bubble.
 *
 * COA-018: When message.draft is truthy, renders a DraftBlock below the
 * bubble with a Copy button.
 */
const CoachMessage = React.forwardRef<HTMLDivElement, CoachMessageProps>(
  function CoachMessage({ className, message, onFeedback, ...props }, ref) {
    const [selected, setSelected] = React.useState<CoachMessageFeedback | null>(
      null,
    )
    const isUser = message.author === "user"
    const handle = (kind: CoachMessageFeedback) => () => {
      setSelected(kind)
      onFeedback?.(kind)
    }
    if (isUser) {
      return (
        <div
          ref={ref}
          data-slot="coach-message"
          data-who="user"
          className={cn("mb-4 flex justify-end gap-3", className)}
          {...props}
        >
          <div className="bubble bubble--user">{message.text}</div>
          <Avatar name="RV" />
        </div>
      )
    }
    return (
      <div
        ref={ref}
        data-slot="coach-message"
        data-who="bot"
        className={cn("mb-4 flex items-start gap-3", className)}
        {...props}
      >
        <Avatar name="EB" accent />
        <div className="min-w-0 flex-1">
          <div className="bubble bubble--bot">
            {message.text}
            {message.typing ? (
              <span
                aria-label="typing"
                className="ml-1.5 inline-block size-1.5 align-middle"
                style={{ background: "var(--lime-500)" }}
              />
            ) : null}
          </div>
          {/* COA-018: Draft block rendered below the bubble when draft is present */}
          {message.draft ? (
            <DraftBlock
              draft={message.draft}
              attachments={message.draftAttachments}
            />
          ) : null}
          <div className="mt-1.5 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Thumbs up"
              aria-pressed={selected === "up"}
              onClick={handle("up")}
            >
              <ThumbsUp className="size-3" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Thumbs down"
              aria-pressed={selected === "down"}
              onClick={handle("down")}
            >
              <ThumbsDown className="size-3" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    )
  },
)

export { CoachMessage }
