/**
 * Settings - left-nav navigated panel surface.
 *
 * Picker id: `settings`
 * Route path: `/settings/:section?` (Phase 9)
 *
 * Mirrors `/tmp/employa-design/src/screens/settings.jsx`: seven nav
 * entries (Profile, Integrations, AI providers, AI usage, Privacy &
 * data, Billing, Danger zone) plus new Notifications and Extension
 * tokens sections.
 *
 * AUTH-024: Notifications section with per-category email/in-app toggles.
 * AUTH-025: Extension tokens section; also supports ?section=extension-tokens
 *           query param so the signed-out extension popup can deep-link here.
 * CUR-017:  Three-branch guard: isLoading -> Skeleton, error -> ResourceError, else -> panels.
 *
 * All editable controls are real: provider API keys with show/hide
 * toggle, provider enable Switches, routing Selects, profile Inputs,
 * privacy Switches, integration Connect/Disconnect, monthly cap
 * Input, danger Buttons (each guarded by a confirmation Dialog).
 *
 * Form state is seeded from `useSettings().data` once via effect.
 * Mutations are local -- there is no real persist call. A sticky
 * "Save changes" bar appears when the form diverges from the loaded
 * value (cheap `JSON.stringify` dirty-check). "Discard" reverts.
 */

import {
  AlertTriangleIcon,
  BellIcon,
  CpuIcon,
  CreditCardIcon,
  FingerprintIcon,
  GaugeIcon,
  KeyIcon,
  PlugIcon,
  ShieldIcon,
  UserIcon,
} from "lucide-react"
import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { ResourceError } from "@/components/atoms/resource-error"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Button } from "@/components/ui/button-eb"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { NotifPref, Settings } from "@/data/types"
import { useSettings } from "@/hooks"
import { cn } from "@/lib/utils"

import { AccountIdPanel } from "./account-id-panel"
import type { ProviderCredentialMap } from "./ai-providers-panel"
import { AiProvidersPanel, buildInitialCredentials } from "./ai-providers-panel"
import { BillingPanel } from "./billing-panel"
import { DangerPanel } from "./danger-panel"
import { ExtensionTokensPanel } from "./extension-tokens-panel"
import { IntegrationsPanel } from "./integrations-panel"
import { NotificationsPanel } from "./notifications-panel"
import { PrivacyPanel } from "./privacy-panel"
import { ProfilePanel } from "./profile-panel"
import { UsagePanel } from "./usage-panel"

// ---------------------------------------------------------------------------
// Section registry
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "account", label: "Account", icon: FingerprintIcon },
  { id: "integrations", label: "Integrations", icon: PlugIcon },
  { id: "notifications", label: "Notifications", icon: BellIcon },
  { id: "extension-tokens", label: "Extension tokens", icon: KeyIcon },
  { id: "providers", label: "AI providers", icon: CpuIcon },
  { id: "usage", label: "AI usage", icon: GaugeIcon },
  { id: "privacy", label: "Privacy & data", icon: ShieldIcon },
  { id: "billing", label: "Billing", icon: CreditCardIcon },
  { id: "danger", label: "Danger zone", icon: AlertTriangleIcon },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

/** Local form-state shape. Mirrors `Settings` plus the parallel
 *  credentials map for the AI providers panel. */
interface FormState {
  settings: Settings
  credentials: ProviderCredentialMap
}

function buildFormState(data: Settings): FormState {
  return {
    settings: structuredClone(data) as Settings,
    credentials: buildInitialCredentials(data.providers),
  }
}

/** Cheap dirty-check by stringification. The credentials map is held
 *  outside `Settings` (parallel) but still factors in. */
