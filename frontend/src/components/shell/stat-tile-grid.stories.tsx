import type { Meta, StoryObj } from "@storybook/react-vite"

import { StatCard } from "@/components/atoms/stat-card"

import { StatTileGrid } from "./stat-tile-grid"

const meta = {
  title: "Shell/StatTileGrid",
  component: StatTileGrid,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StatTileGrid>

export default meta
type Story = StoryObj<typeof meta>

const tiles = (
  <>
    <StatCard label="Active" value="14" delta="+3 this week" tone="up" />
    <StatCard label="Shortlisted" value="22" hint="saved for later" />
    <StatCard label="Awaiting" value="8" delta="2 stale" tone="down" />
    <StatCard label="Interviews" value="3" hint="next: Thu 11am" />
    <StatCard label="Offers" value="1" delta="decide Fri" tone="up" />
  </>
)

export const AutoFit: Story = {
  args: { children: tiles },
}

export const FiveColumns: Story = {
  args: { children: tiles, columns: 5 },
}

export const ThreeColumns: Story = {
  args: { children: tiles, columns: 3 },
}
