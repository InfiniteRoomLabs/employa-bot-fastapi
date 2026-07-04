import path from "node:path"
import { fileURLToPath } from "node:url"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig, mergeConfig } from "vitest/config"
import viteConfig from "./vite.config"

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url))

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
//
// `playwright()` and `defineConfig()` are typed against vitest instances
// resolved through different peer-dep chains (`@vitest/browser-playwright`
// vs `@vitest/ui`). pnpm installs both as distinct package instances at
// the same 4.1.6 version, so TS sees their `BrowserProviderOption` types
// as nominally different even though they're structurally identical.
// `tsc -b` resolves cleanly via project references, but the IDE language
// server flags the assignment. Cast through `unknown` to break the
// nominal-type identity check locally without weakening the surrounding
// config types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const playwrightProvider = playwright({}) as unknown as any

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // The jsdom unit project and the chromium storybook project run
      // concurrently. Under that CPU contention an async screen test
      // (findBy that polls the DOM while the mock resolves) can exceed the
      // 5000ms default purely from event-loop starvation -- not real slowness
      // (mock latency is pinned to 0 below). Raise the ceiling so contention
      // never produces a false timeout. Inherited by both projects.
      testTimeout: 20000,
      hookTimeout: 20000,
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        // Scaffolding & non-behavioural files that don't add real signal:
        // - shadcn primitives (vendored verbatim from `pnpm dlx shadcn add`)
        // - app entry / router wiring (smoke is covered by Playwright)
        // - persona context provider (one ref-only state machine)
        // - co-located test/story files
        // - types-only modules
        exclude: [
          "src/**/*.stories.tsx",
          "src/**/*.test.ts",
          "src/**/*.test.tsx",
          "src/test/**",
          "src/main.tsx",
          "src/App.tsx",
          "src/persona-context.tsx",
          "src/data/types.ts",
          "src/data/fixtures.ts",
          "src/hooks/index.ts",
          "src/components/ui/accordion.tsx",
          "src/components/ui/alert.tsx",
          "src/components/ui/avatar.tsx",
          "src/components/ui/badge.tsx",
          "src/components/ui/button.tsx",
          "src/components/ui/calendar.tsx",
          "src/components/ui/card.tsx",
          "src/components/ui/checkbox.tsx",
          "src/components/ui/command.tsx",
          "src/components/ui/dialog.tsx",
          "src/components/ui/dropdown-menu.tsx",
          "src/components/ui/hover-card.tsx",
          "src/components/ui/input.tsx",
          "src/components/ui/input-group.tsx",
          "src/components/ui/label.tsx",
          "src/components/ui/navigation-menu.tsx",
          "src/components/ui/popover.tsx",
          "src/components/ui/progress.tsx",
          "src/components/ui/radio-group.tsx",
          "src/components/ui/scroll-area.tsx",
          "src/components/ui/select.tsx",
          "src/components/ui/separator.tsx",
          "src/components/ui/sheet.tsx",
          "src/components/ui/skeleton.tsx",
          "src/components/ui/slider.tsx",
          "src/components/ui/sonner.tsx",
          "src/components/ui/switch.tsx",
          "src/components/ui/tabs.tsx",
          "src/components/ui/textarea.tsx",
          "src/components/ui/toggle.tsx",
          "src/components/ui/toggle-group.tsx",
          "src/components/ui/tooltip.tsx",
        ],
        thresholds: {
          lines: 80,
          statements: 80,
          branches: 70,
          functions: 75,
        },
      },
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            globals: true,
            environment: "jsdom",
            css: true,
            setupFiles: ["./src/test/setup.ts"],
            exclude: [
              "node_modules",
              "dist",
              "e2e",
              "tests",
              "playwright-report",
              "blob-report",
              "test-results",
            ],
            env: {
              // Make the mock API instantaneous in unit tests so screen
              // tests don't have to await random 100-400ms timeouts.
              VITE_MOCK_LATENCY_MIN: "0",
              VITE_MOCK_LATENCY_MAX: "0",
            },
          },
        },
        {
          extends: true,
          plugins: [
            // The plugin will run tests for the stories defined in your Storybook config
            // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
            storybookTest({
              configDir: path.join(dirname, ".storybook"),
            }),
          ],
          test: {
            name: "storybook",
            browser: {
              enabled: true,
              headless: true,
              provider: playwrightProvider,
              instances: [
                {
                  browser: "chromium",
                },
              ],
            },
          },
        },
      ],
    },
  }),
)
