import type { Meta, StoryObj } from "@storybook/react-vite"

import { StageDot } from "./stage-dot"

const meta = {
  title: "Atoms/StageDot",
  component: StageDot,
  parameters: { layout: "centered" },
} satisfies Meta<typeof StageDot>

export default meta
type Story = StoryObj<typeof meta>

export const Draft: Story = { args: { stage: "draft" } }
export const Applied: Story = { args: { stage: "applied" } }
export const Screen: Story = { args: { stage: "screen" } }
export const Interview: Story = { args: { stage: "interview" } }
export const Offer: Story = { args: { stage: "offer" } }
export const Rejected: Story = { args: { stage: "rejected" } }
export const Stale: Story = { args: { stage: "stale" } }
export const Ghosted: Story = { args: { stage: "ghosted" } }
export const Saved: Story = { args: { stage: "saved" } }
export const Live: Story = { args: { stage: "applied", live: true } }
