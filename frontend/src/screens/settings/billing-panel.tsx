/**
 * Billing panel for the Settings screen. Plan summary card + invoices table.
 * Matches `settings.jsx::SetBilling`.
 *
 * AUTH-028:
 *   - "Change plan" opens a plan-picker Dialog (Starter / Pro / Teams tiers).
 *     Clicking Select on a non-current tier fires toast.success and closes.
 *   - "Manage" opens a payment-method Dialog (Visa 4242 + Update card CTA).
 *   - Invoice "PDF" buttons fire toast.default with the invoice date.
 */

import { DownloadIcon, ZapIcon } from "lucide-react"
import * as React from "react"

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
import type { InvoiceRow, Settings } from "@/data/types"

import { SectionHeading } from "./section-heading"

// ---------------------------------------------------------------------------
// Plan picker constants -- local to this file; no new data type needed
// ---------------------------------------------------------------------------

interface PlanTier {
  id: string
  name: string
  price: string
  features: string[]
}

const PLAN_TIERS: PlanTier[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$9/mo",
    features: ["5 active applications", "10 AI operations/mo", "Email capture"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29/mo",
    features: [
      "Unlimited applications",
      "200 AI operations/mo",
      "All agents",
      "Priority support",
    ],
  },
  {
    id: "teams",
    name: "Teams",
    price: "$79/mo",
    features: [
      "Everything in Pro",
      "Up to 5 seats",
      "Shared coach history",
      "Admin dashboard",
    ],
  },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BillingPanelProps {
  plan: Settings["plan"]
  invoices: readonly InvoiceRow[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingPanel({ plan, invoices }: BillingPanelProps) {
  const [showChangePlan, setShowChangePlan] = React.useState(false)
  const [showManage, setShowManage] = React.useState(false)

  // Determine which plan tier is current by matching plan.name
  const currentTierId =
    PLAN_TIERS.find(
      (tier) => tier.name.toLowerCase() === plan.name.toLowerCase(),
    )?.id ?? "pro"

  const handleSelectTier = (tier: PlanTier) => {
    if (tier.id === currentTierId) {
      return
    }
    toast.success({
      title: `Plan change requested: ${tier.name}`,
      sub: "Demo only -- nothing was charged.",
    })
    setShowChangePlan(false)
  }

  const handleUpdateCard = () => {
    toast.default({
      title: "Update payment method",
      sub: "Demo only -- no payment processor connected.",
    })
  }

  const handlePdf = (invoice: InvoiceRow) => {
    toast.default({
      title: `Invoice ${invoice.date} PDF`,
      sub: "Demo only -- no file was generated.",
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Billing" subtitle="Plan and invoices." />

      {/* Current plan card */}
      <Card className="border-transparent bg-[var(--accent)] p-6 text-[var(--fg-on-accent)]">
        <div className="flex items-center gap-4">
          <ZapIcon className="size-5" aria-hidden />
          <div className="flex-1">
            <div className="text-[17px] font-bold">
              {plan.name} · {plan.price}
            </div>
            <div className="text-[13px]">{plan.description}</div>
            <div className="mt-1 text-xs">Next charge: {plan.nextCharge}</div>
          </div>
          {/* AUTH-028 AC3: Manage opens payment method dialog */}
          <Button variant="ghost" onClick={() => setShowManage(true)}>
            Manage
          </Button>
          {/* AUTH-028 AC2: Change plan opens plan-picker dialog */}
          <Button variant="ghost" onClick={() => setShowChangePlan(true)}>
            Change plan
          </Button>
        </div>
      </Card>

      <h3 className="text-sm font-semibold">Invoices</h3>
      <Card className="p-0">
        {invoices.map((invoice, index) => (
          <div
            key={`${invoice.date}-${index}`}
            className="flex items-center gap-3.5 px-4.5 py-3 [&+&]:border-t [&+&]:border-border"
          >
            <span className="w-[110px] font-mono text-xs">{invoice.date}</span>
            <span className="flex-1 text-[13px]">{invoice.description}</span>
            <span className="font-mono text-[13px] font-semibold">
              {invoice.amount}
            </span>
            {/* AUTH-028 AC4: PDF fires toast */}
            <Button
              variant="ghost"
              size="sm"
              icon={<DownloadIcon />}
              aria-label={`Download ${invoice.date} invoice`}
              onClick={() => handlePdf(invoice)}
            >
              PDF
            </Button>
          </div>
        ))}
      </Card>

      {/* AUTH-028: Change plan dialog */}
      <Dialog open={showChangePlan} onOpenChange={setShowChangePlan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change plan</DialogTitle>
            <DialogDescription>
              Select a plan below. Changes take effect at your next billing
              cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {PLAN_TIERS.map((tier) => {
              const isCurrent = tier.id === currentTierId
              return (
                <Card key={tier.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {tier.name}
                        </span>
                        {isCurrent ? (
                          <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-medium text-[var(--fg-on-accent)]">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[13px] font-medium text-[var(--fg-muted)]">
                        {tier.price}
                      </div>
                      <ul className="mt-1.5 flex flex-col gap-0.5">
                        {tier.features.map((feature) => (
                          <li
                            key={feature}
                            className="text-[12px] text-[var(--fg-muted)]"
                          >
                            - {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Button
                      variant={isCurrent ? "ghost" : "default"}
                      size="sm"
                      disabled={isCurrent}
                      onClick={() => handleSelectTier(tier)}
                    >
                      {isCurrent ? "Active" : "Select"}
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AUTH-028: Manage payment method dialog */}
      <Dialog open={showManage} onOpenChange={setShowManage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment method</DialogTitle>
            <DialogDescription>
              Manage your payment details. Changes apply to future charges.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-[var(--bg-subtle)] px-4 py-3">
            <span className="font-mono text-sm font-semibold">Visa</span>
            <span className="flex-1 text-sm text-[var(--fg-muted)]">
              ending in 4242
            </span>
            <Button variant="secondary" size="sm" onClick={handleUpdateCard}>
              Update card
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
