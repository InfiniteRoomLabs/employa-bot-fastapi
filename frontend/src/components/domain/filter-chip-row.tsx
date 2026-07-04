import * as React from "react"

import { Chip } from "@/components/ui/chip"
import { cn } from "@/lib/utils"

export type FilterChipVariant = "default" | "accent" | "exclude"

export interface FilterChipDef {
  /** Stable id used as the controlled value and React key. */
  id: string
  /** Visible label. */
  label: string
  /** Visual variant of the underlying `Chip`. Defaults to `default`. */
  variant?: FilterChipVariant
  /** Optional trailing count. */
  count?: number
}

export interface FilterChipRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Chip definitions in render order. */
  chips: ReadonlyArray<FilterChipDef>
  /** Currently pressed chip ids. */
  value: ReadonlyArray<string>
  /** Fired with the next selected ids whenever the user toggles a chip. */
  onChange: (next: ReadonlyArray<string>) => void
  /** Optional "+ Add" affordance label. Renders a trailing dash chip. */
  addLabel?: string
  /** Click handler for the trailing add chip. */
  onAdd?: () => void
}

/**
 * Renders a row of {@link Chip} toggles wired to a multi-select value
 * array. Used by search-criteria, shortlist, jobs inbox, applications,
 * and the agent-log filters. When `onAdd` is provided, a trailing dashed
 * chip with `addLabel` is rendered as a placeholder add affordance.
 */
const FilterChipRow = React.forwardRef<HTMLDivElement, FilterChipRowProps>(
  function FilterChipRow(
    { className, chips, value, onChange, addLabel = "+ Add", onAdd, ...props },
    ref,
  ) {
    const isPressed = (id: string) => value.includes(id)
    const toggle = (id: string) => {
      const next = isPressed(id)
        ? value.filter((chipId) => chipId !== id)
        : [...value, id]
      onChange(next)
    }
    return (
      <div
        ref={ref}
        data-slot="filter-chip-row"
        className={cn("flex flex-wrap items-center gap-1.5", className)}
        {...props}
      >
        {chips.map((chip) => (
          <Chip
            key={chip.id}
            variant={chip.variant ?? "default"}
            count={chip.count}
            pressed={isPressed(chip.id)}
            onPressedChange={() => toggle(chip.id)}
          >
            {chip.label}
          </Chip>
        ))}
        {onAdd ? (
          <Chip variant="dash" onClick={onAdd} pressed={false}>
            {addLabel}
          </Chip>
        ) : null}
      </div>
    )
  },
)

export { FilterChipRow }
