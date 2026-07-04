import type { Meta, StoryObj } from "@storybook/react-vite"

import { CoachMessage } from "./coach-message"

const meta = {
  title: "Domain/CoachMessage",
  component: CoachMessage,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CoachMessage>

export default meta
type Story = StoryObj<typeof meta>

export const Bot: Story = {
  args: {
    message: {
      id: "1",
      author: "bot",
      text: "9 days is past Stripe's usual response window (median 6d for this team). Want me to draft a short, non-needy follow-up?",
    },
  },
}

export const User: Story = {
  args: {
    message: {
      id: "2",
      author: "user",
      text: "yes please. keep it under 4 sentences.",
    },
  },
}

export const Typing: Story = {
  args: {
    message: {
      id: "3",
      author: "bot",
      text: "One sec -- pulling your multi-region migration numbers",
      typing: true,
    },
  },
}

/** COA-018: Bot message with an inline draft block and Copy button. */
export const WithDraft: Story = {
  args: {
    message: {
      id: "4",
      author: "bot",
      text: "Here's a draft -- aimed at Maya:",
      draft:
        "Hi Maya -- circling back on the Staff Engineer, Payments core role. Happy to walk through the 2M-events/sec ingest pipeline I built if useful. No rush -- just staying on your radar. -- Wes",
    },
  },
}

/** COA-018 AC3: Revised draft with multi-region migration specifics. */
export const WithRevisedDraft: Story = {
  args: {
    message: {
      id: "6",
      author: "bot",
      text: "Revised -- now with the multi-region migration specifics:",
      draft:
        "Hi Maya -- following up on the Staff Engineer, Payments core role. I led a multi-region migration that cut p99 write latency 42% (from 180ms to 105ms) and would love to share how that work maps to Stripe's payment-path goals. Happy to chat this week. -- Wes",
    },
  },
}
