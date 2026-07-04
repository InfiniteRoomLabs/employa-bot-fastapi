import { CalendarIcon } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button-eb"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContentWithCaret,
  PopoverTrigger,
} from "@/components/ui/popover-with-caret"
import { cn } from "@/lib/utils"

export interface DatePickerProps {
  /** Currently selected date, controlled. */
  value?: Date
  /** Fires when the user picks a date in the calendar grid. */
  onChange?: (date: Date) => void
  /** Placeholder for the trigger button when no value is set. */
  placeholder?: string
  /** Extra class on the trigger button. */
  className?: string
  /** Trigger accessible label (e.g. "Mark won on…"). */
  ariaLabel?: string
}

function formatDisplay(date: Date | undefined, fallback: string): string {
  if (!date) {
    return fallback
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Date picker matching the design's compact 2-month layout. Composes
 * `Popover` + `PopoverContentWithCaret` around shadcn's `Calendar`
 * (`react-day-picker` v9). Used by the mark-won modal and any future
 * date-bound action.
 */
function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = React.useCallback(
    (date: Date | undefined) => {
      if (date && onChange) {
        onChange(date)
      }
      setOpen(false)
    },
    [onChange],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          data-slot="date-picker-trigger"
          data-empty={value ? undefined : "true"}
          aria-label={ariaLabel ?? placeholder}
          className={cn("justify-start gap-2 font-normal", className)}
        >
          <CalendarIcon aria-hidden className="size-4" />
          <span className={cn(!value && "text-muted-foreground")}>
            {formatDisplay(value, placeholder)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContentWithCaret align="start" caret="top" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          onSelect={handleSelect}
          numberOfMonths={2}
          autoFocus
        />
      </PopoverContentWithCaret>
    </Popover>
  )
}

export { DatePicker }
