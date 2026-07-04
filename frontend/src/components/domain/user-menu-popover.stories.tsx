import type { Meta, StoryObj } from "@storybook/react-vite"

import { Avatar } from "@/components/ui/avatar-eb"
import { Button } from "@/components/ui/button-eb"

import { UserMenuPopover } from "./user-menu-popover"

const meta = {
  title: "Domain/UserMenuPopover",
  component: UserMenuPopover,
  parameters: { layout: "centered" },
} satisfies Meta<typeof UserMenuPopover>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    trigger: (
      <Button variant="ghost" className="gap-2">
        <Avatar name="Wes Gilleland" accent />
        <span>Wes</span>
      </Button>
    ),
  },
}
