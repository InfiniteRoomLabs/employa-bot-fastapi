import { BUDGET_TOTAL, BUDGET_USED } from "../data/fixtures"

export interface BudgetSummary {
  used: number
  total: number
}

/**
 * Synchronous hook (no async) -- reads the budget constants derived from
 * SETTINGS_USAGE_TOTALS. Used by the sidebar BudgetBar to stay in sync with
 * the settings usage panel without a separate fetch.
 */
export function useBudgetSummary(): BudgetSummary {
  return { used: BUDGET_USED, total: BUDGET_TOTAL }
}
