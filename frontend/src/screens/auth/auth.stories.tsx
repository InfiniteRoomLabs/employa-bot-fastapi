import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"

import { AuthFlow } from "./index"

const meta = {
  title: "Screens/Auth",
  component: AuthFlow,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuthFlow>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Mode is URL-derived -- seed each surface by mounting at its route. Opt out
 * of preview.tsx's global MemoryRouter (react-router forbids nested Routers)
 * and supply our own at the target path.
 */
const atPath = (path: string): Story => ({
  parameters: { router: { disable: true } },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={[path]}>
        <Story />
      </MemoryRouter>
    ),
  ],
})

/** `/register` surface -- email-first signup. */
export const Register: Story = atPath("/register")

/** `/login` surface -- welcome back. */
export const Login: Story = atPath("/login")

/** `/login/forgot` -- reset-password request. */
export const ForgotPassword: Story = atPath("/login/forgot")

/** `/login/2fa` -- two-factor challenge (demo). */
export const TwoFactor: Story = atPath("/login/2fa")
