import * as React from "react"

import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Chip } from "@/components/ui/chip"
import {
  Popover,
  PopoverContentWithCaret,
  PopoverTrigger,
} from "@/components/ui/popover-with-caret"
import type { Notification, NotificationKind } from "@/data/types"
import { useNotifications } from "@/hooks"
import { cn } from "@/lib/utils"

import { NotificationRow } from "./notification-row"

const FILTERS: ReadonlyArray<{ id: "all" | NotificationKind; label: string }> =
  [
    { id: "all", label: "All" },
    { id: "reply", label: "Replies" },
    { id: "agent", label: "Agents" },
    { id: "match", label: "Matches" },
  ]

export interface NotificationsPopoverProps {
  /** Trigger element — usually a bell icon button. Wrapped with PopoverTrigger. */
  trigger: React.ReactNode
  /** Optional click handler — receives the clicked notification. */
  onSelect?: (n: Notification) => void
  /** Optional "Mark all read" click handler. */
  onMarkAllRead?: () => void
  /**
   * ORI-012: Optional data override. When supplied by the parent (e.g. Topbar
   * which already calls useNotifications for the bell-dot), the popover uses
   * this array instead of calling its own hook instance. This keeps the
   * bell-dot and the popover badge in sync on the same underlying state.
   */
  items?: readonly Notification[]
}

/**
 * Notifications popover. Composes `Popover` + caret + filter chips +
 * scrollable list of {@link NotificationRow} entries. Fetches data via
 * `useNotifications()` when no `items` override is provided; renders
 * skeleton/error fallbacks while loading or on failure.
 *
 * ORI-012: When `items` is supplied by the parent the internal hook call is
 * still made but its data is shadowed -- the hook is needed for error/loading
 * state when the parent has not yet resolved.
 */
export function NotificationsPopover({
  trigger,
  onSelect,
  onMarkAllRead,
  items: itemsOverride,
}: NotificationsPopoverProps) {
  const { data, error, isLoading } = useNotifications()
  const [filter, setFilter] = React.useState<"all" | NotificationKind>("all")

  // ORI-012: prefer the parent-supplied override so bell-dot and popover badge
  // share the same data reference. Fall back to hook data when no override.
  const items = itemsOverride ?? data ?? []
  const filtered =
    filter === "all"
      ? items
      : items.filter((notification) => notification.kind === filter)
  const unread = items.filter((notification) => notification.unread).length

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContentWithCaret
        align="end"
        caret="top"
        className="w-[400px] p-0"
        data-slot="notifications-popover"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          <h3 className="m-0 text-sm font-semibold">Notifications</h3>
          {unread > 0 ? <Badge variant="accent">{unread} unread</Badge> : null}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={onMarkAllRead}
          >
            Mark all read
          </Button>
        </div>
        <div className="flex gap-1.5 border-b border-border bg-[var(--bg-subtle)] p-2.5">
          {FILTERS.map((filterOption) => (
            <Chip
              key={filterOption.id}
              variant="accent"
              pressed={filter === filterOption.id}
              onPressedChange={() => setFilter(filterOption.id)}
            >
              {filterOption.label}
            </Chip>
          ))}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? <NotificationsSkeleton /> : null}
          {error ? <NotificationsError message={error.message} /> : null}
          {!isLoading && !error && filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[var(--fg-subtle)]">
              No notifications
            </div>
          ) : null}
          {!isLoading && !error
            ? filtered.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onSelect={onSelect}
                />
              ))
            : null}
        </div>
      </PopoverContentWithCaret>
    </Popover>
  )
}

function NotificationsSkeleton() {
  return (
    <div
      data-slot="notifications-popover-loading"
      className="flex items-center gap-2 px-4 py-6 text-xs text-[var(--fg-subtle)]"
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-3 animate-pulse rounded-full bg-[var(--bg-muted)]",
        )}
      />
      Loading notifications…
    </div>
  )
}

function NotificationsError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      data-slot="notifications-popover-error"
      className="border-b border-border bg-[var(--danger-soft)] px-4 py-3 text-xs text-[var(--danger-text)]"
    >
      Failed to load notifications: {message}
    </div>
  )
}
