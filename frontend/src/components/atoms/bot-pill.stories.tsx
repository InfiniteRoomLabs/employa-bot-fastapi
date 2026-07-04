import type { Meta, StoryObj } from "@storybook/react-vite"

import { BotPill } from "./bot-pill"

const meta = {
  title: "Atoms/BotPill",
  component: BotPill,
  parameters: { layout: "centered" },
  args: { children: "Ava drafted this" },
} satisfies Meta<typeof BotPill>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Live: Story = { args: { live: true, children: "Ava is typing" } }
export const Muted: Story = {
  args: { muted: true, children: "Auto-generated" },
}
