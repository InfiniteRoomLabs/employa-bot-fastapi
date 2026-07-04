import * as React from "react"

import { cn } from "@/lib/utils"

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Eyebrow-styled label above the field. */
  label: string
  /** Optional helper text rendered below the field. */
  helper?: string
  /** The form control(s) the field wraps. */
  children: React.ReactNode
  /** Show a required marker after the label. */
  required?: boolean
}

/**
 * Generic label + helper wrapper for form controls. The label is
 * rendered with the design's `.eyebrow` styling (uppercase, tracked).
 * Helper text is rendered as muted small print. The field generates an
 * `id` automatically and exposes it via `aria-labelledby` /
 * `aria-describedby` semantics on the inner wrapper for screen-reader
 * consumers that pass the `id` along to their child input.
 */
const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  function FormField(
    { className, label, helper, children, required, ...props },
    ref,
  ) {
    const reactId = React.useId()
    const labelId = `${reactId}-label`
    const helperId = helper ? `${reactId}-helper` : undefined
    return (
      <div
        ref={ref}
        data-slot="form-field"
        className={cn("flex flex-col gap-1.5", className)}
        {...props}
      >
        <div id={labelId} className="eyebrow">
          {label}
          {required ? (
            <span aria-hidden className="ml-0.5 text-[var(--danger)]">
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> (required)</span> : null}
        </div>
        <div
          data-slot="form-field-control"
          aria-labelledby={labelId}
          aria-describedby={helperId}
        >
          {children}
        </div>
        {helper ? (
          <div
            id={helperId}
            data-slot="form-field-helper"
            className="text-xs text-muted-foreground"
          >
            {helper}
          </div>
        ) : null}
      </div>
    )
  },
)

export { FormField }
