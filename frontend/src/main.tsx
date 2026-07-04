import React, { StrictMode } from "react"
import ReactDOM from "react-dom"
import { createRoot } from "react-dom/client"
// CSS load order (do not reorder without reading shadcn-bridge.css header):
//   1. tokens.css        — palette + IRL semantic tokens (--lime-300, --bg, ...)
//   2. index.css         — shadcn defaults (Tailwind v4 @import + @theme inline + :root)
//   3. shadcn-bridge.css — rewrites shadcn's :root vars onto IRL palette tokens
//   4. app.css           — legacy IRL component CSS (transitional; phase 7 rebuilds)
import "./styles/tokens.css"
import "./styles/index.css"
import "./styles/shadcn-bridge.css"
import "./styles/app.css"
import App from "./App.tsx"
import { initTheme } from "./styles/theme.ts"

initTheme()

// Dev-only a11y check (Phase 10): `@axe-core/react` logs accessibility
// violations to the console after every render. The dynamic import keeps
// the dep out of the production bundle — `import.meta.env.DEV` is a
// compile-time constant Vite replaces with `false` for `pnpm build`, so
// the whole block tree-shakes away in prod.
if (import.meta.env.DEV) {
  void import("@axe-core/react").then((mod) => {
    mod.default(React, ReactDOM, 1000)
  })
}

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("Root element #root is missing from index.html")
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
