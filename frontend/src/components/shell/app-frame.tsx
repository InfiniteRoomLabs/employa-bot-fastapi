import * as React from "react"

import { cn } from "@/lib/utils"

import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

export interface AppFrameProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Active screen id forwarded to `Sidebar` for nav highlight. */
  active?: string
  /** Topbar title shown in the sticky header. */
  title: React.ReactNode
  /** Optional supporting copy below the title in the topbar. */
  subtitle?: React.ReactNode
  /** Trailing slot in the topbar (after the theme toggle). */
  topbarActions?: React.ReactNode
  /**
   * Render the page in bleed mode (`.app__page--bleed`) — full-width, no
   * inner padding, used by canvas-style screens (kanban, agent log).
   */
  bleed?: boolean
  /** Click handler for the notifications bell button in the topbar. */
  onOpenNotifications?: () => void
  /** Page body. */
  children: React.ReactNode
}

/**
 * Top-level layout chrome composing `Sidebar` + `Topbar` + a main page
 * slot. Switches the page wrapper class to `.app__page--bleed` when
 * `bleed` is set. Mirrors the design's `data-screen-label` attribute on
 * the inner column so screen-aware styling/QA hooks keep working.
 */
const AppFrame = React.forwardRef<HTMLDivElement, AppFrameProps>(
  function AppFrame(
    {
      className,
      active,
      title,
      subtitle,
      topbarActions,
      bleed,
      onOpenNotifications,
      children,
      ...props
    },
    ref,
  ) {
    // `data-screen-label` only accepts a string; coerce when possible and
    // omit otherwise so React doesn't render `[object Object]` into the
    // attribute when callers pass JSX as the title.
    const screenLabel =
      typeof title === "string" || typeof title === "number"
        ? String(title)
        : undefined
    return (
      <div
        ref={ref}
        data-slot="app-frame"
        className={cn("app", className)}
        {...props}
      >
        <Sidebar active={active} />
        <div className="app__main" data-screen-label={screenLabel}>
          <Topbar
            title={title}
            subtitle={subtitle}
            actions={topbarActions}
            onOpenNotifications={onOpenNotifications}
          />
          <div
            data-slot="app-frame-page"
            data-bleed={bleed ? "true" : undefined}
            className={bleed ? "app__page app__page--bleed" : "app__page"}
          >
            {children}
          </div>
        </div>
      </div>
    )
  },
)

export { AppFrame }
