/**
 * Salary formatting + sort helpers.
 *
 * Compensation is stored structurally as integers (full dollars) -- a single
 * point or a min/max band -- plus an `extra` array of non-numeric qualifiers
 * (e.g. "+ 15% bonus", "+ equity", "GS-14", "/hr"). Display formatting happens
 * here, never at the fixture; sorting keys off the numeric part only, never the
 * `extra` qualifiers.
 */

import type { Salary } from "@/data/types"

/** Format a single dollar figure: thousands collapse to "k", sub-1k stays raw. */
function fmtNum(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`
}

/**
 * Human-readable compensation. `null` (undisclosed) renders as "--".
 * Range -> "$155k-$175k"; point -> "$148k"; qualifiers append: "$148k + 15% bonus".
 */
export function formatSalary(salary: Salary | null | undefined): string {
  if (!salary) {
    return "--"
  }
  const core =
    "min" in salary
      ? `${fmtNum(salary.min)}-${fmtNum(salary.max)}`
      : fmtNum(salary.value)
  return salary.extra.length ? `${core} ${salary.extra.join(" ")}` : core
}

/**
 * Comparable numeric key for sorting. Uses the band floor (or the point value).
 * Undisclosed salaries fall to the bottom (-1) so blanks cluster at one end.
 * The `extra` qualifiers are deliberately never part of the sort.
 */
export function salaryValue(salary: Salary | null | undefined): number {
  if (!salary) {
    return -1
  }
  return "min" in salary ? salary.min : salary.value
}
