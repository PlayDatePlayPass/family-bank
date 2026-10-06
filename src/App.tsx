import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { OfflineBanner } from "./components/OfflineBanner"
import {
  clearStoredAuth,
  fetchUserEmail,
  loadConfig,
  loadStoredAuth,
  requestAccessToken,
} from "./lib/googleAuth"
import {
  balanceForKid,
  enrichTransactions,
  oppositeType,
  type EnrichedTx,
} from "./lib/ledger"
import {
  clearSheetId,
  loadActiveKidId,
  loadSheetId,
  saveActiveKidId,
  saveSheetId,
} from "./lib/storage"
import {
  appendKid,
  appendTag,
  appendTransaction,
  createFamilyBankSheet,
  fixKidId,
  readBankData,
  sheetUrl,
  updateKidDisplay,
  validateFamilyBankSheet,
} from "./lib/sheets"
import { parseSheetId } from "./lib/ids"
import { applyThemeToRoot, themeVars } from "./lib/theme"
import type { BankData, Kid, Overlay, ThemeFamily, TxType } from "./lib/types"
import { AddEntry } from "./screens/AddEntry"
import { ConnectSheet } from "./screens/ConnectSheet"
import { EntryDetail } from "./screens/EntryDetail"
import { Home } from "./screens/Home"
import { OpenAccount } from "./screens/OpenAccount"
import { Settings } from "./screens/Settings"
import { SignIn } from "./screens/SignIn"
import "./App.css"

type Auth =
  | { kind: "boot" }
  | { kind: "need-config" }
  | { kind: "signed-out"; clientId: string }
  | { kind: "signed-in"; clientId: string; email: string; token: string }
  | { kind: "error"; clientId?: string; message: string }

const BUILD = 6

