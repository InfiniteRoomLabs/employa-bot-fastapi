import { Bell, CalendarDays, Mail, Sparkles, Star } from "lucide-react"
import type * as React from "react"
import type { Notification, NotificationKind } from "@/data/types"
import { cn } from "@/lib/utils"

function KindIcon({ kind }: { kind: NotificationKind }) {
  switch (kind) {
    case "reply":
      return <Mail className="size-[13px]" />
    case "agent":
      return <Sparkles className="size-[13px]" />
    case "match":
      return <Star className="size-[13px]" />
    case "cal":
      return <CalendarDays className="size-[13px]" />
    default:
      return <Bell className="size-[13px]" />
  }
}

export interface NotificationRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Notification to render. */
  notification: Notification
  /** Click handler — receives the notification. */
  onSelect?: (n: Notification) => void
}

/**
 * Single row inside `NotificationsPopover`. Pulled into its own file to
 * keep `notifications-popover.tsx` under the 150-line budget. Lives in
 * `domain/` because the popover's inline notification row is its only
 * caller (per the inventory's "NotificationRow stays inline" guidance —
 * inline-to-the-popover).
 */
export function NotificationRow({
  className,
  notification,
  onSelect,
  ...props
}: NotificationRowProps) {
  return (
    <div
      data-slot="notification-row"
      data-unread={notification.unread ? "true" : undefined}
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(notification)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect?.(notification)
        }
      }}
      className={cn(
        "flex cursor-pointer gap-3 border-t border-border px-4 py-3 first:border-t-0",
        notification.unread ? "bg-[var(--accent-soft)]" : "bg-transparent",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)]"
      >
        <KindIcon kind={notification.kind} />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "mb-0.5 text-[13px]",
            notification.unread ? "font-semibold" : "font-medium",
          )}
        >
          {notification.title}
        </div>
        <div className="text-xs text-[var(--fg-muted)]">
          {notification.message}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
          {notification.actor}
        </span>
        {notification.unread ? (
          <span
            aria-label="unread"
            className="size-1.5 rounded-full bg-[var(--lime-500)]"
          />
        ) : null}
      </div>
    </div>
  )
}
