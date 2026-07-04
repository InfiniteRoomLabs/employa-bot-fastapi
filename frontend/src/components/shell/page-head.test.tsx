import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PageHead } from "./page-head"

describe("PageHead", () => {
  it("renders the title as a level-1 heading", () => {
    render(<PageHead title="Dashboard" />)
    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument()
  })

  it("renders the eyebrow when supplied", () => {
    render(<PageHead eyebrow="Workspace" title="My searches" />)
    expect(screen.getByText("Workspace")).toBeInTheDocument()
  })

  it("renders the lede when supplied", () => {
    render(
      <PageHead title="My searches" lede="Three active jobs at a glance." />,
    )
    expect(
      screen.getByText("Three active jobs at a glance."),
    ).toBeInTheDocument()
  })

  it("renders the actions slot when supplied", () => {
    render(<PageHead title="Searches" actions={<button>New search</button>} />)
    expect(
      screen.getByRole("button", { name: "New search" }),
    ).toBeInTheDocument()
  })

  it("omits eyebrow, lede, and actions when not supplied", () => {
    const { container } = render(<PageHead title="x" />)
    expect(
      container.querySelector('[data-slot="page-head-eyebrow"]'),
    ).toBeNull()
    expect(container.querySelector('[data-slot="page-head-lede"]')).toBeNull()
    expect(
      container.querySelector('[data-slot="page-head-actions"]'),
    ).toBeNull()
  })
})
