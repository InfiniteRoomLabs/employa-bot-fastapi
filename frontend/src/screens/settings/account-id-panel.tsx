/**
 * AUTH-041: surfaces the read-only Account ID in Settings. The Account is the
 * data-ownership boundary (ADR-007) -- the human user, Coach, and any agents
 * are actors WITHIN it. In the real backend this UUID comes from the account;
 * the mockup shows a stable demo value.
 */

import { CopyIcon } from "lucide-react"
import * as React from "react"
import { FormField } from "@/components/atoms/form-field"
import { Button } from "@/components/ui/button-eb"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"

// Demo Account UUID. Real value is issued by the backend (ADR-007).
const ACCOUNT_ID = "acct_8f3c1d6e-2b47-4a90-9c15-7e0d2a6b4f81"

export function AccountIdPanel() {
  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ACCOUNT_ID)
      toast.success({ title: "Account ID copied" })
    } catch {
      toast.warn({ title: "Could not copy", sub: "Select and copy manually." })
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[18px] font-semibold">Account</h2>
        <p className="m-0 text-[13px] text-[var(--fg-muted)]">
          Your account owns all your data. You, your Coach, and any agents act
          within it -- every change is attributed to whoever made it.
        </p>
      </div>
      <FormField
        label="Account ID"
        helper="Quote this in support requests. Identifies your account, not just your user."
      >
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={ACCOUNT_ID}
            aria-label="Account ID"
            className="font-mono text-[12px]"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            variant="secondary"
            onClick={copy}
            aria-label="Copy account ID"
          >
            <CopyIcon className="size-3.5" /> Copy
          </Button>
        </div>
      </FormField>
    </div>
  )
}
