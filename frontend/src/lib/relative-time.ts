/**
 * Hybrid relative-time formatting (ORI-020).
 *
 * Within the last week, time reads as a spelled-out relative phrase
 * ("Today", "Yesterday", "3 days ago"); beyond a week it reads as an absolute
 * short date ("Mar 1"). Replaces the terse `yday` / `2d` shorthand the design
 * shipped with.
 *
 * Two entry points:
 * - `formatRelativeTime(daysAgo)` -- for real day-counts (e.g. `Application.days`).
 * - `humanizeTimeLabel(label)` -- normalizes the legacy shorthand display
 *   strings still carried by fixtures (`yday` -> `Yesterday`, `2d ago` ->
 *   `2 days ago`) until the data carries real timestamps.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

/**
 * Spelled-out relative phrase for a day-count, falling back to an absolute
 * short date past a week. `now` is injectable so the function stays pure and
 * testable (defaults to the current date in app runtime).
 */
export function formatRelativeTime(
  daysAgo: number,
  now: Date = new Date(),
): string {
  if (!Number.isFinite(daysAgo) || daysAgo < 0) {
    return ""
  }
  if (daysAgo === 0) {
    return "Today"
  }
  if (daysAgo === 1) {
    return "Yesterday"
  }
  if (daysAgo < 7) {
    return `${daysAgo} days ago`
  }
  const then = new Date(now)
  then.setDate(then.getDate() - daysAgo)
  return `${MONTHS[then.getMonth()]} ${then.getDate()}`
}

/**
 * Normalize a legacy shorthand display label to its spelled-out form. Leaves
 * already-human labels untouched. Handles an optional trailing clock time
 * ("yday 18:43" -> "Yesterday 18:43").
 */
export function humanizeTimeLabel(label: string): string {
  const trimmed = label.trim()

  // "yday" / "yday 18:43"
  const yesterday = trimmed.match(/^yday(\s+(.+))?$/i)
  if (yesterday) {
    return yesterday[2] ? `Yesterday ${yesterday[2]}` : "Yesterday"
  }

  // "2d ago" / "2d" -> "2 days ago"; "1d" -> "Yesterday"
  const days = trimmed.match(/^(\d+)d(\s+ago)?$/i)
  if (days) {
    const count = Number(days[1])
    if (count === 1) {
      return "Yesterday"
    }
    return `${count} days ago`
  }

  // "1h" / "12m" stay terse (sub-day); "now" / "just now" already human.
  return label
}
