import type { Meta, StoryObj } from "@storybook/react-vite"

import AgentDetailScreen from "./index"

const meta = {
  title: "Screens/AgentDetail",
  component: AgentDetailScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AgentDetailScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
