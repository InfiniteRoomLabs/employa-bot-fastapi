import type { Meta, StoryObj } from "@storybook/react-vite"

import { TrustTierCard } from "./trust-tier-card"

/**
 * Trust-tier ladder (D25 / AGT-031). Renders against the mock API by agentId.
 * Seed fixtures set each agent to a different tier so the three states show:
 *   stale -> Suggest, ghost -> Act with approval, coach -> Observe.
 */
const meta = {
  title: "Domain/TrustTierCard",
  component: TrustTierCard,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 440 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrustTierCard>

export default meta
type Story = StoryObj<typeof meta>

export const Suggest: Story = { args: { agentId: "stale" } }
export const ActWithApproval: Story = { args: { agentId: "ghost" } }
export const Observe: Story = { args: { agentId: "coach" } }