export default function App() {
  const [auth, setAuth] = useState<Auth>({ kind: "boot" })
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [sheetId, setSheetId] = useState<string | null>(() => loadSheetId())
  const [data, setData] = useState<BankData | null>(null)
  const [enriched, setEnriched] = useState<EnrichedTx[]>([])
  const [activeKidId, setActiveKidId] = useState<string | null>(() =>
    loadActiveKidId(),
  )
  const [overlay, setOverlay] = useState<Overlay>({ kind: "none" })
  const [connectError, setConnectError] = useState<string | null>(null)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [flashing, setFlashing] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)
  const historyPushed = useRef(false)

  // online / offline
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  // boot config + stored auth
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await loadConfig()
        if (cancelled) return
        if (!cfg.googleClientId?.trim()) {
          setAuth({ kind: "need-config" })
          return
        }
        const stored = loadStoredAuth()
        if (
          stored.accessToken &&
          stored.expiresAt &&
          stored.expiresAt > Date.now() &&
          stored.email
        ) {
          setAuth({
            kind: "signed-in",
            clientId: cfg.googleClientId,
            email: stored.email,
            token: stored.accessToken,
          })
          return
        }
        setAuth({ kind: "signed-out", clientId: cfg.googleClientId })
      } catch (e) {
        if (!cancelled) {
          setAuth({
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

  const getToken = useCallback(
    async (force = false): Promise<{ token: string; email: string; clientId: string }> => {
      if (auth.kind !== "signed-in" && auth.kind !== "signed-out" && auth.kind !== "error") {
        throw new Error("Not ready")
      }
      const clientId =
        auth.kind === "signed-in" || auth.kind === "signed-out"
          ? auth.clientId
          : auth.clientId
      if (!clientId) throw new Error("Missing client id")
      const stored = loadStoredAuth()
      if (
        !force &&
        stored.accessToken &&
        stored.expiresAt &&
        stored.expiresAt > Date.now()
      ) {
        const email =
          stored.email ||
          (auth.kind === "signed-in" ? auth.email : await fetchUserEmail(stored.accessToken))
        return { token: stored.accessToken, email, clientId }
      }
      const token = await requestAccessToken(clientId, force ? "consent" : "")
      const email = await fetchUserEmail(token)
      setAuth({ kind: "signed-in", clientId, email, token })
      return { token, email, clientId }
    },
    [auth],
  )

  const refreshData = useCallback(
    async (id?: string) => {
      const sid = id || sheetId
      if (!sid) return
      const { token } = await getToken()
      try {
        const bank = await readBankData(token, sid)
        const { rows, issues } = enrichTransactions(bank.transactions, bank.kids)
        setData({ ...bank, issues: [...bank.issues, ...issues].filter((v, i, a) =>
          a.findIndex((x) => x.kind === v.kind && x.rowIndex === v.rowIndex && x.message === v.message) === i,
        ) })
        setEnriched(rows)
        setUpdatedAt(new Date())
        setLoadError(null)
        if (bank.kids.length) {
          const still = bank.kids.find((k) => k.kidId === activeKidId)
          if (!still) {
            const next = bank.kids[0]!.kidId
            setActiveKidId(next)
            saveActiveKidId(next)
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Load failed"
        if (msg.includes("401") || msg.includes("UNAUTHENTICATED")) {
          const again = await getToken(true)
          const bank = await readBankData(again.token, sid)
          const { rows, issues } = enrichTransactions(bank.transactions, bank.kids)
          setData({ ...bank, issues })
          setEnriched(rows)
          setUpdatedAt(new Date())
          setLoadError(null)
          return
        }
        if (msg.includes("404") || msg.includes("403")) {
          setLoadError("Can't open the Family Bank sheet.")
          return
        }
        setLoadError(msg)
      }
    },
    [sheetId, getToken, activeKidId],
  )

  // load sheet when signed in
  useEffect(() => {
    if (auth.kind !== "signed-in" || !sheetId) return
    void refreshData(sheetId)
  }, [auth.kind, sheetId]) // eslint-disable-line react-hooks/exhaustive-deps

  // re-read on focus / visibility
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && sheetId && auth.kind === "signed-in") {
        void refreshData()
      }
    }
    window.addEventListener("focus", onVis)
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.removeEventListener("focus", onVis)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [refreshData, sheetId, auth.kind])

  // Android back closes overlay
  useEffect(() => {
    if (overlay.kind === "none") {
      historyPushed.current = false
      return
    }
    if (!historyPushed.current) {
      history.pushState({ fbOverlay: true }, "")
      historyPushed.current = true
    }
    const onPop = () => {
      historyPushed.current = false
      setOverlay({ kind: "none" })
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [overlay.kind])

  const activeKid: Kid | null = useMemo(() => {
    if (!data?.kids.length) return null
    return (
      data.kids.find((k) => k.kidId === activeKidId) || data.kids[0] || null
    )
  }, [data, activeKidId])

  // theme
  useEffect(() => {
    if (activeKid) {
      applyThemeToRoot(themeVars(activeKid.theme, activeKid.color))
    } else {
      applyThemeToRoot(themeVars("Bold", "#D0021B"))
    }
  }, [activeKid])

  async function signIn() {
    if (auth.kind !== "signed-out" && auth.kind !== "error") return
    const clientId = auth.clientId
    if (!clientId) return
    setBusy(true)
    setSignInError(null)
    try {
      const token = await requestAccessToken(clientId, "consent")
      const email = await fetchUserEmail(token)
      setAuth({ kind: "signed-in", clientId, email, token })
    } catch (e) {
      setSignInError(e instanceof Error ? e.message : "Sign-in failed")
      setAuth({ kind: "error", clientId, message: "Couldn't sign in. Try again." })
    } finally {
      setBusy(false)
    }
  }

  function signOut() {
    clearStoredAuth()
    setData(null)
    setEnriched([])
    setOverlay({ kind: "none" })
    if (auth.kind === "signed-in") {
      setAuth({ kind: "signed-out", clientId: auth.clientId })
    } else if (auth.kind === "error" && auth.clientId) {
      setAuth({ kind: "signed-out", clientId: auth.clientId })
    }
  }

  async function withWrite<T>(fn: (token: string, email: string) => Promise<T>): Promise<T> {
    try {
      const { token, email } = await getToken()
      return await fn(token, email)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("401") || msg.includes("UNAUTHENTICATED")) {
        const { token, email } = await getToken(true)
        return await fn(token, email)
      }
      throw e
    }
  }

  async function handleCreateSheet() {
    setBusy(true)
    setConnectError(null)
    try {
      const created = await withWrite((token) => createFamilyBankSheet(token))
      saveSheetId(created.spreadsheetId)
      setSheetId(created.spreadsheetId)
      setCreatedUrl(created.spreadsheetUrl)
      await refreshData(created.spreadsheetId)
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Create failed")
    } finally {
      setBusy(false)
    }
  }

  async function handleUseExisting(input: string) {
    setBusy(true)
    setConnectError(null)
    try {
      const id = parseSheetId(input)
      if (!id) {
        setConnectError("Paste a valid Sheets link or ID.")
        return
      }
      const { token } = await getToken()
      const result = await validateFamilyBankSheet(token, id)
      if (!result.ok) {
        setConnectError(result.reason)
        return
      }
      saveSheetId(id)
      setSheetId(id)
      setCreatedUrl(null)
      await refreshData(id)
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Connect failed")
    } finally {
      setBusy(false)
    }
  }

  async function handleOpenAccount(args: {
    name: string
    theme: ThemeFamily
    color: string
  }) {
    if (!sheetId) return
    setBusy(true)
    try {
      const kidId = await withWrite((token, email) =>
        appendKid(token, sheetId, { ...args, email }),
      )
      saveActiveKidId(kidId)
      setActiveKidId(kidId)
      setOverlay({ kind: "none" })
      await refreshData()
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Open Account failed")
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEntry(entry: {
    date: string
    amount: number
    tag: string
    note: string
    corrects?: string
  }, mode: TxType) {
    if (!sheetId || !activeKid) throw new Error("No kid")
    setBusy(true)
    try {
      await withWrite((token, email) =>
        appendTransaction(token, sheetId, {
          date: entry.date,
          kidId: activeKid.kidId,
          kidName: activeKid.name,
          type: mode,
          tag: entry.tag,
          amount: entry.amount,
          note: entry.note,
          corrects: entry.corrects,
          email,
        }),
      )
      setOverlay({ kind: "none" })
      await refreshData()
      setFlashing(true)
      window.setTimeout(() => setFlashing(false), 600)
    } finally {
      setBusy(false)
    }
  }

  async function handleReverse(tx: EnrichedTx, note?: string) {
    if (!sheetId || !activeKid) return
    setBusy(true)
    try {
      await withWrite((token, email) =>
        appendTransaction(token, sheetId, {
          date: tx.date,
          kidId: tx.kidId || activeKid.kidId,
          kidName: tx.kidName || activeKid.name,
          type: oppositeType(tx.type),
          tag: "Correction",
          amount: tx.amount,
          note: note || `Reversal of ${tx.id}`,
          reverses: tx.id,
          email,
        }),
      )
      setOverlay({ kind: "none" })
      await refreshData()
    } finally {
      setBusy(false)
    }
  }

  async function handleCorrectSave(
    original: EnrichedTx,
    entry: {
      date: string
      amount: number
      tag: string
      note: string
    },
  ) {
    if (!sheetId || !activeKid) throw new Error("No kid")
    setBusy(true)
    try {
      await withWrite(async (token, email) => {
        await appendTransaction(token, sheetId, {
          date: original.date,
          kidId: original.kidId || activeKid.kidId,
          kidName: original.kidName || activeKid.name,
          type: oppositeType(original.type),
          tag: "Correction",
          amount: original.amount,
          note: `Reversal of ${original.id}`,
          reverses: original.id,
          email,
        })
        try {
          await appendTransaction(token, sheetId, {
            date: entry.date,
            kidId: original.kidId || activeKid.kidId,
            kidName: activeKid.name,
            type: original.type,
            tag: original.type === "Deposit" ? entry.tag : "",
            amount: entry.amount,
            note: entry.note,
            corrects: original.id,
            email,
          })
        } catch {
          // reversal already landed
          throw new Error(
            "Reversal saved but the correction entry failed. Re-enter the corrected values.",
          )
        }
      })
      setOverlay({ kind: "none" })
      await refreshData()
      setFlashing(true)
      window.setTimeout(() => setFlashing(false), 600)
    } finally {
      setBusy(false)
    }
  }

  // ——— render ———

  if (auth.kind === "boot") {
    return (
      <div className="page">
        <p className="msg">Loading…</p>
      </div>
    )
  }

  if (auth.kind === "need-config") {
    return (
      <div className="page">
        <section className="frame warn">
          <p>
            <strong>googleClientId</strong> is empty in config.json.
          </p>
        </section>
      </div>
    )
  }

  if (auth.kind === "signed-out" || (auth.kind === "error" && !sheetId)) {
    return (
      <>
        <OfflineBanner online={online} />
        <SignIn
          busy={busy}
          error={signInError || (auth.kind === "error" ? auth.message : null)}
          onSignIn={signIn}
        />
      </>
    )
  }

  if (auth.kind !== "signed-in") {
    return (
      <div className="page">
        <p className="err-msg">{auth.kind === "error" ? auth.message : "Error"}</p>
        <button type="button" className="btn" onClick={signIn}>
          Try sign-in again
        </button>
      </div>
    )
  }

  // signed in, no sheet
  if (!sheetId) {
    return (
      <>
        <OfflineBanner online={online} />
        <ConnectSheet
          busy={busy}
          online={online}
          error={connectError}
          createdUrl={createdUrl}
          onCreate={handleCreateSheet}
          onUseExisting={handleUseExisting}
        />
      </>
    )
  }

  if (loadError && !data) {
    return (
      <div className="page">
        <OfflineBanner online={online} />
        <section className="frame warn">
          <p>{loadError}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              clearSheetId()
              setSheetId(null)
              setLoadError(null)
            }}
          >
            Switch Sheet
          </button>
          <button type="button" className="btn ghost" onClick={signOut}>
            Sign out
          </button>
        </section>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page">
        <OfflineBanner online={online} />
        <p className="msg">Loading Family Bank…</p>
        <p className="hint">Build {BUILD}</p>
      </div>
    )
  }

  // kids empty → Open Account (unless overlay already open-account from settings)
  const needsAccount = data.kids.length === 0
  if (needsAccount && overlay.kind !== "open-account") {
    return (
      <>
        <OfflineBanner online={online} />
        {createdUrl && (
          <section className="frame" style={{ maxWidth: 420, margin: "0.75rem auto", padding: "0 1rem" }}>
            <div className="frame">
              <p>Share this Sheet with your co-parent from Google Drive.</p>
              <a className="btn outline" href={createdUrl} target="_blank" rel="noreferrer">
                Open in Sheets
              </a>
            </div>
          </section>
        )}
        <OpenAccount
          existingNames={data.kids.map((k) => k.name)}
          busy={busy}
          online={online}
          error={loadError}
          onOpen={handleOpenAccount}
        />
      </>
    )
  }

  if (!activeKid && !needsAccount) {
    return (
      <div className="page">
        <p className="msg">No kid selected.</p>
      </div>
    )
  }

  const balance = activeKid
    ? balanceForKid(enriched, activeKid.kidId)
    : 0

  const entryTx =
    overlay.kind === "entry" ||
    overlay.kind === "confirm-reverse" ||
    overlay.kind === "confirm-correct"
      ? enriched.find((t) => t.id === overlay.txId)
      : undefined

  return (
    <>
      <OfflineBanner online={online} />
      {loadError && (
        <div className="offline-banner warn-banner">{loadError}</div>
      )}

      {activeKid && overlay.kind === "none" && (
        <Home
          kid={activeKid}
          kids={data.kids}
          rows={enriched}
          balance={balance}
          updatedAt={updatedAt}
          online={online}
          flashing={flashing}
          onSelectKid={(id) => {
            setActiveKidId(id)
            saveActiveKidId(id)
          }}
          onDeposit={() => setOverlay({ kind: "add-entry", mode: "Deposit" })}
          onExpense={() => setOverlay({ kind: "add-entry", mode: "Expense" })}
          onOpenEntry={(txId) => setOverlay({ kind: "entry", txId })}
          onSettings={() => setOverlay({ kind: "settings" })}
          onRefresh={() => refreshData()}
        />
      )}

      {overlay.kind === "open-account" && (
        <div className="overlay-root">
          <OpenAccount
            existingNames={data.kids.map((k) => k.name)}
            busy={busy}
            online={online}
            error={null}
            onCancel={() => setOverlay({ kind: "none" })}
            onOpen={handleOpenAccount}
          />
        </div>
      )}

      {overlay.kind === "add-entry" && activeKid && (
        <div className="overlay-root">
          <AddEntry
            mode={overlay.mode}
            kid={activeKid}
            tags={data.tags}
            busy={busy}
            online={online}
            prefill={overlay.prefill}
            correctsId={overlay.correctsId}
            onClose={() => setOverlay({ kind: "none" })}
            onSave={async (entry) => {
              if (overlay.correctsId) {
                const original = enriched.find((t) => t.id === overlay.correctsId)
                if (original) {
                  await handleCorrectSave(original, entry)
                  return
                }
              }
              await handleSaveEntry(entry, overlay.mode)
            }}
          />
        </div>
      )}

      {overlay.kind === "entry" && entryTx && (
        <div className="overlay-root">
          <EntryDetail
            tx={entryTx}
            all={enriched}
            online={online}
            onClose={() => setOverlay({ kind: "none" })}
            onReverse={() =>
              setOverlay({ kind: "confirm-reverse", txId: entryTx.id })
            }
            onCorrect={() =>
              setOverlay({ kind: "confirm-correct", txId: entryTx.id })
            }
            onOpenRelated={(id) => setOverlay({ kind: "entry", txId: id })}
          />
        </div>
      )}

      {overlay.kind === "confirm-reverse" && entryTx && (
        <div className="overlay-root">
          <div className="overlay-sheet">
            <h2>Reverse entry?</h2>
            <p className="hint">
              Appends a Correction row. The original stays visible as REVERSED.
            </p>
            <button
              type="button"
              className="btn"
              disabled={busy || !online}
              onClick={() => handleReverse(entryTx)}
            >
              {busy ? "Saving…" : "Confirm Reverse"}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setOverlay({ kind: "entry", txId: entryTx.id })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {overlay.kind === "confirm-correct" && entryTx && (
        <div className="overlay-root">
          <div className="overlay-sheet">
            <h2>Correct entry?</h2>
            <p className="hint">
              Reverses the original, then opens Add so you can enter the fixed values.
            </p>
            <button
              type="button"
              className="btn"
              disabled={!online}
              onClick={() =>
                setOverlay({
                  kind: "add-entry",
                  mode: entryTx.type,
                  prefill: entryTx,
                  correctsId: entryTx.id,
                })
              }
            >
              Continue
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setOverlay({ kind: "entry", txId: entryTx.id })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {overlay.kind === "settings" && (
        <div className="overlay-root">
          <Settings
            email={auth.email}
            data={data}
            online={online}
            busy={busy}
            onClose={() => setOverlay({ kind: "none" })}
            onSignOut={signOut}
            onSwitchSheet={() => {
              clearSheetId()
              setSheetId(null)
              setData(null)
              setOverlay({ kind: "none" })
              setCreatedUrl(sheetUrl(sheetId))
            }}
            onAddKid={() => setOverlay({ kind: "open-account" })}
            onUpdateKid={async (kid, fields) => {
              setBusy(true)
              try {
                await withWrite((token) =>
                  updateKidDisplay(token, sheetId, kid.rowIndex, fields),
                )
                await refreshData()
              } finally {
                setBusy(false)
              }
            }}
            onAddTag={async (tag) => {
              setBusy(true)
              try {
                await withWrite((token) => appendTag(token, sheetId, tag))
                await refreshData()
              } finally {
                setBusy(false)
              }
            }}
            onFixKidId={async (kid) => {
              setBusy(true)
              try {
                await withWrite((token) => fixKidId(token, sheetId, kid.rowIndex))
                await refreshData()
              } finally {
                setBusy(false)
              }
            }}
          />
        </div>
      )}
    </>
  )
}
