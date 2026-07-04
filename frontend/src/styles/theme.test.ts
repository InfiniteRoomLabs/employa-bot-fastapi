/**
 * Theme module tests - exercise the light/dark toggle, storage round-trip,
 * and the `[data-theme-toggle]` auto-wiring helper.
 *
 * Coverage targets:
 *  - {@link getTheme}, {@link setTheme}, {@link toggleTheme}
 *  - {@link initTheme} including the `prefers-color-scheme` fallback
 *  - {@link bindThemeToggleButtons} including idempotence + default icons
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  bindThemeToggleButtons,
  getTheme,
  initTheme,
  setTheme,
  toggleTheme,
} from "./theme"

const STORAGE_KEY = "eb-theme"

function clearBody() {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild)
  }
}

describe("theme module", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme")
    localStorage.clear()
  })

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme")
    localStorage.clear()
    clearBody()
  })

  it("getTheme defaults to light when nothing set", () => {
    expect(getTheme()).toBe("light")
  })

  it("setTheme persists to data-theme and localStorage", () => {
    setTheme("dark")
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark")
    expect(getTheme()).toBe("dark")
  })

  it("toggleTheme flips the current value", () => {
    setTheme("light")
    expect(toggleTheme()).toBe("dark")
    expect(getTheme()).toBe("dark")
    expect(toggleTheme()).toBe("light")
    expect(getTheme()).toBe("light")
  })

  it("initTheme rehydrates from localStorage when present", () => {
    localStorage.setItem(STORAGE_KEY, "dark")
    initTheme()
    expect(getTheme()).toBe("dark")
  })

  it("initTheme falls back to prefers-color-scheme when no stored value", () => {
    // jsdom doesn't ship `window.matchMedia` by default, so vi.spyOn would
    // throw "Received undefined". Stub the global directly and tear down in
    //-place so the rehydrate test below doesn't inherit the mock.
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        (query: string): MediaQueryList =>
          ({
            matches: query.includes("dark"),
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
          }) as unknown as MediaQueryList,
      ),
    )
    initTheme()
    expect(getTheme()).toBe("dark")
    vi.unstubAllGlobals()
  })

  it("initTheme ignores garbage localStorage entries", () => {
    localStorage.setItem(STORAGE_KEY, "neon")
    initTheme()
    // Falls through to OS preference (light by default in jsdom).
    expect(["light", "dark"]).toContain(getTheme())
  })

  it("bindThemeToggleButtons wires a click handler and injects default icons", () => {
    const button = document.createElement("button")
    button.setAttribute("data-theme-toggle", "")
    document.body.appendChild(button)

    setTheme("light")
    bindThemeToggleButtons()

    // Default icons appended.
    expect(button.querySelectorAll("svg").length).toBe(2)
    expect(button.classList.contains("theme-toggle")).toBe(true)
    expect(button.getAttribute("aria-label")).toBe("Toggle theme")

    button.click()
    expect(getTheme()).toBe("dark")
  })

  it("bindThemeToggleButtons is idempotent (wired-flag short-circuit)", () => {
    const button = document.createElement("button")
    button.setAttribute("data-theme-toggle", "")
    document.body.appendChild(button)

    bindThemeToggleButtons()
    const firstSvgCount = button.querySelectorAll("svg").length
    bindThemeToggleButtons()
    const secondSvgCount = button.querySelectorAll("svg").length

    expect(firstSvgCount).toBe(secondSvgCount)
  })

  it("bindThemeToggleButtons leaves pre-populated buttons alone (no default icons)", () => {
    const button = document.createElement("button")
    button.setAttribute("data-theme-toggle", "")
    const customSpan = document.createElement("span")
    customSpan.textContent = "Theme"
    button.appendChild(customSpan)
    document.body.appendChild(button)

    bindThemeToggleButtons()

    // Existing markup preserved; no SVGs injected.
    expect(button.querySelectorAll("svg").length).toBe(0)
  })
})
