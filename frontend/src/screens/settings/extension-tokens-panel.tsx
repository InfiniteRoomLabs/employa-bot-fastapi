/**
 * Extension tokens panel for the Settings screen (AUTH-025).
 *
 * Surfaces personal access tokens for the browser extension.
 *
 * Behavior:
 *   - Lists existing tokens (label, createdAt, Revoke button).
 *   - "Generate token" appends a new token to local state with a one-time-display
 *     Card showing the raw value + CopyIcon. Dismissing ("I have copied it") hides
 *     the raw value permanently.
 *   - Revoke opens a small confirmation Dialog; on confirm removes the row from
 *     local state and fires toast.warn.
 *   - When the token list is empty, renders EmptyState.
 *   - AUTH-025 AC4: callout for users arriving from the extension signed-out popup.
 *
 * State is fully local (generate + revoke are demo-only). No api.ts call needed.
 */

import {
  CheckIcon,
  CopyIcon,
  KeyIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import * as React from "react"
import { EmptyState } from "@/components/atoms/empty-state"
import { Button } from "@/components/ui/button-eb"
import { Card } from "@/components/ui/card-eb"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import type { ExtensionToken } from "@/data/types"

import { SectionHeading } from "./section-heading"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a plausible-looking random token string for demo purposes. */
function generateFakeToken(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16)
  return `eb_${Array.from({ length: 32 }, hex).join("")}`
}

function nowLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExtensionTokensPanelProps {
  /** Initial list of tokens from Settings.extensionTokens fixture. */
  initialTokens: readonly ExtensionToken[]
}

// ---------------------------------------------------------------------------
// One-time display state -- stored alongside the token row
// ---------------------------------------------------------------------------

interface TokenWithOneTime extends ExtensionToken {
  /** Raw token value shown once on generate; undefined after dismissal. */
  rawValue?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExtensionTokensPanel({
  initialTokens,
}: ExtensionTokensPanelProps) {
  const [tokens, setTokens] = React.useState<TokenWithOneTime[]>(() =>
    initialTokens.map((token) => ({ ...token })),
  )
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [pendingRevoke, setPendingRevoke] =
    React.useState<TokenWithOneTime | null>(null)

  // AUTH-025: generate a new token with one-time display
  const handleGenerate = () => {
    setIsGenerating(true)
    // Simulate async generation
    setTimeout(() => {
      const newToken: TokenWithOneTime = {
        id: `tok-${Date.now()}`,
        label: "Browser extension",
        createdAt: nowLabel(),
        rawValue: generateFakeToken(),
      }
      setTokens((prev) => [newToken, ...prev])
      setIsGenerating(false)
    }, 800)
  }

  // Copy raw token to clipboard (demo -- no real clipboard write in CI)
  const handleCopy = (raw: string) => {
    try {
      void navigator.clipboard.writeText(raw)
    } catch {
      // silently ignore in non-secure contexts (CI / test env)
    }
    toast.success({
      title: "Token copied",
      sub: "Paste it into the extension popup.",
    })
  }

  // Dismiss the one-time display (user confirms they copied it)
  const handleDismissRaw = (id: string) => {
    setTokens((prev) =>
      prev.map((token) =>
        token.id === id ? { ...token, rawValue: undefined } : token,
      ),
    )
  }

  // Confirm revoke
  const handleRevoke = () => {
    if (!pendingRevoke) {
      return
    }
    setTokens((prev) => prev.filter((token) => token.id !== pendingRevoke.id))
    toast.warn({
      title: "Token revoked",
      sub: "The extension will disconnect on its next call.",
    })
    setPendingRevoke(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Extension tokens"
        subtitle="Personal access tokens for the browser extension. A token is shown once -- copy it before leaving."
      />

      {/* AUTH-025 AC4: callout for users arriving from the signed-out extension popup */}
      <Card className="bg-[var(--bg-subtle)] p-4">
        <p className="flex items-start gap-2 text-[13px] text-[var(--fg-muted)]">
          <KeyIcon
            className="mt-0.5 size-4 shrink-0 text-[var(--accent-base)]"
            aria-hidden
          />
          <span>
            If you arrived from the extension, generate a token below and paste
            it into the extension popup to reconnect.
          </span>
        </p>
      </Card>

      {/* Generate button */}
      <div>
        <Button
          variant="default"
          icon={<PlusIcon />}
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate token"}
        </Button>
      </div>

      {/* Token list */}
      {tokens.length === 0 ? (
        <EmptyState
          icon={KeyIcon}
          headline="No tokens yet"
          body="Generate your first token above and paste it into the extension popup."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {tokens.map((token) => (
            <div key={token.id}>
              {/* One-time display card for newly generated token */}
              {token.rawValue ? (
                <Card className="border-[var(--success)] bg-[var(--success-soft,hsl(140_60%_97%))] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <CheckIcon
                      className="size-4 text-[var(--success-text,hsl(140_40%_35%))]"
                      aria-hidden
                    />
                    <span className="text-[13px] font-semibold text-[var(--success-text,hsl(140_40%_35%))]">
                      Token generated -- copy it now. It will not be shown
                      again.
                    </span>
                  </div>
                  <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-card px-3 py-2">
                    <code className="flex-1 break-all font-mono text-[12px]">
                      {token.rawValue}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<CopyIcon />}
                      onClick={() => handleCopy(token.rawValue!)}
                      aria-label="Copy token"
                    >
                      Copy
                    </Button>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDismissRaw(token.id)}
                  >
                    I have copied it
                  </Button>
                </Card>
              ) : (
                /* Existing token row */
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <KeyIcon
                      className="size-4 shrink-0 text-[var(--fg-subtle)]"
                      aria-hidden
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{token.label}</p>
                      <p className="text-[12px] text-[var(--fg-muted)]">
                        Created {token.createdAt}
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Trash2Icon />}
                      onClick={() => setPendingRevoke(token)}
                      aria-label={`Revoke ${token.label} token`}
                    >
                      Revoke
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Revoke confirmation dialog */}
      <Dialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke token?</DialogTitle>
            <DialogDescription>
              Revoking <strong>{pendingRevoke?.label}</strong> will immediately
              invalidate it. The extension will be signed out on its next call.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="danger" onClick={handleRevoke}>
              Revoke token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
