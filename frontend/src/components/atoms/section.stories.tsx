import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "@/components/ui/button-eb"

import { Section } from "./section"

const meta = {
  title: "Atoms/Section",
  component: Section,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Section>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: "Filters",
    children: <p>Body content goes here.</p>,
  },
}

export const WithSubtitle: Story = {
  args: {
    title: "Filters",
    subtitle: "Narrow the inbox to what matters this week",
    children: <p>Body content goes here.</p>,
  },
}

export const WithActions: Story = {
  args: {
    title: "Saved filters",
    subtitle: "Re-run any of the searches below.",
    actions: (
      <>
        <Button variant="ghost" size="sm">
          Reset
        </Button>
        <Button size="sm">Save</Button>
      </>
    ),
    children: <p>Body content goes here.</p>,
  },
}
