import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

import { DatePicker } from "./date-picker"

const meta = {
  title: "Atoms/DatePicker",
  component: DatePicker,
  parameters: { layout: "centered" },
} satisfies Meta<typeof DatePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = { args: { placeholder: "Pick a date" } }

export const Preset: Story = {
  args: { value: new Date(2026, 4, 14) },
}

export const Controlled: Story = {
  render: (args) => {
    const [date, setDate] = useState<Date | undefined>(new Date(2026, 4, 14))
    return <DatePicker {...args} value={date} onChange={setDate} />
  },
}

export const MarkWon: Story = {
  args: {
    placeholder: "Mark won on…",
    ariaLabel: "Mark won on",
  },
}
