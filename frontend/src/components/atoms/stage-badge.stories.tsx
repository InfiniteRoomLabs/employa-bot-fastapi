import type { Meta, StoryObj } from "@storybook/react-vite"

import { StageBadge } from "./stage-badge"

const meta = {
  title: "Atoms/StageBadge",
  component: StageBadge,
  parameters: { layout: "centered" },
} satisfies Meta<typeof StageBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Draft: Story = { args: { stage: "draft" } }
export const Applied: Story = { args: { stage: "applied", label: "Applied" } }
export const Screen: Story = { args: { stage: "screen", label: "In screen" } }
export const Interview: Story = {
  args: { stage: "interview", label: "In interview" },
}
export const Offer: Story = {
  args: { stage: "offer", label: "Offer extended" },
}
export const Rejected: Story = {
  args: { stage: "rejected", label: "Rejected" },
}
export const Live: Story = {
  args: { stage: "interview", label: "Live now", live: true },
}
