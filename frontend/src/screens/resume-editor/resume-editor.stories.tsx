import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { RESUME_ID_FOUNDER } from "@/data/fixtures"

import ResumeEditorScreen from "./index"

const meta = {
  title: "Screens/ResumeEditor",
  component: ResumeEditorScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ResumeEditorScreen>

export default meta
type Story = StoryObj<typeof meta>

/** Legacy static route - locked distributed-systems resume. */
export const Default: Story = {}

/** Parameterized - unlocked DRAFT resume (founder-to-ic). */
export const DraftUnlocked: Story = {
  parameters: { router: { disable: true } },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={[`/resume/${RESUME_ID_FOUNDER}/edit`]}>
        <Routes>
          <Route path="/resume/:id/edit" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
}

/** Seeded from match-explorer gaps (CUR-020). */
export const SeededFromMatchExplorer: Story = {
  parameters: { router: { disable: true } },
  decorators: [
    (Story) => (
      <MemoryRouter
        initialEntries={[
          {
            pathname: `/resume/${RESUME_ID_FOUNDER}/edit`,
            state: {
              from: "match-explorer",
              gaps: [
                {
                  s: "high",
                  t: "Kubernetes operator experience not documented",
                },
                {
                  s: "medium",
                  t: "Multi-region migration impact not quantified on resume",
                },
                {
                  s: "low",
                  t: "p99 latency improvement missing from bullet list",
                },
              ],
              resumeId: RESUME_ID_FOUNDER,
              jobId: "stripe",
            },
          },
        ]}
      >
        <Routes>
          <Route path="/resume/:id/edit" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
}
