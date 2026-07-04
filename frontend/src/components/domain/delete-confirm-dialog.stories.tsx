import type { Meta, StoryObj } from "@storybook/react-vite"

import { DeleteConfirmDialog } from "./delete-confirm-dialog"

/**
 * D24 soft-delete confirm. Fetches the dependent-count impact against the mock
 * API. 'pj-ingest' is a project with dependent accomplishments (drill-down);
 * a contact has none (clean delete).
 */
const meta = {
  title: "Domain/DeleteConfirmDialog",
  component: DeleteConfirmDialog,
  parameters: { layout: "centered" },
  args: { open: true, onOpenChange: () => {}, onConfirm: () => {} },
} satisfies Meta<typeof DeleteConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

export const WithDependents: Story = {
  args: { kind: "project", id: "pj-ingest", label: "Ingest pipeline" },
}

export const NoDependents: Story = {
  args: { kind: "contact", id: "c-any", label: "Maya Chen" },
}
