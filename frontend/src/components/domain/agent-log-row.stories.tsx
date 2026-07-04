import type { Meta, StoryObj } from "@storybook/react-vite"

import type { AgentLogEntry } from "@/data/types"

import { AgentLogRow } from "./agent-log-row"

const BASE: AgentLogEntry = {
  time: "14:32",
  agentId: "coach",
  kind: "await",
  message: "Drafted follow-up for Supabase",
  ref: "Supabase - Principal Engineer",
}

const meta = {
  title: "Domain/AgentLogRow",
  component: AgentLogRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof AgentLogRow>

export default meta
type Story = StoryObj<typeof meta>

export const Await: Story = { args: { entry: BASE, agentName: "Coach" } }
export const Auto: Story = {
  args: {
    entry: {
      ...BASE,
      agentId: "stale",
      kind: "auto",
      message: "Flagged Stripe as stale (9d, median 6d)",
    },
    agentName: "Stale-detector",
  },
}
export const Success: Story = {
  args: {
    entry: {
      ...BASE,
      kind: "success",
      message: "Sent follow-up to Linear (your click)",
    },
    agentName: "Coach",
  },
}
export const Skipped: Story = {
  args: {
    entry: {
      ...BASE,
      agentId: "ghost",
      kind: "skipped",
      message: "Held off on Sentry - recruiter replied within window",
    },
    agentName: "Ghost-detector",
  },
}
