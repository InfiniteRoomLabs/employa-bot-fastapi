import type { Meta, StoryObj } from "@storybook/react-vite"

import { MatchPill } from "./match-pill"

const SUBS = [
  { label: "Skills fit", value: 90 },
  { label: "Seniority", value: 78 },
  { label: "Comp", value: 62 },
  { label: "Location", value: 95 },
  { label: "Culture signal", value: 80 },
]

const meta = {
  title: "Atoms/MatchPill",
  component: MatchPill,
  parameters: { layout: "centered" },
} satisfies Meta<typeof MatchPill>

export default meta
type Story = StoryObj<typeof meta>

export const High: Story = { args: { score: 88 } }
export const Mid: Story = { args: { score: 72 } }
export const Low: Story = { args: { score: 48 } }
export const Compact: Story = { args: { score: 88, compact: true } }
export const Rough: Story = { args: { score: 72, kind: "rough" } }
export const RoughCompact: Story = {
  args: { score: 72, kind: "rough", compact: true },
}
export const Expandable: Story = { args: { score: 84, subs: SUBS } }
export const ExpandableCompact: Story = {
  args: { score: 72, subs: SUBS, compact: true },
}