function isDirty(form: FormState, baseline: FormState): boolean {
  return (
    JSON.stringify(form.settings) !== JSON.stringify(baseline.settings) ||
    JSON.stringify(form.credentials) !== JSON.stringify(baseline.credentials)
  )
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const [searchParams] = useSearchParams()
  // AUTH-025: support ?section=extension-tokens deep-link from the extension popup
  // CTX-105 AC4: support ?tab=usage deep-link from the sidebar BudgetBar link.
  // The sidebar uses ?tab= (generic "tab" param); settings also accepts the
  // older ?section= param from the extension popup. ?tab= takes precedence.
  const tabParam = searchParams.get("tab") as SectionId | null
  const sectionParam = searchParams.get("section") as SectionId | null
  const rawSection = tabParam ?? sectionParam ?? "profile"
  const initialSection = SECTIONS.some((section) => section.id === rawSection)
    ? rawSection
    : "profile"
  const validSection = initialSection

  const [active, setActive] = React.useState<SectionId>(validSection)
  const { data, isLoading, error, refetch } = useSettings()

  const [form, setForm] = React.useState<FormState | null>(null)
  const [baseline, setBaseline] = React.useState<FormState | null>(null)

  React.useEffect(() => {
    if (!data) {
      return
    }
    // Seed local form-state once the async settings bundle resolves.
    const initial = buildFormState(data)
    /* eslint-disable react-hooks/set-state-in-effect */
    setForm(initial)
    setBaseline(initial)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data])

  const dirty = React.useMemo(
    () => (form && baseline ? isDirty(form, baseline) : false),
    [form, baseline],
  )

  const handleDiscard = () => {
    if (baseline) {
      setForm(structuredClone(baseline) as FormState)
    }
  }

  const handleSave = () => {
    if (!form) {
      return
    }
    // Demo only -- no real persistence. Promote local form to baseline.
    setBaseline(structuredClone(form) as FormState)
    toast.success({
      title: "Settings saved",
      sub: "Demo only -- nothing was sent to a server.",
    })
  }

  const patchSettings = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => {
    setForm((prev) =>
      prev ? { ...prev, settings: { ...prev.settings, [key]: value } } : prev,
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppFrame active="settings" title="Settings" subtitle="Wes - Pro plan">
      <PageHead
        eyebrow="Account"
        title="Settings"
        lede="Profile, integrations, AI providers, privacy, and billing -- one screen."
      />

      <div className="grid grid-cols-[200px_1fr] items-start gap-8">
        <nav
          className="sticky top-20 flex flex-col gap-1"
          aria-label="Settings sections"
        >
          {SECTIONS.map((section) => {
            const Icon = section.icon
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActive(section.id)}
                aria-current={section.id === active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left text-[13px]",
                  section.id === active
                    ? "bg-[var(--bg-subtle)] font-semibold"
                    : "text-[var(--fg-muted)] hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                <span>{section.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex flex-col gap-4 pb-24">
          {/* CUR-017: three-branch guard */}
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : error ? (
            <ResourceError label="settings" error={error} onRetry={refetch} />
          ) : !form ? (
            <Skeleton className="h-96 w-full" />
          ) : active === "profile" ? (
            <ProfilePanel
              value={form.settings.profile}
              onChange={(patch) =>
                patchSettings("profile", { ...form.settings.profile, ...patch })
              }
            />
          ) : active === "account" ? (
            // AUTH-041: read-only Account ID (no form state)
            <AccountIdPanel />
          ) : active === "integrations" ? (
            <IntegrationsPanel
              value={form.settings.integrations}
              onChange={(next) => patchSettings("integrations", [...next])}
            />
          ) : active === "notifications" ? (
            // AUTH-024: Notifications section
            <NotificationsPanel
              value={form.settings.notifPrefs}
              onChange={(next) =>
                patchSettings("notifPrefs", [...next] as NotifPref[])
              }
            />
          ) : active === "extension-tokens" ? (
            // AUTH-025: Extension tokens section (local state only -- does not patch Settings)
            <ExtensionTokensPanel
              initialTokens={form.settings.extensionTokens}
            />
          ) : active === "providers" ? (
            <AiProvidersPanel
              providers={form.settings.providers}
              credentials={form.credentials}
              onCredentialsChange={(next) =>
                setForm((prev) =>
                  prev ? { ...prev, credentials: next } : prev,
                )
              }
              routing={form.settings.routing}
              onRoutingChange={(next) => patchSettings("routing", [...next])}
              emailParserFallback={form.settings.emailParserFallback}
              onEmailParserFallbackChange={(next) =>
                patchSettings("emailParserFallback", next)
              }
            />
          ) : active === "usage" ? (
            <UsagePanel
              usage={form.settings.usage}
              monthSpend={form.settings.monthSpend}
              monthlyCap={form.settings.monthlyCap}
              onMonthlyCapChange={(next) => patchSettings("monthlyCap", next)}
            />
          ) : active === "privacy" ? (
            <PrivacyPanel
              value={form.settings.privacy}
              onChange={(next) => patchSettings("privacy", [...next])}
              privacyLastUpdated={form.settings.privacyLastUpdated}
            />
          ) : active === "billing" ? (
            <BillingPanel
              plan={form.settings.plan}
              invoices={form.settings.invoices}
            />
          ) : (
            // Fallback: danger (also catches any future section not yet matched)
            <DangerPanel value={form.settings.danger} />
          )}
        </div>
      </div>

      {dirty ? (
        <div
          data-testid="settings-save-bar"
          role="region"
          aria-label="Unsaved changes"
          className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2"
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3 shadow-lg">
            <span className="text-[13px] font-medium">Unsaved changes</span>
            <Button variant="ghost" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button variant="default" size="sm" onClick={handleSave}>
              Save changes
            </Button>
          </div>
        </div>
      ) : null}
    </AppFrame>
  )
}
