import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Badge } from "@/components/ui/badge-eb"

import { TimelineRow } from "./timeline-row"

describe("TimelineRow", () => {
  it("renders time and message", () => {
    render(<TimelineRow time="14:32" msg="Forked résumé for Supabase" />)
    expect(screen.getByText("14:32")).toBeInTheDocument()
    expect(screen.getByText("Forked résumé for Supabase")).toBeInTheDocument()
  })

  it("renders attribution when who is provided", () => {
    render(<TimelineRow time="14:32" who="Tailor" msg="action" />)
    expect(screen.getByText("Tailor")).toBeInTheDocument()
  })

  it("renders the badge slot", () => {
    render(
      <TimelineRow
        time="14:32"
        msg="x"
        badge={<Badge variant="success">done</Badge>}
      />,
    )
    expect(screen.getByText("done")).toBeInTheDocument()
  })
})
