import type { Meta, StoryObj } from "@storybook/react-vite"

import AddAppScreen from "./index"

const meta = {
  title: "Screens/AddApp",
  component: AddAppScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AddAppScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
