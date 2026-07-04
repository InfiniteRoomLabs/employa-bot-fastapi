import type { Meta, StoryObj } from "@storybook/react-vite"
import { CoachActorBadge } from "./coach-actor-badge"

const meta = {
  title: "Atoms/CoachActorBadge",
  component: CoachActorBadge,
  parameters: { layout: "centered" },
} satisfies Meta<typeof CoachActorBadge>

export default meta
type Story = StoryObj<typeof meta>

export const You: Story = { args: { actor: "you" } }
export const Coach: Story = { args: { actor: "coach-on-behalf" } }
export const Agent: Story = { args: { actor: "agent", agentName: "Aria" } }
