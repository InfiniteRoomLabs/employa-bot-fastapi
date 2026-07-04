/**
 * Outcome reason picker (D16 / DEC-041). The user tier is exactly 8 toggleable
 * chips; the system tier (auto-applied reasons) renders separately and read-only,
 * never counted against the 8. Used by the withdraw / reject flows.
 */

import { Chip } from "@/components/ui/chip"
import { REASON_CHIPS_SYSTEM, REASON_CHIPS_USER } from "@/data/fixtures"

export interface ReasonChipSelectorProps {
  selected: readonly string[]
  onChange: (next: readonly string[]) => void
  /** Show the read-only system-reason tier below the user chips. */
  showSystemTier?: boolean
}

export function ReasonChipSelector({
  selected,
  onChange,
  showSystemTier,
}: ReasonChipSelectorProps) {
  const toggle = (reason: string) => {
    onChange(
      selected.includes(reason)
        ? selected.filter((current) => current !== reason)
        : [...selected, reason],
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
          Reason
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Outcome reasons"
        >
          {REASON_CHIPS_USER.map((reason) => (
            <Chip
              key={reason}
              pressed={selected.includes(reason)}
              onPressedChange={() => toggle(reason)}
            >
              {reason}
            </Chip>
          ))}
        </div>
      </div>

      {showSystemTier ? (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
            System reasons
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REASON_CHIPS_SYSTEM.map((reason) => (
              <Chip
                key={reason}
                pressed={false}
                variant="default"
                className="pointer-events-none opacity-70"
              >
                {reason}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
