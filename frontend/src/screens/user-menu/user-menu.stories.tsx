import type { Meta, StoryObj } from "@storybook/react-vite"

import UserMenuScreen from "./index"

const meta = {
  title: "Screens/UserMenu",
  component: UserMenuScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof UserMenuScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
