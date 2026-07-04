import type { Meta, StoryObj } from "@storybook/react-vite"

import { CostChip } from "./cost-chip"

const meta = {
  title: "Atoms/CostChip",
  component: CostChip,
  parameters: { layout: "centered" },
} satisfies Meta<typeof CostChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { amount: "$1.42" } }
export const CustomLabel: Story = { args: { amount: "$12.30", label: "today" } }
export const Zero: Story = { args: { amount: "$0.00", label: "free tier" } }
