import type { Meta, StoryObj } from "@storybook/react-vite"

import { StatCard } from "./stat-card"

const meta = {
  title: "Atoms/StatCard",
  component: StatCard,
  parameters: { layout: "centered" },
} satisfies Meta<typeof StatCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { label: "Applied", value: 12 } }
export const WithUpDelta: Story = {
  args: { label: "Replies", value: 5, delta: "+1 vs last", tone: "up" },
}
export const WithDownDelta: Story = {
  args: { label: "Cost", value: "$1.20", delta: "-3% vs last", tone: "down" },
}
export const WithHint: Story = {
  args: { label: "Active agents", value: 3, hint: "within budget" },
}
export const WithDeltaAndHint: Story = {
  args: {
    label: "Match rate",
    value: "64%",
    delta: "+4% vs last",
    tone: "up",
    hint: "rolling 7d",
  },
}
