import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"

import { StatCard } from "@/components/atoms/stat-card"
import { Button } from "@/components/ui/button-eb"

import { AppFrame } from "./app-frame"
import { PageHead } from "./page-head"
import { StatTileGrid } from "./stat-tile-grid"

const meta = {
  title: "Shell/AppFrame",
  component: AppFrame,
  parameters: { layout: "fullscreen" },
  args: { onOpenNotifications: fn() },
} satisfies Meta<typeof AppFrame>

export default meta
type Story = StoryObj<typeof meta>

const dashboardBody = (
  <>
    <PageHead
      eyebrow="Workspace"
      title="Dashboard"
      lede="A snapshot of every search across platform, backend, and AI-infra roles."
      actions={<Button size="sm">New search</Button>}
    />
    <StatTileGrid columns={5}>
      <StatCard label="Active" value="14" delta="+3 this week" tone="up" />
      <StatCard label="Shortlisted" value="22" hint="saved for later" />
      <StatCard label="Awaiting" value="8" delta="2 stale" tone="down" />
      <StatCard label="Interviews" value="3" hint="next: Thu 11am" />
      <StatCard label="Offers" value="1" delta="decide Fri" tone="up" />
    </StatTileGrid>
  </>
)

export const Dashboard: Story = {
  args: {
    active: "dashboard",
    title: "Dashboard",
    subtitle: "Running - last scan 12m ago",
    children: dashboardBody,
  },
}

export const Searches: Story = {
  args: {
    active: "shortlist",
    title: "Staff / Principal - Platform - remote",
    subtitle: "22 shortlisted - 42 jobs - 14 applied",
    children: (
      <PageHead
        eyebrow="Saved search"
        title="Staff / Principal - Platform - remote"
        lede="The sidebar's sub-nav expands when any of the search-related screens is active."
      />
    ),
  },
}

export const BleedMode: Story = {
  args: {
    active: "applications",
    title: "Applications",
    bleed: true,
    children: (
      <div className="p-6">
        <PageHead
          title="Applications"
          lede="Bleed mode strips inner padding so canvas layouts (kanban, agent log) can paint to the edges."
        />
      </div>
    ),
  },
}

export const TopbarActions: Story = {
  args: {
    active: "agents",
    title: "Agents",
    subtitle: "3 running",
    topbarActions: <Button size="sm">Add agent</Button>,
    children: (
      <PageHead
        eyebrow="Library"
        title="Agents"
        lede="topbarActions slot trails the theme toggle."
      />
    ),
  },
}
