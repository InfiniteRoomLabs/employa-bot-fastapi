import type { Meta, StoryObj } from "@storybook/react-vite"

import { mockApplicationView } from "@/test/mock-application"

import { ApplicationRow } from "./application-row"

const BASE = mockApplicationView()

const meta = {
  title: "Domain/ApplicationRow",
  component: ApplicationRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ApplicationRow>

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
      match: 92,
    },
  },
}
export const Active: Story = { args: { application: BASE, active: true } }
export const Resurrected: Story = {
  args: { application: { ...BASE, resurrected: true, days: 38 } },
}
