import type { Meta, StoryObj } from "@storybook/react-vite"
import CredentialsScreen from "./index"

const meta = {
  title: "Screens/Library/Credentials",
  component: CredentialsScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CredentialsScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
