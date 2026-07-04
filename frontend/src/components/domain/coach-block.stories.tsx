import type { Meta, StoryObj } from "@storybook/react-vite"

import { CoachBlock } from "./coach-block"

const meta = {
  title: "Domain/CoachBlock",
  component: CoachBlock,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CoachBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children:
      "You've waited 9 days. Stripe payments-core roles average a 6-day reply. A short non-needy follow-up lifts response rate ~11%.",
  },
}

export const CustomKicker: Story = {
  args: {
    kicker: "Coach · Vercel",
    children:
      "Vercel's offer call is Friday. I drafted a counter - review before the call.",
  },
}
