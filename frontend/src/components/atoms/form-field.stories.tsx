import type { Meta, StoryObj } from "@storybook/react-vite"

import { Input } from "@/components/ui/input"

import { FormField } from "./form-field"

const meta = {
  title: "Atoms/FormField",
  component: FormField,
  parameters: { layout: "centered" },
} satisfies Meta<typeof FormField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: "Email",
    children: <Input placeholder="you@example.com" />,
  },
}

export const WithHelper: Story = {
  args: {
    label: "Email",
    helper: "We never share your email",
    children: <Input placeholder="you@example.com" />,
  },
}

export const Required: Story = {
  args: {
    label: "Email",
    required: true,
    children: <Input placeholder="you@example.com" />,
  },
}

export const RequiredWithHelper: Story = {
  args: {
    label: "Title keywords",
    helper: "Comma-separated. e.g. staff engineer, principal engineer",
    required: true,
    children: <Input placeholder="staff engineer" />,
  },
}
