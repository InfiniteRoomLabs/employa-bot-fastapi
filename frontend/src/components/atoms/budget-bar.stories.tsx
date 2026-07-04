import type { Meta, StoryObj } from "@storybook/react-vite"

import { BudgetBar } from "./budget-bar"

const meta = {
  title: "Atoms/BudgetBar",
  component: BudgetBar,
  parameters: { layout: "centered" },
} satisfies Meta<typeof BudgetBar>

export default meta
type Story = StoryObj<typeof meta>

const dollars = (n: number) => `$${(n / 100).toFixed(2)}`

export const Low: Story = {
  args: { label: "Budget", used: 120, total: 1000, format: dollars },
}
export const Warn: Story = {
  args: { label: "Budget", used: 750, total: 1000, format: dollars },
}
export const Over: Story = {
  args: { label: "Budget", used: 1200, total: 1000, format: dollars },
}
export const SimpleUnits: Story = {
  args: { label: "Runs", used: 3, total: 10 },
}
