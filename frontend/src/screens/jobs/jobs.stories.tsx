import type { Meta, StoryObj } from "@storybook/react-vite"

import JobsScreen from "./index"

const meta = {
  title: "Screens/Jobs",
  component: JobsScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof JobsScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
