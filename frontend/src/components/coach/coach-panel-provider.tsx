/**
 * CoachPanelProvider (COA-030/031). Mounts ONCE in App.tsx, above the router.
 * Owns the omnipresent Coach panel's open/collapsed state and the live
 * "subject" derived from the current route. A single instance means one
 * assistant identity whose state survives navigation.
 *
 * Do NOT mount <CoachPanel> or this provider anywhere else -- one instance only.
 *
 * `useCoachPanel()` returns a safe no-op shape when no provider is present, so
 * Topbar can call it inside isolated stories/tests without a provider wrapper.
 */

import * as React from "react"
import { useLocation } from "react-router-dom"

import { subjectForRoute } from "@/coach/subject-for-route"
import type { CoachSubject } from "@/data/types"

interface CoachPanelContextValue {
  isOpen: boolean
  subject: CoachSubject
  open: () => void
  close: () => void
  toggle: () => void
}

const NOOP_SUBJECT: CoachSubject = { scope: "general", label: "your search" }

const CoachPanelContext = React.createContext<CoachPanelContextValue | null>(
  null,
)

export function CoachPanelProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const location = useLocation()
  const [isOpen, setIsOpen] = React.useState(false)
  const subject = React.useMemo(
    () => subjectForRoute(location.pathname),
    [location.pathname],
  )

  const open = React.useCallback(() => setIsOpen(true), [])
  const close = React.useCallback(() => setIsOpen(false), [])
  const toggle = React.useCallback(() => setIsOpen((v) => !v), [])

  // COA-030: global summon hotkey (Cmd/Ctrl-J), mirroring the Cmd-K palette.
  React.useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "j") {
        event.preventDefault()
        toggle()
      }
    }
    document.addEventListener("keydown", onKeydown)
    return () => document.removeEventListener("keydown", onKeydown)
  }, [toggle])

  const value = React.useMemo<CoachPanelContextValue>(
    () => ({ isOpen, subject, open, close, toggle }),
    [isOpen, subject, open, close, toggle],
  )

  return (
    <CoachPanelContext.Provider value={value}>
      {children}
    </CoachPanelContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCoachPanel(): CoachPanelContextValue {
  const ctx = React.useContext(CoachPanelContext)
  if (ctx) {
    return ctx
  }
  // No-op fallback for isolated stories/tests rendered without the provider.
  return {
    isOpen: false,
    subject: NOOP_SUBJECT,
    open: () => {},
    close: () => {},
    toggle: () => {},
  }
}
