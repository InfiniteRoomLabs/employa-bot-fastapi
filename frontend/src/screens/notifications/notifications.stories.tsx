import type { Meta, StoryObj } from "@storybook/react-vite"

import NotificationsScreen from "./index"

const meta = {
  title: "Screens/Notifications",
  component: NotificationsScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NotificationsScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
