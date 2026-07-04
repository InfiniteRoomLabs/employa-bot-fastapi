import type { Meta, StoryObj } from "@storybook/react-vite"

import { CoLogo } from "./co-logo"

const meta = {
  title: "Atoms/CoLogo",
  component: CoLogo,
  parameters: { layout: "centered" },
} satisfies Meta<typeof CoLogo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { name: "Anthropic" } }
export const Small: Story = { args: { name: "Stripe", size: "sm" } }
export const Large: Story = { args: { name: "Vercel", size: "lg" } }
export const Accent: Story = { args: { name: "Linear", accent: true } }
export const LargeAccent: Story = {
  args: { name: "Plaid", size: "lg", accent: true },
}
