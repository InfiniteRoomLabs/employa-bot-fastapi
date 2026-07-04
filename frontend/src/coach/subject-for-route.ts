/**
 * COA-031: derive the Coach "subject" (what the user is looking at) from the
 * current route. Reuses `idForPath` from the route table (single source of
 * truth) and maps the picker id to a CoachThreadScope. The subject only tunes
 * the panel's greeting + suggested chips -- it NEVER limits what Coach can do.
 */

import type { CoachSubject, CoachThreadScope } from "@/data/types"
import { idForPath } from "@/routes"

const SCOPE_BY_ROUTE_ID: Readonly<
  Record<string, { scope: CoachThreadScope; label: string }>
> = {
  "app-detail": { scope: "application", label: "this application" },
  applications: { scope: "application", label: "your applications" },
  "mark-won": { scope: "application", label: "this application" },
  "search-applications": { scope: "application", label: "these applications" },
  resumes: { scope: "résumé", label: "your resumes" },
  "resume-editor": { scope: "résumé", label: "this resume" },
  "resume-editor-param": { scope: "résumé", label: "this resume" },
  "resume-preview": { scope: "résumé", label: "this resume" },
  "match-explorer": { scope: "résumé", label: "this resume" },
  contacts: { scope: "contact", label: "your contacts" },
  accomplishments: { scope: "accomplishment", label: "your accomplishments" },
  answers: { scope: "answer", label: "your answers" },
  projects: { scope: "project", label: "your projects" },
  coach: { scope: "general", label: "your search" },
}

export function subjectForRoute(pathname: string): CoachSubject {
  const id = idForPath(pathname)
  const hit = id ? SCOPE_BY_ROUTE_ID[id] : undefined
  if (hit) {
    return { scope: hit.scope, label: hit.label }
  }
  return { scope: "general", label: "your search" }
}
