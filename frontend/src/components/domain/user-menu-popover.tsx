import {
  Gift,
  Keyboard,
  LifeBuoy,
  LogOut,
  Settings2,
  Sparkles,
} from "lucide-react"
import type * as React from "react"

import { Avatar } from "@/components/ui/avatar-eb"
import { Badge } from "@/components/ui/badge-eb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UserMenuRow } from "@/data/types"
import { useCurrentUser, useUserMenu } from "@/hooks"
import { cn } from "@/lib/utils"

const ICON_BY_KEY: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "settings-2": Settings2,
  keyboard: Keyboard,
  sparkles: Sparkles,
  "life-buoy": LifeBuoy,
  gift: Gift,
}

export interface UserMenuPopoverProps {
  /** Trigger element — usually the user pod avatar. Wrapped with DropdownMenuTrigger. */
  trigger: React.ReactNode
  /** Optional click handler for a menu row. */
  onSelect?: (row: UserMenuRow) => void
  /** Optional sign-out click handler. */
  onSignOut?: () => void
}

/**
 * User menu popover composing shadcn `DropdownMenu` + the user-menu row
 * config from `useUserMenu()`. Header is driven by `useCurrentUser()`.
 * Renders a sign-out row pinned at the bottom of the menu.
 */
export function UserMenuPopover({
  trigger,
  onSelect,
  onSignOut,
}: UserMenuPopoverProps) {
  const user = useCurrentUser()
  const menu = useUserMenu()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-[320px] p-0"
        data-slot="user-menu-popover"
      >
        <DropdownMenuLabel className="border-b border-border p-3.5">
          <div className="flex items-center gap-3">
            <Avatar name={user.data?.name ?? "EB"} accent size="lg" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                {user.data?.name ?? "Loading…"}
              </span>
              <span className="truncate text-xs text-[var(--fg-subtle)]">
                {user.data?.email ?? ""}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        {menu.isLoading ? (
          <div
            data-slot="user-menu-popover-loading"
            className="px-4 py-4 text-xs text-[var(--fg-subtle)]"
          >
            Loading…
          </div>
        ) : null}
        {menu.error ? (
          <div
            role="alert"
            data-slot="user-menu-popover-error"
            className="bg-[var(--danger-soft)] px-4 py-3 text-xs text-[var(--danger-text)]"
          >
            Failed to load menu: {menu.error.message}
          </div>
        ) : null}
        {!menu.isLoading && !menu.error
          ? (menu.data ?? []).map((row) => (
              <UserMenuItem
                key={row.icon}
                row={row}
                onSelect={() => onSelect?.(row)}
              />
            ))
          : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="gap-2 px-4 py-3"
          onSelect={() => onSignOut?.()}
        >
          <LogOut className="size-3.5" aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenuItem({
  row,
  onSelect,
}: {
  row: UserMenuRow
  onSelect: () => void
}) {
  const Icon = ICON_BY_KEY[row.icon] ?? Settings2
  return (
    <DropdownMenuItem
      className={cn("flex items-center gap-3 border-t border-border px-4 py-3")}
      onSelect={onSelect}
    >
      <Icon className="size-3.5 text-[var(--fg-muted)]" aria-hidden />
      <div className="flex flex-col">
        <span className="text-[13px] font-medium">{row.label}</span>
        <span className="text-[11.5px] text-[var(--fg-subtle)]">
          {row.sublabel}
        </span>
      </div>
      {row.badge ? (
        <Badge variant="accent" className="ml-auto">
          {row.badge}
        </Badge>
      ) : null}
      {row.meta ? (
        <DropdownMenuShortcut>{row.meta}</DropdownMenuShortcut>
      ) : null}
    </DropdownMenuItem>
  )
}
