import type { Meta, StoryObj } from "@storybook/react-vite"

import ShortlistScreen from "./index"

const meta = {
  title: "Screens/Shortlist",
  component: ShortlistScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ShortlistScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
