/**
 * AI Providers panel — the headline editable surface flagged by the
 * user. Matches `settings.jsx::SetProviders`: pooled-credits hero
 * card, per-provider rows (Anthropic, OpenAI, Google, Mistral,
 * Local), and a Routing card. Each provider row exposes an actually
 * editable API key field with a show/hide toggle, a "Test connection"
 * button, and an enable Switch. Errors render inline with an Alert.
 *
 * State for `apiKey` + `enabled` is held in a parallel map keyed by
 * provider name — keeping `ProviderRow` intact for any other consumer.
 */

import {
  AlertTriangleIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  ZapIcon,
} from "lucide-react"
import * as React from "react"
import { FormField } from "@/components/atoms/form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Card } from "@/components/ui/card-eb"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import type { EmailParserFallback, ProviderRow, RoutingRow } from "@/data/types"

import { SectionHeading } from "./section-heading"

/** Per-provider editable surface held parallel to the `ProviderRow`. */
export interface ProviderCredential {
  /** API key string. Empty when not yet set. */
  apiKey: string
  /** Whether the provider is currently enabled. */
  enabled: boolean
}

export type ProviderCredentialMap = Record<string, ProviderCredential>

/** Build the initial credential map from a provider list. */
// eslint-disable-next-line react-refresh/only-export-components
export function buildInitialCredentials(
  providers: readonly ProviderRow[],
): ProviderCredentialMap {
  const map: ProviderCredentialMap = {}
  for (const p of providers) {
    map[p.provider] = {
      apiKey: p.state === "connected" ? "••••••••••••••" : "",
      enabled: p.state === "connected",
    }
  }
  return map
}

/** Parse the comma-separated model list off a `ProviderRow.model`. */
// eslint-disable-next-line react-refresh/only-export-components
export function parseModels(m: string): string[] {
  return m
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
}

/** Aggregate every model across all providers — used by Routing's dropdown. */
// eslint-disable-next-line react-refresh/only-export-components
export function collectAllModels(providers: readonly ProviderRow[]): string[] {
  const set = new Set<string>()
  for (const p of providers) {
    for (const m of parseModels(p.model)) {
      set.add(m)
    }
  }
  return Array.from(set)
}

export interface AiProvidersPanelProps {
  providers: readonly ProviderRow[]
  credentials: ProviderCredentialMap
  onCredentialsChange: (next: ProviderCredentialMap) => void
  routing: readonly RoutingRow[]
  onRoutingChange: (next: readonly RoutingRow[]) => void
  /** D9b: email-parser behavior when the monthly cap is reached. */
  emailParserFallback: EmailParserFallback
  onEmailParserFallbackChange: (next: EmailParserFallback) => void
}

