import type { Meta, StoryObj } from "@storybook/react-vite"

import ResumesScreen from "./index"

const meta = {
  title: "Screens/Resumes",
  component: ResumesScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ResumesScreen>

export default meta
type Story = StoryObj<typeof meta>

/** The segmented lifecycle view: Uploads, Masters & variants, Exports. */
export const Default: Story = {}
