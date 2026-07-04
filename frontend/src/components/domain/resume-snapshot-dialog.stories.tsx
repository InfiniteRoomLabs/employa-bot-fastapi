import type { Meta, StoryObj } from "@storybook/react-vite"

import { ResumeSnapshotDialog } from "./resume-snapshot-dialog"

/**
 * D10 locked submitted-resume snapshot. Fetches against the mock API by appId.
 * 'stripe' is an applied seed (shows the locked copy); 'modal' is a draft seed
 * (shows the before-APPLIED conflict state).
 */
const meta = {
  title: "Domain/ResumeSnapshotDialog",
  component: ResumeSnapshotDialog,
  parameters: { layout: "centered" },
  args: { open: true, onOpenChange: () => {} },
} satisfies Meta<typeof ResumeSnapshotDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Locked: Story = { args: { appId: "stripe" } }

export const BeforeApplied: Story = { args: { appId: "modal" } }
