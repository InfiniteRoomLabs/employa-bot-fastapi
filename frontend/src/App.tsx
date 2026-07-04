/**
 * Application root - wires `react-router-dom` BrowserRouter + Routes
 * around the screen surface, mounts the Persona context provider, and
 * roots the global `<Toaster>`.
 *
 * Phases 0-8 built every screen self-wrapping in `<AppFrame>`, so the
 * router renders each `screen` element verbatim (no conditional frame
 * wrapping). The `bypassFrame` flag on `Route` rows is informational -
 * it documents which screens own their own chrome.
 *
 * `mark-won` is the one stacked route: it renders `<AppDetailScreen>`
 * underneath + `<MarkWonScreen>` (which is itself an always-open Dialog).
 */

import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { CoachPanel } from "@/components/coach/coach-panel"
import { CoachPanelProvider } from "@/components/coach/coach-panel-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/toast"
import { PersonaProvider } from "@/persona-context"
import { ROUTES } from "@/routes"
import AppDetailScreen from "@/screens/app-detail"
import MarkWonScreen from "@/screens/mark-won"

const NotFoundScreen = lazy(() => import("@/screens/not-found"))

function App() {
  return (
    <BrowserRouter>
      <PersonaProvider>
        <CoachPanelProvider>
          <Suspense fallback={<Skeleton className="h-screen w-full" />}>
            <Routes>
              {/* Root redirect -- `/` sends to the Dashboard. Declared first so
                it wins before the route-table map + catch-all. */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              {ROUTES.map((route) => {
                // Skip the catch-all entry from ROUTES.map -- we add it explicitly
                // below so it is always the LAST Route in the tree.
                if (route.id === "not-found") {
                  return null
                }

                // The mark-won stacked route renders AppDetail underneath
                // the always-open Mark-Won dialog. Composing in the route
                // element keeps the single-source-of-truth route table honest.
                if (route.id === "mark-won") {
                  return (
                    <Route
                      key={route.id}
                      path={route.path}
                      element={
                        <>
                          <AppDetailScreen />
                          <MarkWonScreen />
                        </>
                      }
                    />
                  )
                }
                const Screen = route.screen
                return (
                  <Route
                    key={route.id}
                    path={route.path}
                    element={<Screen />}
                  />
                )
              })}
              {/* Catch-all -- must be the final Route */}
              <Route path="*" element={<NotFoundScreen />} />
            </Routes>
          </Suspense>
          <Toaster />
          {/* COA-030: the one omnipresent Coach panel, mounted once. */}
          <CoachPanel />
        </CoachPanelProvider>
      </PersonaProvider>
    </BrowserRouter>
  )
}

export default App
