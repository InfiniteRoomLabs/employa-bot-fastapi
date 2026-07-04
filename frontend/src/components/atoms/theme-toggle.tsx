import { Moon, Sun } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button-eb"
import { cn } from "@/lib/utils"
import { getTheme, type Theme, toggleTheme } from "@/styles/theme"

export interface ThemeToggleProps {
  /** Additional class on the underlying button. */
  className?: string
}

/**
 * Icon-only button that flips between light and dark themes. Wraps the
 * extended `Button` (`ghost` variant, `icon` size) and delegates state
 * to `toggleTheme()` in `styles/theme.ts`. Initial icon is keyed off
 * `getTheme()`; subsequent flips update local state so the icon swaps
 * without a re-mount.
 */
function ThemeToggle({ className }: ThemeToggleProps) {
  // Lazy init reads the current `data-theme` attribute at first render.
  // Subsequent clicks update local state alongside the DOM via the
  // `toggleTheme` helper; we do not subscribe to external mutations of
  // `data-theme` because the design archive only flips it via this
  // component and the auto-binder in `styles/theme.ts`.
  const [theme, setTheme] = React.useState<Theme>(() => getTheme())

  const handleClick = React.useCallback(() => {
    const next = toggleTheme()
    setTheme(next)
  }, [])

  const isDark = theme === "dark"
  const label = isDark ? "Switch to light theme" : "Switch to dark theme"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-slot="theme-toggle"
      data-theme={theme}
      aria-label={label}
      aria-pressed={isDark}
      onClick={handleClick}
      className={cn(className)}
    >
      {isDark ? (
        <Sun aria-hidden className="size-4" />
      ) : (
        <Moon aria-hidden className="size-4" />
      )}
    </Button>
  )
}

export { ThemeToggle }
