import type { Meta, StoryObj } from "@storybook/react-vite"

import { Badge } from "@/components/ui/badge-eb"

import { TimelineRow } from "./timeline-row"

const meta = {
  title: "Domain/TimelineRow",
  component: TimelineRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof TimelineRow>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
  args: { time: "14:32", msg: "Forked résumé for Supabase" },
}
export const WithWho: Story = {
  args: { time: "14:32", who: "Tailor", msg: "Forked résumé for Supabase" },
}
export const WithBadge: Story = {
  args: {
    time: "Mar 12",
    who: "You",
    msg: "Marked Stripe as applied",
    badge: <Badge variant="success">done</Badge>,
  },
}
