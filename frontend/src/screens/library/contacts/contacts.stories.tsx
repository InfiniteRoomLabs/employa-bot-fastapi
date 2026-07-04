import type { Meta, StoryObj } from "@storybook/react-vite"
import ContactsScreen from "./index"

const meta = {
  title: "Screens/Library/Contacts",
  component: ContactsScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ContactsScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
