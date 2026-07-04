import { Bell, MessageSquareHeart, Search } from "lucide-react"
import * as React from "react"

import { BotPill } from "@/components/atoms/bot-pill"
import { ThemeToggle } from "@/components/atoms/theme-toggle"
import { useCoachPanel } from "@/components/coach/coach-panel-provider"
import { NotificationsPopover } from "@/components/domain/notifications-popover"
import { Button } from "@/components/ui/button-eb"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { useNotifications } from "@/hooks"
import { cn } from "@/lib/utils"
import { CommandPalette } from "./command-palette"

export interface TopbarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Screen title shown in the topbar's primary slot. */
  title: React.ReactNode
  /** Optional supporting line below the title. */
  subtitle?: React.ReactNode
  /** Trailing actions slot rendered after the theme toggle. */
  actions?: React.ReactNode
  /**
   * Optional click handler for the notifications bell. Phase 9 composes
   * `NotificationsPopover` inline so the bell opens in-place; the prop
   * is retained as an escape hatch for screens that want their own
   * click behaviour (e.g. analytics, override the popover entirely).
   * When supplied, the bell stays a plain button instead of mounting
   * the popover.
   */
  onOpenNotifications?: () => void
  /**
   * ORI-011: Optional controlled open state for the command palette.
   * When omitted, the topbar manages its own internal state.
   */
  paletteOpen?: boolean
  /**
   * ORI-011: Optional handler for palette open-state changes.
   * When `paletteOpen` is omitted, the internal handler is used.
   */
  onPaletteOpenChange?: (v: boolean) => void
}

/**
 * Sticky page header rendered above every screen body. Renders the
 * design's `.app__topbar` row: title/subtitle + global search input
 * (cmd-K opens command palette -- ORI-011), agent status pill (`BotPill`),
 * notifications bell with live unread indicator (ORI-012), theme toggle,
 * and a trailing `actions` slot.
 *
 * ORI-011: Search Input click and Cmd-K / Ctrl-K global keydown open the
 * CommandPalette; the palette navigates and closes on selection.
 *
 * ORI-012: Bell unread dot is derived from live useNotifications data.
 * The dot renders only when unread > 0. onMarkAllRead and onSelect are
 * wired through to NotificationsPopover so mutations update the same
 * hook instance. The bell aria-label reflects the live count.
 */
const Topbar = React.forwardRef<HTMLDivElement, TopbarProps>(function Topbar(
  {
    className,
    title,
    subtitle,
    actions,
    onOpenNotifications,
    paletteOpen: paletteOpenProp,
    onPaletteOpenChange,
    ...props
  },
  ref,
) {
  // ORI-011: Internal palette open state. When paletteOpenProp is provided,
  // the component becomes controlled; otherwise uses its own useState.
  const [internalPaletteOpen, setInternalPaletteOpen] = React.useState(false)
  const isPaletteControlled = paletteOpenProp !== undefined
  const paletteOpen = isPaletteControlled
    ? paletteOpenProp
    : internalPaletteOpen

  const handlePaletteOpenChange = React.useCallback(
    (v: boolean) => {
      if (!isPaletteControlled) {
        setInternalPaletteOpen(v)
      }
      onPaletteOpenChange?.(v)
    },
    [isPaletteControlled, onPaletteOpenChange],
  )

  const openPalette = React.useCallback(
    () => handlePaletteOpenChange(true),
    [handlePaletteOpenChange],
  )

  // ORI-011: Global Cmd-K / Ctrl-K listener
  React.useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault()
        openPalette()
      }
    }
    document.addEventListener("keydown", onKeydown)
    return () => document.removeEventListener("keydown", onKeydown)
  }, [openPalette])

  // ORI-012: Live notifications hook -- topbar is the single consumer.
  // The data + mutations are passed down to NotificationsPopover so both
  // the bell dot and the popover badge stay in sync without a dual-fetch.
  const { data: notifData, markAllRead, markRead } = useNotifications()
  const unreadCount = (notifData ?? []).filter(
    (notification) => notification.unread,
  ).length

  // ORI-012: mark-all-read handler wires hook mutation + success toast.
  const handleMarkAllRead = React.useCallback(async () => {
    try {
      await markAllRead()
      toast.success({ title: "All notifications marked read" })
    } catch {
      toast.error({
        title: "Could not mark all read",
        sub: "Try again in a moment",
      })
    }
  }, [markAllRead])

  // ORI-012: per-row mark-read handler.
  const handleNotificationSelect = React.useCallback(
    async (n: { id: string }) => {
      try {
        await markRead(n.id)
      } catch {
        // Non-critical - silent failure, badge will self-correct on next refetch
      }
    },
    [markRead],
  )

  // COA-030: summon the omnipresent Coach panel (also Cmd/Ctrl-J).
  const coach = useCoachPanel()

  // ORI-012: bell aria-label reflects live unread count for screen readers.
  const bellAriaLabel =
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"

  const bellTrigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="app__topbar-bell"
      aria-label={bellAriaLabel}
      onClick={onOpenNotifications}
    >
      <Bell className="size-3.5" aria-hidden />
      {/* ORI-012: dot only renders when there are unread notifications */}
      {unreadCount > 0 ? (
        <span className="app__topbar-bell__dot" aria-hidden />
      ) : null}
    </Button>
  )

  // ORI-012: bell mounts either as a plain override button or with the popover.
  const bell = onOpenNotifications ? (
    bellTrigger
  ) : (
    <NotificationsPopover
      trigger={bellTrigger}
      onMarkAllRead={handleMarkAllRead}
      onSelect={handleNotificationSelect}
      items={notifData}
    />
  )

  return (
    <div
      ref={ref}
      data-slot="topbar"
      className={cn("app__topbar", className)}
      {...props}
    >
      <div className="app__topbar-titles">
        <div className="app__topbar-title">{title}</div>
        {subtitle ? <div className="app__topbar-sub">{subtitle}</div> : null}
      </div>

      {/* ORI-019: the global search input is centered -- equal flexible
          spacers on each side push it to the middle of the bar.
          ORI-011: clicking it (or Cmd-K) opens the command palette. */}
      <div className="flex-1" />
      <div
        className="app__topbar-search"
        role="button"
        tabIndex={0}
        aria-label="Open command palette"
        onClick={openPalette}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openPalette()
          }
        }}
      >
        <span className="lucide-wrap" aria-hidden>
          <Search className="size-3.5" />
        </span>
        <Input
          type="search"
          aria-label="Global search"
          placeholder="Search applications, jobs, resumes..."
          className="eb-input pl-8 pr-12"
          readOnly
          style={{ cursor: "pointer", pointerEvents: "none" }}
        />
        <kbd>⌘K</kbd>
      </div>
      <div className="flex-1" />

      {/* ORI-019: utility cluster (agents-active pill + notifications bell +
          theme switcher) is grouped and right-aligned, after the centered
          search and before the trailing actions slot. */}
      <div className="flex items-center gap-2">
        <BotPill live>
          <span className="topbar__bot-count">3</span>
          <span>agents · watching your apps</span>
        </BotPill>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open Coach"
          onClick={coach.toggle}
        >
          <MessageSquareHeart className="size-3.5" aria-hidden />
        </Button>
        {bell}
        <ThemeToggle />
      </div>

      {actions}

      {/* ORI-011: CommandPalette is a Dialog overlay -- rendered as a sibling
          to the topbar content so it floats above the whole app. */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={handlePaletteOpenChange}
      />
    </div>
  )
})

export { Topbar }
