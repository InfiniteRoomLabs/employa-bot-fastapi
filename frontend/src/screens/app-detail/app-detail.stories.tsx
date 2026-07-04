import type { Meta, StoryObj } from "@storybook/react-vite"

import AppDetailScreen from "./index"

const meta = {
  title: "Screens/AppDetail",
  component: AppDetailScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppDetailScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
