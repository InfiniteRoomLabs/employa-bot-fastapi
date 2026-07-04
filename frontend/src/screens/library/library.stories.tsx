import type { Meta, StoryObj } from "@storybook/react-vite"
import LibraryScreen from "./index"

const meta = {
  title: "Screens/Library/Overview",
  component: LibraryScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LibraryScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
