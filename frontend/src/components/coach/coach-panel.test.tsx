import { fireEvent, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderScreen } from "@/test/render-screen"
import { CoachPanel } from "./coach-panel"
import { CoachPanelProvider } from "./coach-panel-provider"

describe("CoachPanel", () => {
  it("is collapsed by default and opens on the Cmd-J hotkey", async () => {
    renderScreen(
      <CoachPanelProvider>
        <CoachPanel />
      </CoachPanelProvider>,
      { initialEntries: ["/resumes"] },
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: "j", metaKey: true })
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: /coach/i }),
      ).toBeInTheDocument(),
    )
  })
})
