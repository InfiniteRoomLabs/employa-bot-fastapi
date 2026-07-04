import type { Meta, StoryObj } from "@storybook/react-vite"

import { AgentState } from "./agent-state"

const meta = {
  title: "Atoms/AgentState",
  component: AgentState,
  parameters: { layout: "centered" },
} satisfies Meta<typeof AgentState>

export default meta
type Story = StoryObj<typeof meta>

export const Running: Story = { args: { state: "running", label: "Running" } }
export const Paused: Story = { args: { state: "paused", label: "Paused" } }
export const Demand: Story = { args: { state: "demand", label: "On demand" } }
export const Error: Story = { args: { state: "error", label: "Error" } }
export const RunningLive: Story = {
  args: { state: "running", label: "Live", live: true },
}
