import type { Meta, StoryObj } from "@storybook/react-vite"
import AnswersScreen from "./index"

const meta = {
  title: "Screens/Library/Answers",
  component: AnswersScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AnswersScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
