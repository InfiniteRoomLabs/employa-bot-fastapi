import type { Meta, StoryObj } from "@storybook/react-vite"
import type { CoachProposal } from "@/data/types"
import { CoachProposalCard } from "./coach-proposal-card"

const proposal: CoachProposal = {
  id: "p1",
  subject: { scope: "résumé", label: "this resume" },
  summary: "Tightened the bullet to lead with the quantified result.",
  diff: [
    {
      field: "Experience bullet",
      before: "Worked on the ingest pipeline and improved performance.",
      after: "Cut ingest p99 from 340ms to 45ms at 2M events/sec.",
    },
  ],
  status: "pending",
}

const meta = {
  title: "Coach/CoachProposalCard",
  component: CoachProposalCard,
  parameters: { layout: "padded" },
  args: { proposal, onAccept: () => {}, onReject: () => {}, onSave: () => {} },
} satisfies Meta<typeof CoachProposalCard>

export default meta
type Story = StoryObj<typeof meta>

export const Pending: Story = {}
export const Accepted: Story = {
  args: { proposal: { ...proposal, status: "accepted" } },
}
