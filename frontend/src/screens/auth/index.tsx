/**
 * Auth surfaces -- bypasses AppFrame.
 *
 * Two route entries share this one flow component (same pattern as
 * ShortlistScreen serving `shortlist` + `search-shortlist`):
 *   - `register` -> `/register` -> seeds mode `signup`
 *   - `login`    -> `/login`    -> seeds mode `login`
 *
 * Email-first signup flow (decision #34 / AUTH-001 + AUTH-033):
 *   signup (email only) -> check-email -> verify link -> set password + name
 *   -> create account (needs_onboarding) -> /onboarding.
 * forgot-password + the 2FA challenge are reachable demo substates of the
 * login surface (enrollment itself is post-MVP, AUTH-008). These intermediate
 * steps are NOT their own URLs -- only the two top-level surfaces are routed.
 * Cross-surface links ("Log in" <-> "Make an account") navigate between the
 * two routes; intra-surface steps flip local `mode` state.
 *
 * Mockup-honest: no real backend. "Clicking the verification link" is a button
 * that advances the local state machine; account creation just routes onward.
 */

import {
  ArrowRightIcon,
  CheckCircleIcon,
  MailOpenIcon,
  XCircleIcon,
} from "lucide-react"
import * as React from "react"
import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button-eb"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { login } from "@/data/api.ts"
import { MockApiError } from "@/lib/mock-api-error"
import { pathFor } from "@/routes"

type Mode =
  | "signup"
  | "sent"
  | "setup"
  | "login"
  | "forgot"
  | "forgotSent"
  | "2fa"

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-card">
      <div className="auth-card__brand">
        <img src="design_system/mark.svg" width={28} height={28} alt="" />
        <div className="text-[15px] font-semibold">
          employa<span className="text-[var(--fg-subtle)]">-bot</span>
        </div>
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-3.5">
      <div className="mb-1 text-[11.5px] font-semibold text-[var(--fg-muted)]">
        {label}
      </div>
      {children}
      {hint ? (
        <div className="mt-1 text-[11px] text-[var(--fg-subtle)]">{hint}</div>
      ) : null}
    </div>
  )
}

/** Step 1: enter email only. No password here, no social (yet). */
function AuthSignup({
  onContinue,
  onLogin,
}: {
  /** Advance to `/register/check-email`, carrying the typed email forward. */
  onContinue: (email: string) => void
  /** Cross-surface nav: jump to the `/login` route. */
  onLogin: () => void
}) {
  const [email, setEmail] = React.useState("")
  return (
    <AuthCard>
      <h2 className="m-0 mb-1 display text-[28px] font-normal">
        Make your account
      </h2>
      <p className="mb-5 text-[13px] text-[var(--fg-muted)]">
        Enter your email and we will send you a verification link. Free for 14
        days. No card.
      </p>
      {/*
        Social sign-in (Continue with Google / OIDC) is deferred -- not in this
        pass. The AUTH-001 OIDC acceptance criterion lives here when we add it;
        provider buttons + an "or" divider go above the email field.
      */}
      <Field label="Email">
        <Input
          type="email"
          placeholder="you@work.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Button
        variant="default"
        className="mt-1.5 w-full"
        onClick={() => onContinue(email)}
      >
        Send verification link <ArrowRightIcon className="size-4" />
      </Button>
      <p className="mt-3.5 text-center text-[11.5px] text-[var(--fg-subtle)]">
        By continuing you agree to our <u>Terms</u> and <u>Privacy</u>.
      </p>
      <div className="mt-3.5 text-center text-[13px] text-[var(--fg-muted)]">
        Already have an account?{" "}
        <button
          type="button"
          className="text-[var(--fg)] underline"
          onClick={onLogin}
        >
          Log in
        </button>
      </div>
    </AuthCard>
  )
}

/** Step 2: verification email sent. "Click the link" advances to setup (mock). */
function AuthSent({ email, go }: { email: string; go: (mode: Mode) => void }) {
  const shown = email.trim() || "you@work.com"
  return (
    <AuthCard>
      <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-[var(--accent-soft)]">
        <MailOpenIcon className="size-6 text-[var(--accent-text)]" />
      </div>
      <h2 className="m-0 text-center display text-[28px] font-normal">
        Check your email
      </h2>
      <p className="mt-2 text-center text-[13px] text-[var(--fg-muted)]">
        We sent a verification link to
        <br />
        <b>{shown}</b>. Click it to finish setting up your account.
      </p>
      <div className="card mt-4 bg-[var(--bg-subtle)] p-3.5 text-center">
        <div className="mb-2 text-[12px] text-[var(--fg-muted)]">
          Demo: in the real app you would click the link in your inbox.
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-center"
          onClick={() => go("setup")}
        >
          I clicked the link
        </Button>
      </div>
      <div className="mt-3.5 text-center text-[12px] text-[var(--fg-subtle)]">
        Wrong email?{" "}
        <button
          type="button"
          className="underline"
          onClick={() => go("signup")}
        >
          Use a different one
        </button>{" "}
        - <u>Resend</u>
      </div>
    </AuthCard>
  )
}

