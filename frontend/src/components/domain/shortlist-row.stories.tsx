import type { Meta, StoryObj } from "@storybook/react-vite"

import type { ShortlistEntry } from "@/data/types"

import { ShortlistRow } from "./shortlist-row"

const BASE: ShortlistEntry = {
  company: "Stripe",
  role: "Staff Engineer - Payments core",
  location: "Remote - US",
  compensation: "$255-305k",
  match: 88,
  saved: "3d",
  source: "you",
  why: "Platform-team posting, async-first, matches your ingest-pipeline work.",
}

const meta = {
  title: "Domain/ShortlistRow",
  component: ShortlistRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ShortlistRow>

export default meta
type Story = StoryObj<typeof meta>

export const Saved: Story = { args: { entry: BASE } }
export const Stale: Story = { args: { entry: { ...BASE, stale: true } } }
export const NoWhy: Story = { args: { entry: { ...BASE, why: undefined } } }
