import { useEffect, useState } from "react"
import {
  clearStoredAuth,
  fetchUserEmail,
  loadConfig,
  loadStoredAuth,
  probeSheetsApi,
  requestAccessToken,
} from "./lib/googleAuth"
import "./App.css"

type Status =
  | { kind: "boot" }
  | { kind: "need-config" }
  | { kind: "ready"; clientId: string }
  | { kind: "signed-in"; clientId: string; email: string; token: string }
  | { kind: "error"; message: string; clientId?: string }

function isStandalone(): boolean {
  const mq = window.matchMedia("(display-mode: standalone)").matches
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || ios
}

export default function App() {
  const [status, setStatus] = useState<Status>({ kind: "boot" })
  const [busy, setBusy] = useState(false)
  const [probeResult, setProbeResult] = useState<string | null>(null)
  const [displayMode, setDisplayMode] = useState(isStandalone)

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)")
    const onChange = () => setDisplayMode(isStandalone())
    mq.addEventListener?.("change", onChange)
    return () => mq.removeEventListener?.("change", onChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await loadConfig()
        if (cancelled) return
        if (!cfg.googleClientId?.trim()) {
          setStatus({ kind: "need-config" })
          return
        }
        const stored = loadStoredAuth()
        if (
          stored.accessToken &&
          stored.expiresAt &&
          stored.expiresAt > Date.now() &&
          stored.email
        ) {
          setStatus({
            kind: "signed-in",
            clientId: cfg.googleClientId,
            email: stored.email,
            token: stored.accessToken,
          })
          return
        }
        setStatus({ kind: "ready", clientId: cfg.googleClientId })
      } catch (e) {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: e instanceof Error ? e.message : "Boot failed",
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function signIn(clientId: string, _forceConsent = false) {
    setBusy(true)
    setProbeResult(null)
    try {
      const token = await requestAccessToken(clientId, "consent")
      const email = await fetchUserEmail(token)
      setStatus({ kind: "signed-in", clientId, email, token })
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Sign-in failed",
        clientId,
      })
    } finally {
      setBusy(false)
    }
  }

  async function runSheetsProbe(token: string, clientId: string) {
    setBusy(true)
    setProbeResult(null)
    try {
      const url = await probeSheetsApi(token)
      setProbeResult(`Sheets API OK — created probe sheet: ${url}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Probe failed"
      setProbeResult(msg)
      if (msg.includes("401") || msg.includes("UNAUTHENTICATED")) {
        await signIn(clientId, true)
      }
    } finally {
      setBusy(false)
    }
  }

  function signOut() {
    clearStoredAuth()
    setProbeResult(null)
    if (status.kind === "signed-in") {
      setStatus({ kind: "ready", clientId: status.clientId })
    } else if (status.kind === "error" && status.clientId) {
      setStatus({ kind: "ready", clientId: status.clientId })
    } else {
      setStatus({ kind: "need-config" })
    }
  }

  return (
    <div className="page">
      <header className="frame">
        <p className="eyebrow">FAMILY BANK</p>
        <h1>Auth proof</h1>
        <p className="sub">
          Day-one gate: Google sign-in + Sheets from a home-screen icon.
        </p>
        <p className="sub">Build 4 — if you don’t see this line, you’re on a cached copy.</p>
      </header>

      <section className="frame meta">
        <div className="row">
          <span>Display</span>
          <strong>
            {displayMode ? "Home screen / standalone" : "Browser tab"}
          </strong>
        </div>
        <div className="row">
          <span>UA</span>
          <strong className="ua">{navigator.userAgent}</strong>
        </div>
      </section>

      {status.kind === "boot" && <p className="msg">Loading…</p>}

      {status.kind === "need-config" && (
        <section className="frame warn">
          <p>
            <strong>googleClientId</strong> is empty in{" "}
            <code>public/config.json</code>. Create a Google Cloud OAuth Web
            client (Testing mode), add Dan and Jane as test users, allow origin{" "}
            <code>https://playdateplaypass.github.io</code>, put the Client ID
            in config, and redeploy. Finish that setup in a 1:1 chat with
            Builder.
          </p>
        </section>
      )}

      {status.kind === "error" && (
        <section className="frame warn">
          <p>{status.message}</p>
          {status.clientId && (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => signIn(status.clientId!, true)}
            >
              Try sign-in again
            </button>
          )}
        </section>
      )}

      {status.kind === "ready" && (
        <section className="frame">
          <p>Ready to sign in with Google (Sheets scope).</p>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => signIn(status.clientId)}
          >
            {busy ? "Working…" : "Sign in with Google"}
          </button>
          <p className="hint">
            Install to home screen first on Android Chrome and iPhone, then
            open from the icon and sign in here.
          </p>
        </section>
      )}

      {status.kind === "signed-in" && (
        <section className="frame">
          <div className="row">
            <span>Signed in</span>
            <strong>{status.email}</strong>
          </div>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => runSheetsProbe(status.token, status.clientId)}
          >
            {busy ? "Working…" : "Probe Sheets API"}
          </button>
          <button type="button" className="btn ghost" onClick={signOut}>
            Sign out
          </button>
          {probeResult && <p className="probe">{probeResult}</p>}
        </section>
      )}

      <footer className="foot">
        Spec step 1 — prove auth before building the bank UI.
      </footer>
    </div>
  )
}
