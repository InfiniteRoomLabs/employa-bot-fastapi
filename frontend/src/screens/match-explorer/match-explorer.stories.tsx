import type { Meta, StoryObj } from "@storybook/react-vite"

import MatchExplorerScreen from "./index"

const meta = {
  title: "Screens/MatchExplorer",
  component: MatchExplorerScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MatchExplorerScreen>

export default meta
type Story = StoryObj<typeof meta>

/** Default view - Distributed-systems v4 vs Stripe Staff Engineer. */
export const Default: Story = {}
