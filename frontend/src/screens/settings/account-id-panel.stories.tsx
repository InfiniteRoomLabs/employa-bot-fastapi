import type { Meta, StoryObj } from "@storybook/react-vite"
import { AccountIdPanel } from "./account-id-panel"

const meta = {
  title: "Settings/AccountIdPanel",
  component: AccountIdPanel,
  parameters: { layout: "padded" },
} satisfies Meta<typeof AccountIdPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
