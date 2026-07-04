import type { Meta, StoryObj } from "@storybook/react-vite"
import ReviewChangelogScreen from "./index"

const meta = {
  title: "Screens/Intelligence/ReviewChangelog",
  component: ReviewChangelogScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ReviewChangelogScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
