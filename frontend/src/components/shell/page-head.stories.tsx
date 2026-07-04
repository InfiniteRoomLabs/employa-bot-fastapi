import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "@/components/ui/button-eb"

import { PageHead } from "./page-head"

const meta = {
  title: "Shell/PageHead",
  component: PageHead,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PageHead>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { title: "Dashboard" },
}

export const WithEyebrow: Story = {
  args: { eyebrow: "Workspace", title: "My searches" },
}

export const WithLede: Story = {
  args: {
    eyebrow: "Workspace",
    title: "My searches",
    lede: "Three active jobs being tracked across platform, backend, and AI-infra roles.",
  },
}

export const WithActions: Story = {
  args: {
    eyebrow: "Workspace",
    title: "Applications",
    lede: "Pipeline at a glance.",
    actions: (
      <>
        <Button variant="ghost" size="sm">
          Export
        </Button>
        <Button size="sm">New application</Button>
      </>
    ),
  },
}
