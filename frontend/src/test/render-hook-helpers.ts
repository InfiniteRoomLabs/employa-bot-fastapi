/**
 * Shared `renderHook` helper. Currently a thin pass-through so all hook tests
 * route through one wrapper — Phase 9's theme/persona Context will hook in
 * here without churning every test file.
 */

import { type RenderHookOptions, renderHook } from "@testing-library/react"

export function renderHookWithProviders<TProps, TResult>(
  callback: (props: TProps) => TResult,
  options?: RenderHookOptions<TProps>,
) {
  return renderHook(callback, options)
}
