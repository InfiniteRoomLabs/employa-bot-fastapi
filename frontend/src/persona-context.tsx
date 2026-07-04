/**
 * Persona Context — exposes the current user via React Context so screens
 * + shell components can read it without each one calling `useCurrentUser()`.
 *
 * The provider is intentionally minimal (≤30 lines): it owns the hook call
 * and republishes the `HookState<User>` shape verbatim. Consumers that need
 * just the user can use `useCurrentPersona()`; consumers needing loading /
 * error state can read the full state via `usePersonaState()`.
 *
 * Wiring goal: Phase 9 mounts the provider once in `App.tsx`. Future screens
 * (settings, user-menu, topbar greeting) consume here instead of re-fetching.
 */

import * as React from "react"
import type { User } from "@/data/types"
import { useCurrentUser } from "@/hooks"
import type { HookState } from "@/hooks/_use-async-resource"

const PersonaContext = React.createContext<HookState<User> | null>(null)

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const state = useCurrentUser()
  return (
    <PersonaContext.Provider value={state}>{children}</PersonaContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePersonaState(): HookState<User> {
  const ctx = React.useContext(PersonaContext)
  if (!ctx) {
    throw new Error("usePersonaState must be used within <PersonaProvider>")
  }
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrentPersona(): User | undefined {
  return usePersonaState().data
}
