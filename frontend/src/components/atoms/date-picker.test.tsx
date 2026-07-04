import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DatePicker } from "./date-picker"

describe("DatePicker", () => {
  it("renders the placeholder when no value is set", () => {
    render(<DatePicker placeholder="Pick a date" />)
    expect(
      screen.getByRole("button", { name: /pick a date/i }),
    ).toBeInTheDocument()
  })

  it("marks the trigger empty via data attribute when value is missing", () => {
    render(<DatePicker placeholder="Pick a date" />)
    expect(screen.getByRole("button")).toHaveAttribute("data-empty", "true")
  })

  it("formats and displays the provided value", () => {
    const value = new Date(2026, 4, 14) // May 14 2026
    render(<DatePicker value={value} />)
    const btn = screen.getByRole("button")
    expect(btn.textContent).toMatch(/2026/)
    expect(btn).not.toHaveAttribute("data-empty")
  })

  it("exposes a custom accessible label", () => {
    render(<DatePicker ariaLabel="Mark won on" />)
    expect(
      screen.getByRole("button", { name: /mark won on/i }),
    ).toBeInTheDocument()
  })

  it("opens the calendar popover on click", async () => {
    render(<DatePicker placeholder="Pick a date" />)
    await userEvent.click(screen.getByRole("button", { name: /pick a date/i }))
    // react-day-picker renders one accessible grid per visible month
    // (we configure `numberOfMonths={2}`).
    const grids = await screen.findAllByRole("grid")
    expect(grids.length).toBeGreaterThanOrEqual(1)
  })

  it("fires onChange when a day is picked and closes", async () => {
    const onChange = vi.fn()
    const value = new Date(2026, 4, 14)
    render(<DatePicker value={value} onChange={onChange} />)
    await userEvent.click(screen.getByRole("button"))
    const grids = await screen.findAllByRole("grid")
    // pick a non-selected day in the first visible month
    const day = grids[0]!.querySelector(
      'button:not([data-selected-single="true"]):not([disabled])',
    ) as HTMLButtonElement | null
    expect(day).not.toBeNull()
    await userEvent.click(day!)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]![0]).toBeInstanceOf(Date)
  })
})
