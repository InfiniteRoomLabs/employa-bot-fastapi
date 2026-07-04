/**
 * Test/story helper: build a full `ApplicationView` from display overrides.
 * After ADR-006 stage 3 the stored `Application` holds only ids, so mocks must
 * supply the joined view shape. This wraps the display fields in a minimal Job.
 */

import type {
  ApplicationFlag,
  ApplicationSource,
  ApplicationView,
  Salary,
  Stage,
} from "@/data/types"

export interface MockApplicationOverrides {
  id?: string
  company?: string
  role?: string
  location?: string
  salary?: Salary | null
  match?: number
  source?: ApplicationSource
  resumeName?: string
  stage?: Stage
  stageLabel?: string
  days?: number
  flag?: ApplicationFlag
  resurrected?: boolean
}

export function mockApplicationView(
  overrides: MockApplicationOverrides = {},
): ApplicationView {
  const id = overrides.id ?? "stripe"
  const company = overrides.company ?? "Stripe"
  const role = overrides.role ?? "Staff Engineer, Payments core"
  const location = overrides.location ?? "Remote - US"
  const salary =
    overrides.salary === undefined
      ? { min: 255000, max: 305000, extra: [] }
      : overrides.salary
  const match = overrides.match ?? 92
  const source = overrides.source ?? "greenhouse"
  const jobId = `${id}-job`
  return {
    id,
    jobId,
    resumeId: null,
    stage: overrides.stage ?? "applied",
    stageLabel: overrides.stageLabel ?? "Applied",
    days: overrides.days ?? 9,
    flag: overrides.flag,
    resurrected: overrides.resurrected,
    job: {
      id: jobId,
      company,
      title: role,
      location: { raw: location },
      workMode: "onsite",
      employment: {
        classification: "w2",
        cadence: "salary",
        commitment: "full-time",
      },
      compensation: salary,
      source: {
        board: source,
        channel: "url",
        capturedAt: "captured when you applied",
      },
      posted: `${overrides.days ?? 9}d ago`,
      match: { score: match, strengths: [], gaps: [] },
    },
    resume: null,
    company,
    role,
    location,
    salary,
    match,
    source,
    resumeName: overrides.resumeName ?? "Distributed-systems v4",
  }
}
