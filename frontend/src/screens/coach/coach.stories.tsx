import type { Meta, StoryObj } from "@storybook/react-vite"

import CoachScreen from "./index"

const meta = {
  title: "Screens/Coach",
  component: CoachScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CoachScreen>

export default meta
type Story = StoryObj<typeof meta>

/** Default - Stripe follow-up thread active (has messages + draft block). */
export const Default: Story = {}
