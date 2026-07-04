import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Section } from "./section"

describe("Section", () => {
  it("renders the title and body content", () => {
    render(
      <Section title="Filters">
        <div>body content</div>
      </Section>,
    )
    expect(screen.getByRole("heading", { name: "Filters" })).toBeInTheDocument()
    expect(screen.getByText("body content")).toBeInTheDocument()
  })

  it("renders the subtitle when provided", () => {
    render(
      <Section title="Filters" subtitle="Narrow the inbox">
        body
      </Section>,
    )
    expect(screen.getByText("Narrow the inbox")).toBeInTheDocument()
  })

  it("renders the actions slot", () => {
    render(
      <Section title="Filters" actions={<button>reset</button>}>
        body
      </Section>,
    )
    expect(screen.getByRole("button", { name: "reset" })).toBeInTheDocument()
  })

  it("exposes a section body slot for downstream layout", () => {
    const { container } = render(
      <Section title="x">
        <span>inside</span>
      </Section>,
    )
    expect(container.querySelector('[data-slot="section-body"]')).not.toBeNull()
  })

  it("honors caller className", () => {
    const { container } = render(
      <Section title="x" className="custom-test-class">
        body
      </Section>,
    )
    expect(container.querySelector('[data-slot="section"]')).toHaveClass(
      "custom-test-class",
    )
  })
})
