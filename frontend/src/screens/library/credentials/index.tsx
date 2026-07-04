/**
 * Credentials (CRD-001). Stored licenses / certifications / documents. Post-MVP
 * and persona-driven (load-bearing for Nadia/Eli; optional for Remy), so this
 * is a navigable empty/coming-soon surface rather than a full CRUD screen.
 */

import { BadgeCheckIcon } from "lucide-react"
import { EmptyState } from "@/components/atoms/empty-state"
import { ResourceError } from "@/components/atoms/resource-error"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Badge } from "@/components/ui/badge-eb"
import { Card } from "@/components/ui/card-eb"
import { Skeleton } from "@/components/ui/skeleton"
import { useCredentials } from "@/hooks"

export default function CredentialsScreen() {
  const { data, isLoading, error, refetch } = useCredentials()
  const rows = data ?? []

  return (
    <AppFrame
      active="credentials"
      title="Credentials"
      subtitle={`${rows.length} documents`}
    >
      <PageHead
        eyebrow="Library"
        title="Credentials"
        lede="Licenses, certifications, transcripts, and portfolio files to attach when a role requires proof."
        actions={<Badge variant="info">Coming soon</Badge>}
      />

      {isLoading ? <Skeleton className="h-72" /> : null}
      {error ? (
        <ResourceError label="credentials" error={error} onRetry={refetch} />
      ) : null}
      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState
          icon={BadgeCheckIcon}
          headline="No credentials yet"
          body="Credential storage is on the roadmap -- most useful for licensed and trades roles (nursing, electrical) where proof is required."
        />
      ) : null}

      {!isLoading && !error && rows.length > 0 ? (
        <div className="flex flex-col gap-3">
          {rows.map((c) => (
            <Card key={c.id} className="flex items-center gap-3 p-[18px]">
              <BadgeCheckIcon
                className="size-4 text-[var(--fg-muted)]"
                aria-hidden
              />
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">{c.name}</div>
                <div className="text-[12.5px] text-[var(--fg-muted)]">
                  {c.type} - {c.issuer}
                  {c.expiry ? ` - expires ${c.expiry}` : ""}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </AppFrame>
  )
}
