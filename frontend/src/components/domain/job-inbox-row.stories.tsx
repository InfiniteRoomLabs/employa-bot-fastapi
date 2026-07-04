import type { Meta, StoryObj } from "@storybook/react-vite"

import type { JobInboxItem } from "@/data/types"

import { JobInboxRow } from "./job-inbox-row"

const BASE: JobInboxItem = {
  company: "Stripe",
  role: "Staff Engineer - Payments core",
  location: "Remote - US",
  compensation: "$255-305k",
  match: 92,
  source: "greenhouse",
  isNew: true,
  posted: "2d ago",
}

const meta = {
  title: "Domain/JobInboxRow",
  component: JobInboxRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof JobInboxRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { job: BASE } }
export const Seen: Story = { args: { job: { ...BASE, isNew: false } } }
export const Active: Story = { args: { job: BASE, active: true } }
export const LowMatch: Story = {
  args: { job: { ...BASE, match: 55, isNew: false } },
}
