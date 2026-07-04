import type { Meta, StoryObj } from "@storybook/react-vite"

import AgentsScreen from "./index"

const meta = {
  title: "Screens/Agents",
  component: AgentsScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AgentsScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
