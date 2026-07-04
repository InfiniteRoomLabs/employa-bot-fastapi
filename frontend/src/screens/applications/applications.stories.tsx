import type { Meta, StoryObj } from "@storybook/react-vite"

import ApplicationsScreen from "./index"

const meta = {
  title: "Screens/Applications",
  component: ApplicationsScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ApplicationsScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
