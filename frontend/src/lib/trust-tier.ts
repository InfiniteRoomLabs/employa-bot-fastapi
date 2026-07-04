/**
 * Trust-tier ordering helpers (D25 / AGT-031). The tier ladder is monotonic;
 * comparing ranks is how the UI decides whether a permission grant is
 * "above tier" (and therefore soft-gated).
 */
import type { AgentTrustTier } from "../data/types"

/** Canonical low-to-high ordering of the trust tiers. */
export const TIER_ORDER: readonly AgentTrustTier[] = [
  "observe",
  "suggest",
  "act-with-approval",
  "autonomous",
]

/** Human-facing label per tier (kept in sync with TRUST_TIER_LADDER). */
export const TIER_LABEL: Readonly<Record<AgentTrustTier, string>> = {
  observe: "Observe",
  suggest: "Suggest",
  "act-with-approval": "Act with approval",
  autonomous: "Autonomous",
}

/** 0-based rank of a tier in the ladder (higher = more autonomy). */
export function tierRank(tier: AgentTrustTier): number {
  return TIER_ORDER.indexOf(tier)
}

/** True when `required` sits strictly above `current` (i.e. an above-tier grant). */
export function isAboveTier(
  required: AgentTrustTier,
  current: AgentTrustTier,
): boolean {
  return tierRank(required) > tierRank(current)
}

/** Tiers strictly above `current` -- the candidates for a "raise tier" action. */
export function tiersAbove(current: AgentTrustTier): readonly AgentTrustTier[] {
  return TIER_ORDER.filter((t) => tierRank(t) > tierRank(current))
}
