/**
 * Profile panel for the Settings screen. Edits `profile` slice of
 * `Settings`. Matches `/tmp/employa-design/src/screens/settings.jsx ::
 * SetProfile`: avatar tile + 2-col name/email/phone/timezone grid,
 * then a "Job-seeker context" card with current role, target-titles
 * chip row, and compensation floor.
 *
 * Field rules (beyond the design):
 *   - Phone: auto-formats as `(NNN) NNN-NNNN` while typing; the same
 *     formatter is re-applied on blur so any pasted/partial value is
 *     normalised. Non-digit input is dropped silently.
 *   - Email: validated against a standard pattern. The inline error
 *     surfaces below the field once the user has edited (touched) it.
 *   - Timezone: replaced with a shadcn `<Select>` whose option list is
 *     a curated IANA shortlist (LA, Denver, Chicago, NY, London,
 *     Berlin, Tokyo, Sydney, UTC).
 */

import * as React from "react"
import { FormField } from "@/components/atoms/form-field"
import { Card } from "@/components/ui/card-eb"
import { Chip } from "@/components/ui/chip"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Settings } from "@/data/types"

import { SectionHeading } from "./section-heading"

export interface ProfilePanelProps {
  /** Editable profile slice. */
  value: Settings["profile"]
  /** Patch a subset of the profile slice. */
  onChange: (patch: Partial<Settings["profile"]>) => void
}

/** Curated IANA timezones offered in the Profile timezone select. The user
 *  may have any string in storage; if the current value is outside this
 *  list it falls back to the raw value rendered as the trigger label. */
const TIMEZONE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "America/Los_Angeles", label: "America / Los Angeles (Pacific)" },
  { value: "America/Denver", label: "America / Denver (Mountain)" },
  { value: "America/Chicago", label: "America / Chicago (Central)" },
  { value: "America/New_York", label: "America / New York (Eastern)" },
  { value: "Europe/London", label: "Europe / London" },
  { value: "Europe/Berlin", label: "Europe / Berlin" },
  { value: "Asia/Tokyo", label: "Asia / Tokyo" },
  { value: "Australia/Sydney", label: "Australia / Sydney" },
  { value: "UTC", label: "UTC" },
]

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i

/** Build the avatar initials from a name (`Wes Gilleland -> WG`). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || parts[0] === "") {
    return ""
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Format a string of digits/junk into US-shaped phone, partial allowed.
 *  Examples: `5105550142` -> `(510) 555-0142`, `51055` -> `(510) 55`. */