export function AiProvidersPanel({
  providers,
  credentials,
  onCredentialsChange,
  routing,
  onRoutingChange,
  emailParserFallback,
  onEmailParserFallbackChange,
}: AiProvidersPanelProps) {
  const [keyVisible, setKeyVisible] = React.useState<Record<string, boolean>>(
    {},
  )

  const patchCredential = (
    name: string,
    patch: Partial<ProviderCredential>,
  ) => {
    const current = credentials[name] ?? { apiKey: "", enabled: false }
    onCredentialsChange({ ...credentials, [name]: { ...current, ...patch } })
  }

  const handleTest = (name: string) => {
    console.log(`[settings] Test connection for ${name}`)
    toast.default({
      title: `Pinged ${name}`,
      sub: "Demo only — no real request made.",
    })
  }

  const allModels = React.useMemo(
    () => collectAllModels(providers),
    [providers],
  )

  const updateRouting = (label: string, newValue: string) => {
    onRoutingChange(
      routing.map((routingRow) =>
        routingRow.label === label
          ? { ...routingRow, value: newValue }
          : routingRow,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="AI providers"
        subtitle="Bring your own keys, or use pooled credits included with Pro. We route each task to whichever model you've configured for it."
      />

      {/* Pooled-credits hero card. */}
      <Card className="border-transparent bg-[var(--accent)] p-5 text-[var(--fg-on-accent)]">
        <div className="flex items-center gap-3">
          <ZapIcon className="size-5" aria-hidden />
          <Badge className="bg-[var(--fg)] text-[var(--bg)]">
            default · pooled
          </Badge>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">
              Employa-Bot pooled credits
            </div>
            <div className="text-[13px]">
              Included with Pro. No key to manage. $20 / month.
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              toast.success({
                title: "Pooled credits set as secondary",
                sub: "Your own provider keys handle tasks first; pooled credits are the fallback.",
              })
            }
          >
            Make secondary
          </Button>
        </div>
      </Card>

      {/* Per-provider cards. */}
      <div className="flex flex-col gap-2">
        {providers.map((providerRow) => {
          const cred = credentials[providerRow.provider] ?? {
            apiKey: "",
            enabled: false,
          }
          const isVisible = keyVisible[providerRow.provider] ?? false
          const isError = providerRow.state === "error"
          return (
            <Card
              key={providerRow.provider}
              data-testid={`provider-card-${providerRow.provider}`}
              className={
                isError
                  ? "border-[var(--danger)] bg-[var(--danger-soft)] p-4"
                  : "p-4"
              }
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      {providerRow.provider}
                    </div>
                    <div className="font-mono text-[11.5px] text-[var(--fg-subtle)]">
                      {providerRow.model}
                    </div>
                    {providerRow.balance ? (
                      <div className="mt-0.5 font-mono text-[11px] text-[var(--fg-subtle)]">
                        {providerRow.balance}
                      </div>
                    ) : null}
                  </div>
                  {providerRow.state === "connected" ? (
                    <Badge variant="success">connected</Badge>
                  ) : null}
                  {providerRow.state === "not-connected" ? (
                    <Badge variant="default">not connected</Badge>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <label
                      className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]"
                      htmlFor={`enable-${providerRow.provider}`}
                    >
                      <span>Enabled</span>
                      <Switch
                        id={`enable-${providerRow.provider}`}
                        checked={cred.enabled}
                        onCheckedChange={(checked) =>
                          patchCredential(providerRow.provider, {
                            enabled: checked,
                          })
                        }
                        aria-label={`Enable ${providerRow.provider}`}
                      />
                    </label>
                  </div>
                </div>

                {/* Editable API-key field. */}
                <FormField label={`${providerRow.provider} API key`}>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={isVisible ? "text" : "password"}
                        value={cred.apiKey}
                        onChange={(event) =>
                          patchCredential(providerRow.provider, {
                            apiKey: event.target.value,
                          })
                        }
                        placeholder={
                          providerRow.provider === "Local"
                            ? "http://localhost:11434"
                            : `sk-${providerRow.provider.toLowerCase()}-...`
                        }
                        data-testid={`provider-key-${providerRow.provider}`}
                        className="pr-10 font-mono"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setKeyVisible((prev) => ({
                            ...prev,
                            [providerRow.provider]: !prev[providerRow.provider],
                          }))
                        }
                        aria-label={
                          isVisible
                            ? `Hide ${providerRow.provider} key`
                            : `Show ${providerRow.provider} key`
                        }
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-[var(--radius-sm)] p-1.5 text-[var(--fg-muted)] hover:bg-muted hover:text-foreground"
                      >
                        {isVisible ? (
                          <EyeOffIcon className="size-4" />
                        ) : (
                          <EyeIcon className="size-4" />
                        )}
                      </button>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleTest(providerRow.provider)}
                      aria-label={`Test ${providerRow.provider} connection`}
                    >
                      Test connection
                    </Button>
                    {providerRow.state === "not-connected" ? (
                      <Button
                        variant="default"
                        size="sm"
                        icon={<PlusIcon />}
                        onClick={() =>
                          toast.default({
                            title: `Add a ${providerRow.provider} API key`,
                            sub: "In the real product this opens a secure key-entry form. Keys are stored encrypted, never shared.",
                          })
                        }
                      >
                        Add key
                      </Button>
                    ) : null}
                  </div>
                </FormField>

                {isError && providerRow.error ? (
                  <Alert
                    variant="destructive"
                    data-testid={`provider-error-${providerRow.provider}`}
                  >
                    <AlertTriangleIcon />
                    <AlertDescription>
                      Last request failed: {providerRow.error}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Routing card — design lives this inside Providers. */}
      <Card className="p-5">
        <div className="mb-3 flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Routing</h3>
          <p className="text-[12.5px] text-[var(--fg-muted)]">
            Per-task model preferences. Falls back to pooled.
          </p>
        </div>
        <div className="flex flex-col">
          {routing.map((row, i) => (
            <div
              key={row.label}
              className={`flex items-center gap-3 py-2 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <span className="flex-1 text-[13px]">{row.label}</span>
              <Select
                value={row.value}
                onValueChange={(value) => updateRouting(row.label, value)}
              >
                <SelectTrigger
                  aria-label={`Model for ${row.label}`}
                  className="h-8 w-[220px] font-mono text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allModels.map((model) => (
                    <SelectItem
                      key={model}
                      value={model}
                      className="font-mono text-xs"
                    >
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </Card>

      {/* D9b: email-parser cap fallback. Deterministic by default; opt in to a cheap model. */}
      <Card className="p-5">
        <div className="mb-3 flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Email parsing at cap</h3>
          <p className="text-[12.5px] text-[var(--fg-muted)]">
            When your monthly cap is reached, forwarded emails are parsed
            without AI by default (chip / keyword rules -- no surprise spend).
            You can opt in to a cheap fallback model instead; you stay in
            control of which model runs.
          </p>
        </div>
        <div className="flex items-center gap-3 py-2">
          <span className="flex-1 text-[13px]">
            Use a cheap fallback model at cap
          </span>
          <Switch
            checked={emailParserFallback.mode === "cheap-model"}
            onCheckedChange={(checked) =>
              onEmailParserFallbackChange(
                checked
                  ? {
                      mode: "cheap-model",
                      model:
                        emailParserFallback.model ??
                        allModels[0] ??
                        "gpt-4o-mini",
                    }
                  : { mode: "deterministic" },
              )
            }
            aria-label="Use a cheap fallback model at cap"
          />
        </div>
        {emailParserFallback.mode === "cheap-model" ? (
          <div className="flex items-center gap-3 border-t border-border py-2">
            <span className="flex-1 text-[13px]">Fallback model</span>
            <Select
              value={emailParserFallback.model}
              onValueChange={(value) =>
                onEmailParserFallbackChange({
                  mode: "cheap-model",
                  model: value,
                })
              }
            >
              <SelectTrigger
                aria-label="Fallback model"
                className="h-8 w-[220px] font-mono text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allModels.map((model) => (
                  <SelectItem
                    key={model}
                    value={model}
                    className="font-mono text-xs"
                  >
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
