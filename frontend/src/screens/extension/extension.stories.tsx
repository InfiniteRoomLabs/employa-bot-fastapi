import type { Meta, StoryObj } from "@storybook/react-vite"

import ExtensionScreen from "./index"

const meta = {
  title: "Screens/Extension",
  component: ExtensionScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ExtensionScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