/** Step 3 (AUTH-033): set password + name -> create account -> onboarding. */
function AuthSetup({ go }: { go: (mode: Mode) => void }) {
  const navigate = useNavigate()
  return (
    <AuthCard>
      <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-[var(--success-soft)]">
        <CheckCircleIcon className="size-6 text-[var(--success-text)]" />
      </div>
      <h2 className="m-0 mb-1 text-center display text-[28px] font-normal">
        Email verified
      </h2>
      <p className="mb-5 text-center text-[13px] text-[var(--fg-muted)]">
        Set a password and tell us your name to finish.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <Input placeholder="Wes" />
        </Field>
        <Field label="Last name">
          <Input placeholder="Gilleland" />
        </Field>
      </div>
      <Field label="Password" hint="10+ chars - 1 number">
        <Input type="password" placeholder="..." />
      </Field>
      {/* Mock: creates the account (needs_onboarding=true) + auto-login, then routes to onboarding. */}
      <Button
        variant="default"
        className="mt-1.5 w-full"
        onClick={() => navigate(pathFor("onboarding"))}
      >
        Create account <ArrowRightIcon className="size-4" />
      </Button>
      <div className="mt-3.5 text-center text-[12px] text-[var(--fg-subtle)]">
        <button
          type="button"
          className="underline"
          onClick={() => go("signup")}
        >
          {"<- start over"}
        </button>
      </div>
    </AuthCard>
  )
}

function AuthLogin({
  go,
  onSignup,
}: {
  go: (mode: Mode) => void
  onSignup: () => void
}) {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogin = async () => {
    setError("")
    setIsSubmitting(true)
    try {
      await login(email, password)
      navigate(pathFor("dashboard"))
    } catch (err) {
      setError(
        err instanceof MockApiError && err.kind === "network"
          ? "Can't reach the server. Check your connection and try again."
          : "Incorrect email or password.",
      )
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard>
      <h2 className="m-0 mb-5 display text-[28px] font-normal">Welcome back</h2>
      {error ? (
        <div
          role="alert"
          className="mb-3.5 text-[12.5px] text-[var(--danger-text)]"
        >
          {error}
        </div>
      ) : null}
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <div className="mb-3.5">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-[11.5px] font-semibold text-[var(--fg-muted)]">
            Password
          </div>
          <button
            type="button"
            className="text-[11.5px] text-[var(--fg-muted)] underline"
            onClick={() => go("forgot")}
          >
            Forgot?
          </button>
        </div>
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <label className="mb-3.5 flex items-center gap-2 text-[13px]">
        <Checkbox defaultChecked />
        Stay signed in for 30 days
      </label>
      <Button
        variant="default"
        className="w-full"
        disabled={isSubmitting}
        onClick={handleLogin}
      >
        {isSubmitting ? (
          "Logging in..."
        ) : (
          <>
            Log in <ArrowRightIcon className="size-4" />
          </>
        )}
      </Button>
      <div className="mt-3.5 text-center text-[13px] text-[var(--fg-muted)]">
        New here?{" "}
        <button
          type="button"
          className="text-[var(--fg)] underline"
          onClick={onSignup}
        >
          Make an account
        </button>
      </div>
    </AuthCard>
  )
}

function AuthForgot({ go }: { go: (mode: Mode) => void }) {
  return (
    <AuthCard>
      <button
        type="button"
        className="text-[12px] text-[var(--fg-muted)] underline"
        onClick={() => go("login")}
      >
        {"<- back to log in"}
      </button>
      <h2 className="mt-2 mb-1 display text-[28px] font-normal">
        Reset your password
      </h2>
      <p className="mb-4 text-[13px] text-[var(--fg-muted)]">
        We will email you a link. Expires in 1 hour.
      </p>
      <Field label="Email">
        <Input type="email" placeholder="you@work.com" />
      </Field>
      <Button
        variant="default"
        className="w-full"
        onClick={() => go("forgotSent")}
      >
        Send reset link
      </Button>
    </AuthCard>
  )
}

function AuthForgotSent({ go }: { go: (mode: Mode) => void }) {
  return (
    <AuthCard>
      <h2 className="mt-2 mb-1 display text-[28px] font-normal">
        Reset your password
      </h2>
      <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--success-soft)] p-3">
        <div className="flex items-center gap-1.5 text-[13px] text-[var(--success-text)]">
          <CheckCircleIcon className="size-3.5" />
          <span>Check your inbox. We sent a reset link.</span>
        </div>
        <div className="mt-1 text-[11.5px] text-[var(--success-text)] opacity-85">
          Didn't get it? Resend in 0:34
        </div>
      </div>
      <div className="mt-4 text-center text-[13px] text-[var(--fg-muted)]">
        <button
          type="button"
          className="text-[var(--fg)] underline"
          onClick={() => go("login")}
        >
          Back to log in
        </button>
      </div>
    </AuthCard>
  )
}

