import type { Meta, StoryObj } from "@storybook/react-vite"

import type { CostPreview } from "@/data/types"

import { CostPreviewDialog } from "./cost-preview-dialog"

const PREVIEW: CostPreview = {
  items: [
    {
      label: "Deep match score -- Distributed-systems master",
      model: "gemini-1.5-pro",
      estCostUsd: 0.14,
    },
  ],
  totalUsd: 0.14,
  capRemainingUsd: 16.58,
  overCap: false,
}

const noop = () => {}

const meta = {
  title: "Domain/CostPreviewDialog",
  component: CostPreviewDialog,
  parameters: { layout: "centered" },
  args: { open: true, onOpenChange: noop, onConfirm: noop, preview: PREVIEW },
} satisfies Meta<typeof CostPreviewDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Preview: Story = {}

export const Loading: Story = { args: { preview: null, loading: true } }

export const OverCap: Story = {
  args: {
    preview: {
      items: [
        {
          label: "Deep score -- Master A",
          model: "gemini-1.5-pro",
          estCostUsd: 9.0,
        },
        {
          label: "Deep score -- Master B",
          model: "gemini-1.5-pro",
          estCostUsd: 9.0,
        },
      ],
      totalUsd: 18.0,
      capRemainingUsd: 16.58,
      overCap: true,
    },
  },
}

export const CapReached: Story = {
  args: {
    capReached: true,
    monthSpend: "$20.00",
    monthlyCap: "$20.00",
    onReConsent: noop,
  },
}
