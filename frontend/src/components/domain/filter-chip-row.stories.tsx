import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"

import { type FilterChipDef, FilterChipRow } from "./filter-chip-row"

const CHIPS: ReadonlyArray<FilterChipDef> = [
  { id: "all", label: "All", variant: "accent", count: 22 },
  { id: "interview", label: "Interviewing", count: 14 },
  { id: "offer", label: "Offers", count: 8 },
]

const meta = {
  title: "Domain/FilterChipRow",
  component: FilterChipRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof FilterChipRow>

export default meta
type Story = StoryObj<typeof meta>

function Wrapper(props: {
  defaultValue?: ReadonlyArray<string>
  addLabel?: string
  onAdd?: () => void
}) {
  const [value, setValue] = React.useState<ReadonlyArray<string>>(
    props.defaultValue ?? ["all"],
  )
  return (
    <FilterChipRow
      chips={CHIPS}
      value={value}
      onChange={setValue}
      addLabel={props.addLabel}
      onAdd={props.onAdd}
    />
  )
}

const NOOP = () => {}

export const Default: Story = {
  args: { chips: CHIPS, value: ["all"], onChange: NOOP },
  render: () => <Wrapper />,
}
export const Multiple: Story = {
  args: { chips: CHIPS, value: ["all", "interview"], onChange: NOOP },
  render: () => <Wrapper defaultValue={["all", "interview"]} />,
}
export const WithAdd: Story = {
  args: {
    chips: CHIPS,
    value: [],
    onChange: NOOP,
    addLabel: "+ filter",
    onAdd: NOOP,
  },
  render: () => <Wrapper addLabel="+ filter" onAdd={() => {}} />,
}
