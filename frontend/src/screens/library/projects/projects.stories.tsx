import type { Meta, StoryObj } from "@storybook/react-vite"
import ProjectsScreen from "./index"

const meta = {
  title: "Screens/Library/Projects",
  component: ProjectsScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ProjectsScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
