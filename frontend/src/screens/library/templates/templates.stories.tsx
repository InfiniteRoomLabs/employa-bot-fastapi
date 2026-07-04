import type { Meta, StoryObj } from "@storybook/react-vite"
import TemplatesScreen from "./index"

const meta = {
  title: "Screens/Library/Templates",
  component: TemplatesScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TemplatesScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
