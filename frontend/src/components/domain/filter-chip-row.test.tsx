import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { type FilterChipDef, FilterChipRow } from "./filter-chip-row"

const CHIPS: ReadonlyArray<FilterChipDef> = [
  { id: "all", label: "All", variant: "accent", count: 22 },
  { id: "interview", label: "Interviewing", count: 14 },
  { id: "offer", label: "Offers", count: 8 },
]

describe("FilterChipRow", () => {
  it("renders every chip with its label and count", () => {
    render(<FilterChipRow chips={CHIPS} value={["all"]} onChange={() => {}} />)
    expect(screen.getByRole("button", { name: /All/ })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Interviewing/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Offers/ })).toBeInTheDocument()
  })

  it("marks chips in value as pressed", () => {
    render(
      <FilterChipRow chips={CHIPS} value={["interview"]} onChange={() => {}} />,
    )
    expect(
      screen.getByRole("button", { name: /Interviewing/ }),
    ).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /^All/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })

  it("toggles a chip into the value on press", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FilterChipRow chips={CHIPS} value={["all"]} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: /Interviewing/ }))
    expect(onChange).toHaveBeenCalledWith(["all", "interview"])
  })

  it("toggles a chip out of the value on second press", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <FilterChipRow
        chips={CHIPS}
        value={["all", "interview"]}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole("button", { name: /Interviewing/ }))
    expect(onChange).toHaveBeenCalledWith(["all"])
  })

  it("renders the add chip when onAdd is supplied", async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(
      <FilterChipRow
        chips={CHIPS}
        value={[]}
        onChange={() => {}}
        addLabel="+ filter"
        onAdd={onAdd}
      />,
    )
    await user.click(screen.getByRole("button", { name: /\+ filter/ }))
    expect(onAdd).toHaveBeenCalled()
  })
})
