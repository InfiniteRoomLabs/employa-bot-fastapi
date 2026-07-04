import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"
import {
  RESUME_ID_DISTRIBUTED,
  RESUME_ID_MASTER,
  RESUME_ID_VERCEL,
} from "@/data/fixtures"
import { renderScreen } from "@/test/render-screen"

import ResumePreviewScreen from "./index"

describe("ResumePreviewScreen", () => {
  it("renders the back-to-library link", () => {
    renderScreen(<ResumePreviewScreen />)
    expect(screen.getByText(/Resumes library/i)).toBeInTheDocument()
  })

  it("renders resume content when routed with a valid id (master)", async () => {
    render(
      <MemoryRouter initialEntries={[`/resume/${RESUME_ID_MASTER}`]}>
        <Routes>
          <Route path="/resume/:id" element={<ResumePreviewScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    // The h1 heading inside the card should show the resume name
    await waitFor(() => {
      const heading = screen.getByRole("heading", { level: 1 })
      expect(heading).toBeInTheDocument()
    })
  })

  it("renders resume content when routed with distributed-systems id", async () => {
    render(
      <MemoryRouter initialEntries={[`/resume/${RESUME_ID_DISTRIBUTED}`]}>
        <Routes>
          <Route path="/resume/:id" element={<ResumePreviewScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(
        screen.getAllByText(/Distributed-systems/i).length,
      ).toBeGreaterThan(0),
    )
  })

  it("shows not-found panel for unknown id", async () => {
    render(
      <MemoryRouter initialEntries={["/resume/does-not-exist-xyz"]}>
        <Routes>
          <Route path="/resume/:id" element={<ResumePreviewScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(
        screen.getByText(/does not exist or was removed/i),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText(/Back to library/i)).toBeInTheDocument()
  })

  it("shows locked badge for tailored resume", async () => {
    render(
      <MemoryRouter initialEntries={[`/resume/${RESUME_ID_VERCEL}`]}>
        <Routes>
          <Route path="/resume/:id" element={<ResumePreviewScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    // The lock banner shows "Locked - applied" badge
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Fork to draft/i }),
      ).toBeInTheDocument(),
    )
  })
})
