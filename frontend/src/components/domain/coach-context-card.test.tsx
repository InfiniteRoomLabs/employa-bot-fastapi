import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CoachContextCard } from "./coach-context-card"

describe("CoachContextCard", () => {
  it("renders label and body", () => {
    render(
      <CoachContextCard
        card={{
          label: "Application",
          body: "Stripe - Staff Engineer, Payments core - 9d ago",
        }}
      />,
    )
    expect(screen.getByText("Application")).toBeInTheDocument()
    expect(screen.getByText(/Stripe - Staff Engineer/)).toBeInTheDocument()
  })

  it("renders children in place of body when supplied", () => {
    render(
      <CoachContextCard card={{ label: "JD excerpt", body: "unused" }}>
        <div>Custom body</div>
      </CoachContextCard>,
    )
    expect(screen.getByText("Custom body")).toBeInTheDocument()
    expect(screen.queryByText("unused")).not.toBeInTheDocument()
  })
})
