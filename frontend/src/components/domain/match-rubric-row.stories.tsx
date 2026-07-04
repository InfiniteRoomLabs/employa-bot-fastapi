import type { Meta, StoryObj } from "@storybook/react-vite"

import { MatchRubricRow } from "./match-rubric-row"

const meta = {
  title: "Domain/MatchRubricRow",
  component: MatchRubricRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof MatchRubricRow>

export default meta
type Story = StoryObj<typeof meta>

export const High: Story = {
  args: {
    row: {
      label: "Skills fit",
      score: 90,
      note: "8 of 9 required skills present",
    },
  },
}
export const Mid: Story = {
  args: {
    row: { label: "Comp", score: 70, note: "Posted band overlaps your floor" },
  },
}
export const Low: Story = {
  args: {
    row: {
      label: "Seniority",
      score: 55,
      note: "5y management vs 7-10y asked",
    },
  },
}
export const Compact: Story = {
  args: {
    row: { label: "Skills fit", score: 90, note: "8 of 9" },
    compact: true,
  },
}
