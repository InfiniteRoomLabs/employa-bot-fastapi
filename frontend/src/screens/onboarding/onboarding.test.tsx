import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import OnboardingScreen from "./index"

describe("OnboardingScreen", () => {
  it("starts on the welcome + intent step", () => {
    renderScreen(<OnboardingScreen />)
    expect(
      screen.getByRole("heading", { name: /let's get you set up/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/What's your situation/i)).toBeInTheDocument()
    expect(screen.getByText(/Got a resume handy/i)).toBeInTheDocument()
  })

  it("picks an intent option", async () => {
    const user = userEvent.setup()
    renderScreen(<OnboardingScreen />)
    const urgent = screen.getByText(/Need work in under 30 days/i)
    await user.click(urgent)
    expect(urgent.closest("button")).toHaveAttribute("aria-checked", "true")
  })

  it("forks into Branch A (has resume) -> resume upload", async () => {
    const user = userEvent.setup()
    renderScreen(<OnboardingScreen />)
    await user.click(screen.getByRole("button", { name: /Yes, upload one/i }))
    expect(
      screen.getByRole("heading", { name: /Drop in your resume/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/no charge/i)).toBeInTheDocument()
  })

  it("forks into Branch B (no resume) -> light profile", async () => {
    const user = userEvent.setup()
    renderScreen(<OnboardingScreen />)
    await user.click(screen.getByRole("button", { name: /Not right now/i }))
    expect(
      screen.getByRole("heading", { name: /Tell us the basics/i }),
    ).toBeInTheDocument()
  })

  it("marches through Branch A to the done step with both CTAs", async () => {
    const user = userEvent.setup()
    renderScreen(<OnboardingScreen />)
    await user.click(screen.getByRole("button", { name: /Yes, upload one/i }))
    // resume-upload -> confirm-profile -> confirm-search -> power-ups -> done
    for (let i = 0; i < 4; i += 1) {
      await user.click(screen.getByRole("button", { name: /^Continue/i }))
    }
    expect(
      screen.getByRole("heading", { name: /You're all set/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Take me to my dashboard/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Add your first job/i }),
    ).toBeInTheDocument()
  })

  it("marches through Branch B and surfaces the resume options + hiring.cafe pointer", async () => {
    const user = userEvent.setup()
    renderScreen(<OnboardingScreen />)
    await user.click(screen.getByRole("button", { name: /Not right now/i }))
    // light-profile -> first-search
    await user.click(screen.getByRole("button", { name: /^Continue/i }))
    expect(
      screen.getByRole("heading", { name: /Set up your first search/i }),
    ).toBeInTheDocument()
    const hiringCafe = screen.getByRole("link", { name: /hiring\.cafe/i })
    expect(hiringCafe).toHaveAttribute("href", "https://hiring.cafe")
    expect(hiringCafe).toHaveAttribute("target", "_blank")
    // first-search -> resume-options
    await user.click(screen.getByRole("button", { name: /^Continue/i }))
    expect(
      screen.getByRole("heading", { name: /start your career history/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Build it with your Coach/i)).toBeInTheDocument()
    expect(screen.getByText(/Build it yourself/i)).toBeInTheDocument()
  })

  it("shows the power-ups panel with byo-key, forwarding, and extension", async () => {
    const user = userEvent.setup()
    renderScreen(<OnboardingScreen />)
    await user.click(screen.getByRole("button", { name: /Not right now/i }))
    // light-profile -> first-search -> resume-options -> power-ups
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole("button", { name: /^Continue/i }))
    }
    expect(
      screen.getByRole("heading", { name: /Power-ups/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Bring your own AI key/i)).toBeInTheDocument()
    expect(screen.getByText(/Email forward-to-parse/i)).toBeInTheDocument()
    expect(screen.getByText(/Browser extension/i)).toBeInTheDocument()
    expect(screen.getByText(/Your background crew/i)).toBeInTheDocument()
    expect(screen.getByText(/Stale-detector/i)).toBeInTheDocument()
  })

  it("goes back from a forked step to the welcome step", async () => {
    const user = userEvent.setup()
    renderScreen(<OnboardingScreen />)
    await user.click(screen.getByRole("button", { name: /Not right now/i }))
    expect(
      screen.getByRole("heading", { name: /Tell us the basics/i }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /^Back/i }))
    expect(
      screen.getByRole("heading", { name: /let's get you set up/i }),
    ).toBeInTheDocument()
  })

  it("lets you skip from a forked step", async () => {
    const user = userEvent.setup()
    renderScreen(<OnboardingScreen />)
    await user.click(screen.getByRole("button", { name: /Not right now/i }))
    await user.click(screen.getByRole("button", { name: /Skip for now/i }))
    expect(
      screen.getByRole("heading", { name: /Set up your first search/i }),
    ).toBeInTheDocument()
  })

  it("does not surface any removed surveillance/scraper copy", async () => {
    const user = userEvent.setup()
    renderScreen(<OnboardingScreen />)
    await user.click(screen.getByRole("button", { name: /Not right now/i }))
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole("button", { name: /^Continue/i }))
    }
    expect(screen.queryByText(/Boards to scrape/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Job scraper/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Connect Gmail/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Auto-applier/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Tailoring agent/i)).not.toBeInTheDocument()
  })
})
