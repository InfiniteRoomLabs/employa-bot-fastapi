import type { Meta, StoryObj } from "@storybook/react-vite"
import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button-eb"

import { NotificationsPopover } from "./notifications-popover"

const meta = {
  title: "Domain/NotificationsPopover",
  component: NotificationsPopover,
  parameters: { layout: "centered" },
} satisfies Meta<typeof NotificationsPopover>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    trigger: (
      <Button variant="ghost" size="icon" aria-label="Notifications">
        <Bell className="size-4" aria-hidden />
      </Button>
    ),
  },
}
