import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

/**
 * Meta-tag CSP fallback (docs/sprints/sprint-01-spec.md PIN-7); the backend
 * serves the same policy as a response header. Injected only at BUILD time:
 * dev mode needs react-refresh's inline preamble, which script-src 'self'
 * blocks (the recorded vite-dev-mode limitation, see docs/progress.md).
 * frame-ancestors is omitted -- it is ignored in meta CSPs (header-only).
 */
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' http://localhost:8000; base-uri 'self'; form-action 'self'"

const injectCsp: Plugin = {
  name: "inject-csp",
  apply: "build",
  transformIndexHtml(html) {
    return html.replace(
      "</title>",
      `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
    )
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), injectCsp],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
