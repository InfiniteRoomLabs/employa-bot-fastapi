import type { Preview } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"

// Mirror src/main.tsx load order so primitives in stories resolve through
// the IRL token bridge exactly as they do in the app.
import "../src/styles/tokens.css"
import "../src/styles/index.css"
import "../src/styles/shadcn-bridge.css"
import "../src/styles/app.css"

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
  // Wrap every story in a MemoryRouter so screens + shell components
  // that call useLocation / useNavigate / useParams or render <Link>
  // work in isolation; '/' is the safe default.
  //
  // Stories that need a specific URL (e.g. an `:id`-bound screen) supply
  // their OWN MemoryRouter + Routes via a per-story decorator. Those must
  // opt out of this global router with `parameters: { router: { disable: true } }`
  // -- react-router throws "You cannot render a <Router> inside another
  // <Router>" if both wrap the same tree.
  decorators: [
    (Story, context) =>
      context.parameters?.router?.disable ? (
        <Story />
      ) : (
        <MemoryRouter initialEntries={["/"]}>
          <Story />
        </MemoryRouter>
      ),
  ],
}

export default preview
