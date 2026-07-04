import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { RESUME_ID_FOUNDER } from "@/data/fixtures"
import { renderScreen } from "@/test/render-screen"

import ResumeEditorScreen from "./index"

describe("ResumeEditorScreen", () => {
  it("renders the locked banner and suggestions pane (legacy/fallback route)", async () => {
    renderScreen(<ResumeEditorScreen />)
    // LEGACY_RESUME_ID is RESUME_ID_DISTRIBUTED (DEFAULT tag + usedIn=5 -> locked)
    await waitFor(() =>
      expect(screen.getAllByText(/Locked/i).length).toBeGreaterThan(0),
    )
    expect(screen.getByText(/Coach suggestions/i)).toBeInTheDocument()
  })

  it("renders suggestions rail with fallback suggestions", async () => {
    renderScreen(<ResumeEditorScreen />)
    await waitFor(() =>
      expect(screen.getByText(/Coach suggestions/i)).toBeInTheDocument(),
    )
    // At least one suggestion is rendered
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /Apply|Open/i }).length,
      ).toBeGreaterThan(0),
    )
  })

  it("shows gap-seeded suggestions when navigated from match-explorer", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: `/resume/${RESUME_ID_FOUNDER}/edit`,
            state: {
              from: "match-explorer",
              gaps: [
                { severity: "high", text: "No ICU float pool experience" },
                {
                  severity: "medium",
                  text: "Multi-region migration impact not quantified",
                },
              ],
              resumeId: RESUME_ID_FOUNDER,
              jobId: "stripe",
            },
          },
        ]}
      >
        <Routes>
          <Route path="/resume/:id/edit" element={<ResumeEditorScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(screen.getByText(/Seeded from 2 gaps/i)).toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(
        screen.getByText(/No ICU float pool experience/i),
      ).toBeInTheDocument(),
    )
  })

  it("shows the formatting toolbar + Save/Discard/Cancel on an editable resume", async () => {
    // founder-to-ic is a DRAFT with usedIn=0 -> not locked -> editable.
    render(
      <MemoryRouter initialEntries={[`/resume/${RESUME_ID_FOUNDER}/edit`]}>
        <Routes>
          <Route path="/resume/:id/edit" element={<ResumeEditorScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    // Formatting toolbar present (bold / italic / lists / heading / undo / redo).
    await waitFor(() =>
      expect(
        screen.getByRole("toolbar", { name: /Formatting/i }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole("button", { name: /Bold/i })).toBeInTheDocument()
    // Action bar: Cancel is always available; Save + Discard are disabled until dirty.
    expect(screen.getByRole("button", { name: /^Cancel$/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Save$/ })).toBeDisabled()
    expect(screen.getByRole("button", { name: /^Discard$/ })).toBeDisabled()
  })

  it("shows not-found when resume id is unknown", async () => {
    render(
      <MemoryRouter initialEntries={["/resume/does-not-exist/edit"]}>
        <Routes>
          <Route path="/resume/:id/edit" element={<ResumeEditorScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(
        screen.getByText(/does not exist or was removed/i),
      ).toBeInTheDocument(),
    )
  })
})
