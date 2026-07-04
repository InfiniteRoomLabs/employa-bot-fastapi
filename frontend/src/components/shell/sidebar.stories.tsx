import type { Meta, StoryObj } from "@storybook/react-vite"

import { SEARCH_ID_BACKEND, SEARCH_ID_PLATFORM } from "@/data/fixtures"
import { Sidebar } from "./sidebar"

const meta = {
  title: "Shell/Sidebar",
  component: Sidebar,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: {} }

export const Dashboard: Story = { args: { active: "dashboard" } }

export const InSearches: Story = { args: { active: "shortlist" } }

export const PlatformSearch: Story = { args: { active: SEARCH_ID_PLATFORM } }

export const BackendSearch: Story = { args: { active: SEARCH_ID_BACKEND } }

export const Resumes: Story = { args: { active: "resumes" } }

export const Coach: Story = { args: { active: "coach" } }

export const Agents: Story = { args: { active: "agents" } }

export const Settings: Story = { args: { active: "settings" } }
