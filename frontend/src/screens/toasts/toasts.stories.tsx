import type { Meta, StoryObj } from "@storybook/react-vite"

import ToastsScreen from "./index"

const meta = {
  title: "Screens/Toasts",
  component: ToastsScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ToastsScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
