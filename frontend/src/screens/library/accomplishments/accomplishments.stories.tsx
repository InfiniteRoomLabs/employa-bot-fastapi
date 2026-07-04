import type { Meta, StoryObj } from "@storybook/react-vite"
import AccomplishmentsScreen from "./index"

const meta = {
  title: "Screens/Library/Accomplishments",
  component: AccomplishmentsScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AccomplishmentsScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
