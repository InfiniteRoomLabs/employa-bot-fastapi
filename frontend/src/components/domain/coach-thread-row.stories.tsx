import type { Meta, StoryObj } from "@storybook/react-vite"

import type { CoachThread } from "@/data/types"

import { CoachThreadRow } from "./coach-thread-row"

const BASE: CoachThread = {
  id: "stripe",
  title: "Stripe follow-up",
  scope: "application",
  when: "now",
}

const meta = {
  title: "Domain/CoachThreadRow",
  component: CoachThreadRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CoachThreadRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { thread: BASE } }
export const Active: Story = { args: { thread: BASE, active: true } }
export const Resume: Story = {
  args: {
    thread: {
      ...BASE,
      title: "Tailor for Supabase",
      scope: "résumé",
      when: "Yesterday",
    },
  },
}
export const General: Story = {
  args: {
    thread: {
      ...BASE,
      title: "General strategy",
      scope: "general",
      when: "1w",
    },
  },
}
