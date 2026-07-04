import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "@/components/ui/button-eb"

import { AttnRow } from "./attn-row"

const meta = {
  title: "Domain/AttnRow",
  component: AttnRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof AttnRow>

export default meta
type Story = StoryObj<typeof meta>

export const Reply: Story = {
  args: {
    tag: "reply",
    title: "Vercel sent times for the offer call",
    meta: "3 slots this week · coach drafted a yes-and-counter",
    cta: <Button size="sm">Send</Button>,
    onOverflow: () => {},
  },
}

export const Stale: Story = {
  args: {
    tag: "stale",
    title: "Stripe — 9 days, no response",
    meta: "Avg reply for this team is 6d · follow-up drafted",
    cta: (
      <Button variant="secondary" size="sm">
        Review
      </Button>
    ),
  },
}

export const Prep: Story = {
  args: {
    tag: "prep",
    title: "Linear screen · Thursday 11:00 AM",
    meta: "12 likely questions · prep doc ready",
    cta: (
      <Button variant="secondary" size="sm">
        Open
      </Button>
    ),
  },
}

export const Offer: Story = {
  args: {
    tag: "offer",
    title: "Vercel — decide by Friday",
    meta: "Counter drafted: $265k → $280k + sign-on",
    cta: <Button size="sm">Review</Button>,
  },
}

export const Ghost: Story = {
  args: {
    tag: "ghost",
    title: "Ghost-detector auto-marked Convex rejected",
    meta: "28 days silence · you can undo",
    cta: (
      <Button variant="ghost" size="sm">
        Undo
      </Button>
    ),
  },
}
