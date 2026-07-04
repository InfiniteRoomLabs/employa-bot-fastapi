import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { FormField } from "./form-field"

describe("FormField", () => {
  it("renders the label and child input", () => {
    render(
      <FormField label="Email">
        <input aria-label="email-field" />
      </FormField>,
    )
    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("email-field")).toBeInTheDocument()
  })

  it("renders helper text when provided", () => {
    render(
      <FormField label="Email" helper="We never share your email">
        <input />
      </FormField>,
    )
    expect(screen.getByText("We never share your email")).toBeInTheDocument()
  })

  it("marks the field required (with assistive text)", () => {
    render(
      <FormField label="Email" required>
        <input />
      </FormField>,
    )
    expect(screen.getByText(/required/i)).toBeInTheDocument()
  })

  it("omits the helper node when no helper text is given", () => {
    const { container } = render(
      <FormField label="Email">
        <input />
      </FormField>,
    )
    expect(
      container.querySelector('[data-slot="form-field-helper"]'),
    ).toBeNull()
  })

  it("links control wrapper to label and helper via aria attributes", () => {
    const { container } = render(
      <FormField label="Email" helper="hint">
        <input />
      </FormField>,
    )
    const control = container.querySelector('[data-slot="form-field-control"]')
    expect(control?.getAttribute("aria-labelledby")).toBeTruthy()
    expect(control?.getAttribute("aria-describedby")).toBeTruthy()
  })
})