function AuthTwoFA({ go }: { go: (mode: Mode) => void }) {
  const digits: readonly string[] = ["7", "3", "-", "-", "-", "-"]
  return (
    <AuthCard>
      <button
        type="button"
        className="text-[12px] text-[var(--fg-muted)] underline"
        onClick={() => go("login")}
      >
        {"<- log in as someone else"}
      </button>
      <h2 className="mt-2 mb-1 display text-[28px] font-normal">
        One more thing
      </h2>
      <p className="mb-4 text-[13px] text-[var(--fg-muted)]">
        Enter the 6-digit code from your authenticator app.
      </p>
      <div className="mb-4 flex justify-center gap-2">
        {digits.map((digit, index) => (
          <div
            key={index}
            className={
              "grid h-14 w-[46px] place-items-center rounded-[var(--radius-md)] border border-border font-mono text-[22px] font-semibold " +
              (index < 2
                ? "bg-[var(--bg-elevated)] text-[var(--fg)]"
                : "bg-[var(--bg-subtle)] text-[var(--fg-subtle)]")
            }
          >
            {digit}
          </div>
        ))}
      </div>
      <div className="mb-3.5 flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-[13px] text-[var(--danger-text)]">
        <XCircleIcon className="size-3.5" /> That code didn't work. 2 tries
        left.
      </div>
      <Button variant="default" className="w-full" disabled>
        Verify
      </Button>
      <div className="mt-3.5 text-center text-[13px] text-[var(--fg-muted)]">
        Lost your device?{" "}
        <a href="#" className="text-[var(--fg)]">
          Use a backup code
        </a>
      </div>
    </AuthCard>
  )
}

/**
 * Each auth substate is its own URL. One map is the single source of truth;
 * `MODE_BY_PATH` is its inverse so the flow component can derive `mode` from
 * `location.pathname` (these literals must match the `ROUTES` table paths).
 */
const PATH_BY_MODE: Record<Mode, string> = {
  signup: "/register",
  sent: "/register/check-email",
  setup: "/register/set-password",
  login: "/login",
  forgot: "/login/forgot",
  forgotSent: "/login/forgot/sent",
  "2fa": "/login/2fa",
}

const MODE_BY_PATH: Record<string, Mode> = Object.fromEntries(
  Object.entries(PATH_BY_MODE).map(([mode, path]) => [path, mode as Mode]),
) as Record<string, Mode>

/**
 * Shared auth flow. `mode` is derived from the current URL (not local state)
 * so every step is deep-linkable and back/forward works. `go(mode)` navigates
 * to that step's route; the only datum carried across a step is the typed
 * email, passed via router `location.state` from signup -> check-email.
 */
export function AuthFlow() {
  const navigate = useNavigate()
  const location = useLocation()
  const mode = MODE_BY_PATH[location.pathname] ?? "signup"
  const email = (location.state as { email?: string } | null)?.email ?? ""

  const go = (next: Mode) => navigate(PATH_BY_MODE[next])

  return (
    <div className="auth-canvas">
      <div className="mx-auto grid min-h-dvh w-full max-w-[420px] place-items-center px-6 py-12">
        {mode === "signup" && (
          <AuthSignup
            onContinue={(value) =>
              navigate(PATH_BY_MODE.sent, { state: { email: value } })
            }
            onLogin={() => go("login")}
          />
        )}
        {mode === "sent" && <AuthSent email={email} go={go} />}
        {mode === "setup" && <AuthSetup go={go} />}
        {mode === "login" && (
          <AuthLogin go={go} onSignup={() => go("signup")} />
        )}
        {mode === "forgot" && <AuthForgot go={go} />}
        {mode === "forgotSent" && <AuthForgotSent go={go} />}
        {mode === "2fa" && <AuthTwoFA go={go} />}
      </div>
    </div>
  )
}

export default AuthFlow
