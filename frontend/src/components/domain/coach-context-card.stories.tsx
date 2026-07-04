import type { Meta, StoryObj } from "@storybook/react-vite"

import { CoachContextCard } from "./coach-context-card"

const meta = {
  title: "Domain/CoachContextCard",
  component: CoachContextCard,
  parameters: { layout: "centered" },
} satisfies Meta<typeof CoachContextCard>

export default meta
type Story = StoryObj<typeof meta>

export const Application: Story = {
  args: {
    card: {
      label: "Application",
      body: "Stripe - Staff Engineer, Payments core - applied 9d ago - stale",
    },
  },
}
export const Resume: Story = {
  args: { card: { label: "Résumé attached", body: "Distributed-systems v4" } },
}
export const JdExcerpt: Story = {
  args: {
    card: {
      label: "JD excerpt",
      body: "Build and own payment-path services at scale. Idempotency, ledgering, multi-region.",
    },
  },
}
