import type { Meta, StoryObj } from "@storybook/react-vite"
import { CoachPanel } from "./coach-panel"
import { CoachPanelProvider } from "./coach-panel-provider"

const meta = {
  title: "Coach/CoachPanel",
  component: CoachPanel,
  parameters: { layout: "fullscreen" },
  // Storybook provides a Router globally; only the Coach provider is added here.
  decorators: [
    (Story) => (
      <CoachPanelProvider>
        <Story />
      </CoachPanelProvider>
    ),
  ],
} satisfies Meta<typeof CoachPanel>

export default meta
type Story = StoryObj<typeof meta>

/** Collapsed by default -- summon with the Topbar button or Cmd/Ctrl-J. */
export const Default: Story = {}
