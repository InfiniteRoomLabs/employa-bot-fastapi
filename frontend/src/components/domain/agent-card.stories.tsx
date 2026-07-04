import type { Meta, StoryObj } from "@storybook/react-vite"

import type { Agent } from "@/data/types"

import { AgentCard } from "./agent-card"

const BASE: Agent = {
  id: "scout",
  name: "Scout",
  icon: "compass",
  state: "running",
  stateLabel: "running",
  lastActivity: "5m ago",
  actions: 142,
  cost: "$0.84",
  description:
    "Watches job boards and scores new postings against your criteria.",
  live: true,
}

const meta = {
  title: "Domain/AgentCard",
  component: AgentCard,
  parameters: { layout: "centered" },
} satisfies Meta<typeof AgentCard>

export default meta
type Story = StoryObj<typeof meta>

export const Running: Story = { args: { agent: BASE } }
export const Paused: Story = {
  args: {
    agent: {
      ...BASE,
      state: "paused",
      stateLabel: "paused",
      cost: "—",
      lastActivity: "2d ago",
      live: false,
    },
  },
}
export const Demand: Story = {
  args: {
    agent: { ...BASE, state: "demand", stateLabel: "on demand", live: false },
  },
}
export const Error: Story = {
  args: {
    agent: { ...BASE, state: "error", stateLabel: "auth failed", live: false },
  },
}