// eslint-disable-next-line react-refresh/only-export-components
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10)
  if (digits.length === 0) {
    return ""
  }
  if (digits.length <= 3) {
    return `(${digits}`
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/** True when the email matches a simple but standard pattern. Empty
 *  strings are considered valid so the field doesn't yell on first
 *  paint. */
// eslint-disable-next-line react-refresh/only-export-components
export function isEmailValid(email: string): boolean {
  if (email.length === 0) {
    return true
  }
  return EMAIL_RE.test(email)
}

export function ProfilePanel({ value, onChange }: ProfilePanelProps) {
  const [emailTouched, setEmailTouched] = React.useState(false)
  const emailValid = isEmailValid(value.email)
  const showEmailError = emailTouched && !emailValid

  // AUTH-032: inline add-a-target-role flow. Clicking "+ Add" reveals an input;
  // Enter (or blur with text) appends a deduped, non-empty title.
  const [addingRole, setAddingRole] = React.useState(false)
  const [draftRole, setDraftRole] = React.useState("")

  function commitDraftRole() {
    const trimmed = draftRole.trim()
    if (trimmed && !value.targetTitles.includes(trimmed)) {
      onChange({ targetTitles: [...value.targetTitles, trimmed] })
    }
    setDraftRole("")
    setAddingRole(false)
  }

  function removeTargetRole(roleToRemove: string) {
    onChange({
      targetTitles: value.targetTitles.filter(
        (title) => title !== roleToRemove,
      ),
    })
  }

  const handlePhoneChange = (raw: string) => {
    // Always store the formatted version so the dirty-check + display
    // are consistent. The formatter accepts partial input.
    onChange({ phone: formatPhone(raw) })
  }

  const handlePhoneBlur = (raw: string) => {
    onChange({ phone: formatPhone(raw) })
  }

  const knownTzValues = React.useMemo(
    () => new Set(TIMEZONE_OPTIONS.map((option) => option.value)),
    [],
  )
  const tzValue = knownTzValues.has(value.timezone) ? value.timezone : undefined

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Profile"
        subtitle="Your account and job-seeker context."
      />
      <Card className="p-6">
        <div className="flex gap-5">
          <div
            aria-hidden
            className="grid size-[72px] place-items-center rounded-full border-2 border-border bg-[var(--accent)] text-[22px] font-semibold text-[var(--fg-on-accent)]"
          >
            {initialsOf(value.name)}
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3">
            <FormField label="Name">
              <Input
                value={value.name}
                onChange={(event) => onChange({ name: event.target.value })}
                aria-label="Name"
              />
            </FormField>
            <FormField
              label="Email"
              helper={
                showEmailError ? "Enter a valid email address." : undefined
              }
            >
              <Input
                type="email"
                value={value.email}
                onChange={(event) => onChange({ email: event.target.value })}
                onBlur={() => setEmailTouched(true)}
                aria-label="Email"
                aria-invalid={showEmailError ? "true" : undefined}
                aria-describedby={
                  showEmailError ? "profile-email-error" : undefined
                }
                data-testid="profile-email"
              />
              {showEmailError ? (
                <p
                  id="profile-email-error"
                  data-testid="profile-email-error"
                  className="mt-1 text-xs text-[var(--danger-text)]"
                >
                  Enter a valid email address.
                </p>
              ) : null}
            </FormField>
            <FormField label="Phone">
              <Input
                value={value.phone}
                onChange={(event) => handlePhoneChange(event.target.value)}
                onBlur={(event) => handlePhoneBlur(event.target.value)}
                aria-label="Phone"
                inputMode="tel"
                placeholder="(510) 555-0142"
                data-testid="profile-phone"
              />
            </FormField>
            <FormField label="Timezone">
              <Select
                value={tzValue}
                onValueChange={(value) => onChange({ timezone: value })}
              >
                <SelectTrigger
                  aria-label="Timezone"
                  data-testid="profile-timezone"
                  className="w-full"
                >
                  <SelectValue
                    placeholder={value.timezone || "Select timezone"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((timezoneOption) => (
                    <SelectItem
                      key={timezoneOption.value}
                      value={timezoneOption.value}
                    >
                      {timezoneOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </div>
      </Card>

      <SectionHeading
        title="Job-seeker context"
        subtitle="The coach uses this to personalize advice. Optional but recommended."
      />
      <Card className="p-6">
        <div className="flex flex-col gap-4">
          <FormField label="Current role">
            <Input
              value={value.currentRole}
              onChange={(event) =>
                onChange({ currentRole: event.target.value })
              }
              aria-label="Current role"
            />
          </FormField>
          <FormField label="Target roles">
            <div className="flex flex-wrap gap-1.5">
              {value.targetTitles.map((title) => (
                <Chip
                  key={title}
                  variant="accent"
                  pressed
                  onPressedChange={(pressed) => {
                    if (!pressed) {
                      removeTargetRole(title)
                    }
                  }}
                >
                  {title}
                </Chip>
              ))}
              {addingRole ? (
                <Input
                  autoFocus
                  value={draftRole}
                  onChange={(event) => setDraftRole(event.target.value)}
                  onBlur={commitDraftRole}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      commitDraftRole()
                    } else if (event.key === "Escape") {
                      setDraftRole("")
                      setAddingRole(false)
                    }
                  }}
                  placeholder="e.g. Staff Engineer"
                  aria-label="New target role"
                  className="h-7 w-44 text-[13px]"
                />
              ) : (
                <Chip
                  variant="dash"
                  aria-label="Add target role"
                  onClick={() => setAddingRole(true)}
                >
                  + Add
                </Chip>
              )}
            </div>
          </FormField>
          <FormField label="Compensation floor">
            <Input
              value={value.compFloor}
              onChange={(event) => onChange({ compFloor: event.target.value })}
              aria-label="Compensation floor"
              className="w-[200px] font-mono"
            />
          </FormField>
        </div>
      </Card>
    </div>
  )
}
