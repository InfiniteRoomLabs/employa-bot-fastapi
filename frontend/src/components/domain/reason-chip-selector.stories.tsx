import type { Meta, StoryObj } from "@storybook/react-vite"

import { ReasonChipSelector } from "./reason-chip-selector"

/**
 * D16 outcome reason picker. The user tier is exactly 8 toggleable chips; the
 * system tier renders read-only and is never counted against the 8.
 */
const meta = {
  title: "Domain/ReasonChipSelector",
  component: ReasonChipSelector,
  parameters: { layout: "padded" },
  args: { selected: [], onChange: () => {} },
} satisfies Meta<typeof ReasonChipSelector>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithSelectionAndSystemTier: Story = {
  args: {
    selected: ["Compensation too low", "Role not a fit"],
    showSystemTier: true,
  },
}
