import type { Meta, StoryObj } from "@storybook/react-vite"

import type { Job } from "@/data/types"

import { JobDetailView } from "./job-detail-view"

const ENRICHED: Job = {
  id: "b7e9c4a1-0d2f-4c83-9a16-1e5f7c3b8d40",
  company: "Stripe",
  title: "Staff Engineer - Payments core",
  location: { raw: "Remote - US", country: "US" },
  workMode: "remote",
  employment: {
    classification: "w2",
    cadence: "salary",
    commitment: "full-time",
  },
  compensation: { min: 255000, max: 305000, extra: [] },
  seniority: "Staff",
  source: {
    board: "greenhouse",
    channel: "url",
    url: "https://boards.greenhouse.io/stripe/jobs/staff-payments-core",
    capturedAt: "2d ago, pasted from hiring.cafe",
  },
  isNew: true,
  posted: "2d ago",
  summary:
    "Own payment-path services handling millions of transactions/min. Idempotency, ledgering, multi-region failover.",
  tags: ["Go", "Rust", "Postgres", "Distributed systems", "Kafka"],
  requirements: ["8+ years backend / distributed systems", "Strong Go or Rust"],
  description:
    "Stripe is hiring a Staff Engineer on Payments core (remote, US). You will own services on the synchronous payment path...",
  match: {
    score: 92,
    strengths: [
      "2M-events/sec ingest pipeline - direct match",
      "Multi-region Postgres migration maps to their failover work",
    ],
    gaps: [
      "No explicit idempotency / exactly-once work surfaced on the resume",
    ],
  },
}

const PARTIAL: Job = {
  id: "f1c3a8e5-4b6d-40c7-be5a-5c9dba7fc184",
  company: "Temporal",
  title: "Staff Engineer",
  location: { raw: "Remote - US" },
  workMode: "remote",
  employment: {
    classification: "w2",
    cadence: "salary",
    commitment: "full-time",
  },
  compensation: { min: 230000, max: 280000, extra: [] },
  source: {
    board: "greenhouse",
    channel: "extension",
    capturedAt: "5d ago, browser extension",
  },
  posted: "5d ago",
}

const HOURLY_CONTRACT: Job = {
  ...PARTIAL,
  id: "c0ffee00-0000-4000-8000-000000000001",
  company: "Contract Staffing Co",
  title: "Staff Engineer - Contract",
  workMode: "remote",
  employment: {
    classification: "1099",
    cadence: "hourly",
    commitment: "part-time",
  },
  compensation: { value: 185, extra: ["/hr"] },
  posted: "1d ago",
  isNew: true,
}

const meta = {
  title: "Domain/JobDetailView",
  component: JobDetailView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof JobDetailView>

export default meta
type Story = StoryObj<typeof meta>

export const Enriched: Story = { args: { job: ENRICHED } }
export const PartialCapture: Story = { args: { job: PARTIAL } }
export const HourlyContract: Story = { args: { job: HOURLY_CONTRACT } }
