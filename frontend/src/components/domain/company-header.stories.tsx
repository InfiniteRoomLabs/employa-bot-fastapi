import type { Meta, StoryObj } from "@storybook/react-vite"

import { Button } from "@/components/ui/button-eb"

import { CompanyHeader } from "./company-header"

const meta = {
  title: "Domain/CompanyHeader",
  component: CompanyHeader,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CompanyHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Full: Story = {
  args: {
    name: "Stripe",
    role: "Staff Engineer, Payments core",
    loc: "Remote - US",
    salary: "$255-305k",
    match: 92,
  },
}

export const NoMatch: Story = {
  args: {
    name: "Stripe",
    role: "Staff Engineer, Payments core",
    loc: "Remote - US",
    salary: "$255-305k",
  },
}

export const WithActions: Story = {
  args: {
    name: "Stripe",
    role: "Staff Engineer, Payments core",
    loc: "Remote - US",
    match: 92,
    actions: (
      <>
        <Button variant="secondary" size="sm">
          History
        </Button>
        <Button size="sm">Open detail</Button>
      </>
    ),
  },
}
