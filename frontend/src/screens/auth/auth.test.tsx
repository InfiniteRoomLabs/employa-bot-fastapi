import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import AuthFlow from "./index"

// Mode is URL-derived: mount at a path, navigate by clicking. `renderScreen`
// mounts <AuthFlow/> as the bare router child (no <Routes>), so navigate()
// just updates location and the flow re-derives which step to show.

describe("AuthFlow - register surface (/register)", () => {
  it("defaults to email-only signup -- no password, no social", () => {
    renderScreen(<AuthFlow />, { initialEntries: ["/register"] })
    expect(
      screen.getByRole("heading", { name: /Make your account/i }),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText("you@work.com")).toBeInTheDocument()
    // Email-first: the signup step must NOT ask for a password yet...
    expect(screen.queryByText(/^Password$/)).not.toBeInTheDocument()
    // ...and social sign-in is deferred for now.
    expect(screen.queryByText(/Continue with Google/i)).not.toBeInTheDocument()
  })

  it("signup -> /register/check-email, carrying the typed email forward", () => {
    renderScreen(<AuthFlow />, { initialEntries: ["/register"] })
    fireEvent.change(screen.getByPlaceholderText("you@work.com"), {
      target: { value: "nadia@work.com" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: /Send verification link/i }),
    )
    expect(
      screen.getByRole("heading", { name: /Check your email/i }),
    ).toBeInTheDocument()
    // The email typed at signup is carried via router state to the next step.
    expect(screen.getByText("nadia@work.com")).toBeInTheDocument()
  })

  it("verification link advances to set password + name", () => {
    renderScreen(<AuthFlow />, { initialEntries: ["/register"] })
    fireEvent.click(
      screen.getByRole("button", { name: /Send verification link/i }),
    )
    fireEvent.click(screen.getByRole("button", { name: /I clicked the link/i }))
    expect(
      screen.getByRole("heading", { name: /Email verified/i }),
    ).toBeInTheDocument()
    // Password is collected HERE, after verification (not at signup).
    expect(screen.getByText(/^Password$/)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Create account/i }),
    ).toBeInTheDocument()
  })

  it('"Log in" link navigates to the /login surface', () => {
    renderScreen(<AuthFlow />, { initialEntries: ["/register"] })
    fireEvent.click(screen.getByRole("button", { name: /^Log in$/i }))
    expect(
      screen.getByRole("heading", { name: /Welcome back/i }),
    ).toBeInTheDocument()
  })
})

describe("AuthFlow - login surface (/login)", () => {
  it("renders the login surface, which also has no social sign-in", () => {
    renderScreen(<AuthFlow />, { initialEntries: ["/login"] })
    expect(
      screen.getByRole("heading", { name: /Welcome back/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Continue with Google/i)).not.toBeInTheDocument()
  })

  it('"Make an account" link navigates to the /register surface', () => {
    renderScreen(<AuthFlow />, { initialEntries: ["/login"] })
    fireEvent.click(screen.getByRole("button", { name: /Make an account/i }))
    expect(
      screen.getByRole("heading", { name: /Make your account/i }),
    ).toBeInTheDocument()
  })

  it('"Forgot?" advances to the reset-password step', () => {
    renderScreen(<AuthFlow />, { initialEntries: ["/login"] })
    fireEvent.click(screen.getByRole("button", { name: /Forgot\?/i }))
    expect(
      screen.getByRole("heading", { name: /Reset your password/i }),
    ).toBeInTheDocument()
  })
})

describe("AuthFlow - deep links", () => {
  it("mounts the forgot-password step directly at /login/forgot", () => {
    renderScreen(<AuthFlow />, { initialEntries: ["/login/forgot"] })
    expect(
      screen.getByRole("heading", { name: /Reset your password/i }),
    ).toBeInTheDocument()
  })

  it("mounts the 2FA challenge directly at /login/2fa", () => {
    renderScreen(<AuthFlow />, { initialEntries: ["/login/2fa"] })
    expect(
      screen.getByRole("heading", { name: /One more thing/i }),
    ).toBeInTheDocument()
  })

  it("mounts the set-password step directly at /register/set-password", () => {
    renderScreen(<AuthFlow />, { initialEntries: ["/register/set-password"] })
    expect(
      screen.getByRole("heading", { name: /Email verified/i }),
    ).toBeInTheDocument()
  })
})
