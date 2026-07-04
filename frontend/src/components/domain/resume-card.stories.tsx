import type { Meta, StoryObj } from "@storybook/react-vite"

import type { Resume } from "@/data/types"

import { ResumeCard } from "./resume-card"

const BASE: Resume = {
  id: "distributed-systems",
  name: "Distributed-systems",
  subtitle: "For Staff / Principal IC roles",
  version: "v4",
  usedIn: 5,
  updated: "1 day ago",
  tag: "DEFAULT",
  match: 92,
}

const meta = {
  title: "Domain/ResumeCard",
  component: ResumeCard,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ResumeCard>

export default meta
type Story = StoryObj<typeof meta>

export const Grid: Story = { args: { resume: BASE, variant: "grid" } }
export const GridNoMatch: Story = {
  args: { resume: { ...BASE, match: undefined }, variant: "grid" },
}
export const Master: Story = {
  args: { resume: { ...BASE, tag: "MASTER" }, variant: "grid" },
}
export const List: Story = { args: { resume: BASE, variant: "list" } }
