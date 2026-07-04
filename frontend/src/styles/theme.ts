// Employa-Bot — theme toggle (light/dark) — TS port of design_system/theme.js.
//
// Maintains the original contract:
//   * `data-theme` attribute on <html> drives all token CSS.
//   * Choice persists to localStorage under the key `eb-theme`.
//   * Falls back to `prefers-color-scheme` on first load.
//
// Differences from the original IIFE:
//   * No `window.EB_Theme` global. Consumers import typed helpers directly.
//   * `[data-theme-toggle]` auto-wiring is opt-in via `bindThemeToggleButtons()`.
//   * Icon SVGs are constructed via the DOM (createElementNS) rather than
//     `innerHTML`, eliminating any string-injection surface.

export type Theme = "light" | "dark"

const STORAGE_KEY = "eb-theme"
const TOGGLE_SELECTOR = "[data-theme-toggle]"
const WIRED_FLAG = "ebThemeToggleWired"
const SVG_NS = "http://www.w3.org/2000/svg"

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark"
}

function readStored(): Theme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return isTheme(raw) ? raw : null
  } catch {
    return null
  }
}

function writeStored(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // localStorage may be unavailable (private mode, SSR). Ignore.
  }
}

function preferredFromOS(): Theme {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "light"
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function resolveInitialTheme(): Theme {
  const stored = readStored()
  if (stored) {
    return stored
  }
  return preferredFromOS()
}

/**
 * Current theme from the document. Defaults to `light` if the attribute
 * is missing or holds an unexpected value.
 */
export function getTheme(): Theme {
  if (typeof document === "undefined") {
    return "light"
  }
  const attr = document.documentElement.getAttribute("data-theme")
  return isTheme(attr) ? attr : "light"
}

/**
 * Apply the given theme by setting `data-theme` on <html> and persisting
 * the choice. Safe to call from event handlers.
 */
export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") {
    return
  }
  document.documentElement.setAttribute("data-theme", theme)
  writeStored(theme)
}

/**
 * Flip between light and dark. Returns the new theme so callers can
 * update local UI state without a second `getTheme()` read.
 */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark"
  setTheme(next)
  return next
}

/**
 * Initialize the theme on first page load. Mirrors the IIFE in the
 * original design archive — call once near app entry, before React mounts.
 */
export function initTheme(): void {
  if (typeof document === "undefined") {
    return
  }
  setTheme(resolveInitialTheme())
}

function buildSvg(
  extraClass: "sun" | "moon",
  children: ReadonlyArray<readonly [string, Record<string, string>]>,
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("class", extraClass)
  svg.setAttribute("width", "14")
  svg.setAttribute("height", "14")
  svg.setAttribute("viewBox", "0 0 24 24")
  svg.setAttribute("fill", "none")
  svg.setAttribute("stroke", "currentColor")
  svg.setAttribute("stroke-width", "1.6")
  svg.setAttribute("stroke-linecap", "round")
  svg.setAttribute("stroke-linejoin", "round")
  for (const [tag, attrs] of children) {
    const child = document.createElementNS(SVG_NS, tag)
    for (const [key, value] of Object.entries(attrs)) {
      child.setAttribute(key, value)
    }
    svg.appendChild(child)
  }
  return svg
}

function appendDefaultIcons(button: HTMLElement): void {
  const sun = buildSvg("sun", [
    ["circle", { cx: "12", cy: "12", r: "4" }],
    [
      "path",
      {
        d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
      },
    ],
  ])
  const moon = buildSvg("moon", [
    ["path", { d: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" }],
  ])
  button.appendChild(sun)
  button.appendChild(moon)
}

function wireSingleButton(element: Element): void {
  if (!(element instanceof HTMLElement)) {
    return
  }
  if (element.dataset[WIRED_FLAG] === "true") {
    return
  }
  element.dataset[WIRED_FLAG] = "true"

  if (element.childElementCount === 0 && !element.textContent?.trim()) {
    element.classList.add("theme-toggle")
    element.setAttribute("aria-label", "Toggle theme")
    appendDefaultIcons(element)
  }

  element.addEventListener("click", () => {
    toggleTheme()
  })
}

/**
 * Find every `[data-theme-toggle]` in the DOM and attach click handlers
 * (plus default icon markup when the button has no children). Idempotent.
 *
 * For React-driven UIs prefer a real `<ThemeToggle />` component over this.
 * It exists for parity with the design archive and for plain HTML harnesses.
 */
export function bindThemeToggleButtons(root: ParentNode = document): void {
  if (typeof document === "undefined") {
    return
  }
  const apply = (): void => {
    root.querySelectorAll(TOGGLE_SELECTOR).forEach(wireSingleButton)
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true })
  } else {
    apply()
  }
}
