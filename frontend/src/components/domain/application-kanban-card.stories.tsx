import type { Meta, StoryObj } from "@storybook/react-vite"

import { mockApplicationView } from "@/test/mock-application"

import { ApplicationKanbanCard } from "./application-kanban-card"

const BASE = mockApplicationView()

const meta = {
  title: "Domain/ApplicationKanbanCard",
  component: ApplicationKanbanCard,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ApplicationKanbanCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { application: BASE } }
export const Stale: Story = {
  args: { application: { ...BASE, flag: "stale" } },
}
export const Offer: Story = {
  args: {
    application: {
      ...BASE,
      stage: "offer",
      stageLabel: "Offer",
      flag: "offer",
    },
  },
}
