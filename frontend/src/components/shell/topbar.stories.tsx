import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"

import { Button } from "@/components/ui/button-eb"

import { Topbar } from "./topbar"

const meta = {
  title: "Shell/Topbar",
  component: Topbar,
  parameters: { layout: "fullscreen" },
  args: { onOpenNotifications: fn() },
} satisfies Meta<typeof Topbar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { title: "Dashboard" },
}

export const WithSubtitle: Story = {
  args: {
    title: "Staff / Principal - Platform - remote",
    subtitle: "Running - last scan 12m ago",
  },
}

export const WithActions: Story = {
  args: {
    title: "Applications",
    subtitle: "14 in flight",
    actions: <Button size="sm">New application</Button>,
  },
}
