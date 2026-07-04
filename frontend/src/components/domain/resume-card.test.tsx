import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { Resume } from "@/data/types"

import { ResumeCard } from "./resume-card"

const FIXTURE: Resume = {
  id: "distributed-systems",
  name: "Distributed-systems",
  subtitle: "For Staff / Principal IC roles",
  version: "v4",
  usedIn: 5,
  updated: "1 day ago",
  tag: "DEFAULT",
  match: 92,
}

describe("ResumeCard", () => {
  it("renders name, tag, version, usedIn meta", () => {
    render(<ResumeCard resume={FIXTURE} />)
    expect(screen.getByText("Distributed-systems")).toBeInTheDocument()
    expect(screen.getByText("DEFAULT")).toBeInTheDocument()
    expect(screen.getByText("v4")).toBeInTheDocument()
    expect(screen.getByText(/used in/)).toBeInTheDocument()
  })

  it("renders MatchPill when match is present", () => {
    render(<ResumeCard resume={FIXTURE} />)
    expect(screen.getByText("92")).toBeInTheDocument()
  })

  it("omits MatchPill when match is absent", () => {
    render(<ResumeCard resume={{ ...FIXTURE, match: undefined }} />)
    expect(screen.queryByText("92")).not.toBeInTheDocument()
  })

  it("renders list variant as a row", () => {
    render(<ResumeCard resume={FIXTURE} variant="list" />)
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "list")
  })

  it("calls onSelect from list variant", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ResumeCard resume={FIXTURE} variant="list" onSelect={onSelect} />)
    await user.click(screen.getByRole("button"))
    expect(onSelect).toHaveBeenCalledWith(FIXTURE)
  })
})
