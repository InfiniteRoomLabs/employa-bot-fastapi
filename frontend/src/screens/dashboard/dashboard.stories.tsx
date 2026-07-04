import type { Meta, StoryObj } from "@storybook/react-vite"

import DashboardScreen from "./index"

const meta = {
  title: "Screens/Dashboard",
  component: DashboardScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DashboardScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
