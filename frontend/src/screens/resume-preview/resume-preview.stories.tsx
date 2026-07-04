import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { RESUME_ID_MASTER, RESUME_ID_VERCEL } from "@/data/fixtures"

import ResumePreviewScreen from "./index"

const meta = {
  title: "Screens/ResumePreview",
  component: ResumePreviewScreen,
  parameters: { layout: "fullscreen", router: { disable: true } },
} satisfies Meta<typeof ResumePreviewScreen>

export default meta
type Story = StoryObj<typeof meta>

/** Default - master resume (unlocked, full body). */
export const Master: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={[`/resume/${RESUME_ID_MASTER}`]}>
        <Routes>
          <Route path="/resume/:id" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
}

/** Locked tailored resume - shows dim overlay + Fork button. */
export const Locked: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={[`/resume/${RESUME_ID_VERCEL}`]}>
        <Routes>
          <Route path="/resume/:id" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
}

/** Not found - unknown id. */
export const NotFound: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/resume/does-not-exist-xyz"]}>
        <Routes>
          <Route path="/resume/:id" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
}
