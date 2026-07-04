import type { Meta, StoryObj } from "@storybook/react-vite"

import MarkWonScreen from "./index"

const meta = {
  title: "Screens/MarkWon",
  component: MarkWonScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MarkWonScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
