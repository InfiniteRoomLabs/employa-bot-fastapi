import type { Meta, StoryObj } from "@storybook/react-vite"

import AgentLogScreen from "./index"

const meta = {
  title: "Screens/AgentLog",
  component: AgentLogScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AgentLogScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
