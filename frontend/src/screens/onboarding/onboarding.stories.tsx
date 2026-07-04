import type { Meta, StoryObj } from "@storybook/react-vite"

import OnboardingScreen from "./index"

const meta = {
  title: "Screens/Onboarding",
  component: OnboardingScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof OnboardingScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
