/**
 * ResourceError atom -- CUR-017 cross-cutting contract.
 *
 * Renders a consistent error panel when a data-backed screen's hook returns
 * an error. Modeled on the NotificationsPopover inline error triad.
 *
 * Two variants:
 *   - Error panel: icon + kind-specific copy + 'Try again' button
 *   - Not-found panel: icon + '<label> does not exist' + back link
 *
 * Usage:
 *   <ResourceError label="applications" error={error} onRetry={refetch} />
 *   <ResourceError label="application" notFound backLabel="Applications" backTo="/applications" />
 */

import { AlertCircleIcon, PackageXIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button-eb"
import type { MockApiError, MockApiErrorKind } from "@/lib/mock-api-error"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Error copy per kind
// ---------------------------------------------------------------------------

function errorCopy(
  kind: MockApiErrorKind,
  label: string,
): { heading: string; sub: string } {
  switch (kind) {
    case "rate_limited":
      return {
        heading: `Too many requests`,
        sub: "Give it a moment and try again.",
      }
    case "unauthorized":
      return {
        heading: "Session expired",
        sub: "Sign in again to continue.",
      }
    case "not_found":
      return {
        heading: `${label} does not exist or was removed`,
        sub: "",
      }
    default:
      return {
        heading: `Could not load ${label}`,
        sub: "Something went wrong on our end.",
      }
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ErrorPanelProps = {
  label: string
  error: MockApiError
  onRetry?: () => void
  notFound?: false
  className?: string
}

type NotFoundPanelProps = {
  label: string
  notFound: true
  backLabel: string
  backTo: string
  className?: string
  /** error and onRetry are unused in not-found mode but kept for convenience */
  error?: MockApiError
  onRetry?: () => void
}

export type ResourceErrorProps = ErrorPanelProps | NotFoundPanelProps

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResourceError(props: ResourceErrorProps) {
  if (props.notFound) {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center",
          props.className,
        )}
      >
        <PackageXIcon
          className="h-10 w-10 text-[var(--fg-subtle)]"
          aria-hidden
        />
        <p className="text-[15px] font-semibold text-[var(--fg-base)]">
          {props.label} does not exist or was removed
        </p>
        <Link
          to={props.backTo}
          className="text-sm text-[var(--accent-base)] underline underline-offset-2 hover:text-[var(--accent-hover)]"
        >
          {props.backLabel}
        </Link>
      </div>
    )
  }

  const { heading, sub } = errorCopy(props.error.kind, props.label)
  const isUnauthorized = props.error.kind === "unauthorized"

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center",
        props.className,
      )}
    >
      <AlertCircleIcon
        className="h-10 w-10 text-[var(--warn-icon)]"
        aria-hidden
      />
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-[var(--fg-base)]">
          {heading}
        </p>
        {sub && <p className="text-sm text-[var(--fg-muted)]">{sub}</p>}
        {props.error.message &&
          props.error.kind !== "rate_limited" &&
          props.error.kind !== "unauthorized" && (
            <p className="text-xs text-[var(--fg-subtle)]">
              {props.error.message}
            </p>
          )}
      </div>
      {isUnauthorized ? (
        <Link
          to="/login"
          className="text-sm text-[var(--accent-base)] underline underline-offset-2 hover:text-[var(--accent-hover)]"
        >
          Sign in
        </Link>
      ) : props.onRetry ? (
        <Button size="sm" variant="secondary" onClick={props.onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
