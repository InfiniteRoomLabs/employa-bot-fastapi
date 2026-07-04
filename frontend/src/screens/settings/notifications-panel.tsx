/**
 * Notifications panel for the Settings screen (AUTH-024).
 *
 * Per-category rows, each with:
 *   - Email toggle (may be locked ON for transactional/security category)
 *   - In-app toggle (absent for monthly-digest category which is email-only)
 *
 * Categories (in order from SETTINGS_NOTIFICATION_PREFS fixture):
 *   1. Transactional / security -- email locked ON, in-app optional
 *   2. Agent approval / proposed transitions -- both toggles
 *   3. Coach prompts -- both toggles
 *   4. Monthly digest -- email toggle only (in-app N/A)
 *   5. Stale / ghost nudges -- both toggles + note about stale-threshold config location
 *
 * State flows up via onChange to index.tsx which patches Settings.notifPrefs,
 * feeding the sticky save-bar (AC3).
 */

import { InfoIcon, LockIcon } from "lucide-react"

import { Card } from "@/components/ui/card-eb"
import { Switch } from "@/components/ui/switch"
import type { NotifPref } from "@/data/types"

import { SectionHeading } from "./section-heading"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NotificationsPanelProps {
  value: readonly NotifPref[]
  onChange: (next: readonly NotifPref[]) => void
}

// Email-only categories have no in-app toggle (the monthly digest and the
// dead-month check-in, D5 -- both share the monthly email slot).
const EMAIL_ONLY_IDS = new Set(["monthly-digest", "dead-month-checkin"])
// Stale/ghost nudges get a callout note linking to threshold config.
const STALE_NUDGE_ID = "stale-ghost-nudges"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationsPanel({
  value,
  onChange,
}: NotificationsPanelProps) {
  const setField = (
    id: string,
    field: "emailEnabled" | "inAppEnabled",
    on: boolean,
  ) => {
    onChange(
      value.map((row) => (row.id === id ? { ...row, [field]: on } : row)),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Notifications"
        subtitle="Control which events reach you by email and in-app."
      />

      {/* Column header row */}
      <div className="grid grid-cols-[1fr_80px_80px] items-center gap-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
        <span>Category</span>
        <span className="text-right">Email</span>
        <span className="text-right">In-app</span>
      </div>

      <div className="flex flex-col gap-2">
        {value.map((row) => {
          const isEmailOnly = EMAIL_ONLY_IDS.has(row.id)
          const isStale = row.id === STALE_NUDGE_ID
          const emailSwitchId = `notif-email-${row.id}`
          const inAppSwitchId = `notif-inapp-${row.id}`

          return (
            <Card key={row.id} className="flex flex-col gap-0 p-4">
              <div className="grid grid-cols-[1fr_80px_80px] items-center gap-3">
                {/* Category text */}
                <div>
                  <p className="text-sm font-semibold">{row.category}</p>
                  {row.emailLocked ? (
                    <p className="mt-0.5 flex items-center gap-1 text-[12px] text-[var(--fg-subtle)]">
                      <LockIcon className="size-3" aria-hidden />
                      Required -- cannot be disabled
                    </p>
                  ) : null}
                </div>

                {/* Email toggle */}
                <div className="flex justify-end">
                  {row.emailLocked ? (
                    // Locked ON: render a disabled switch that is always checked
                    <Switch
                      id={emailSwitchId}
                      checked
                      disabled
                      aria-label={`${row.category} email (required)`}
                    />
                  ) : (
                    <Switch
                      id={emailSwitchId}
                      checked={row.emailEnabled}
                      onCheckedChange={(on) =>
                        setField(row.id, "emailEnabled", on)
                      }
                      aria-label={`${row.category} email notifications`}
                    />
                  )}
                </div>

                {/* In-app toggle (N/A for email-only categories) */}
                <div className="flex justify-end">
                  {isEmailOnly ? (
                    <span className="text-[12px] text-[var(--fg-subtle)]">
                      N/A
                    </span>
                  ) : (
                    <Switch
                      id={inAppSwitchId}
                      checked={row.inAppEnabled}
                      onCheckedChange={(on) =>
                        setField(row.id, "inAppEnabled", on)
                      }
                      aria-label={`${row.category} in-app notifications`}
                    />
                  )}
                </div>
              </div>

              {/* Consequence copy when a non-locked row is turned OFF */}
              {row.consequence &&
              !row.emailLocked &&
              !row.emailEnabled &&
              !row.inAppEnabled ? (
                <p className="mt-2 text-[12px] text-[var(--warn-text)]">
                  {row.consequence}
                </p>
              ) : null}

              {/* AUTH-024 AC4: stale nudges -- note about threshold config location */}
              {isStale ? (
                <p className="mt-2 flex items-start gap-1.5 text-[12px] text-[var(--fg-muted)]">
                  <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
                  Stale threshold (days before nudge) is configured in the
                  search criteria for each saved search.
                </p>
              ) : null}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
