import { useMemo, useRef, useState } from "react"
import { BigBalance } from "../components/Money"
import {
  dateHeaderLabel,
  formatMoneySigned,
  ledgerForKid,
  type EnrichedTx,
} from "../lib/ledger"
import type { Kid } from "../lib/types"

type Props = {
  kid: Kid
  kids: Kid[]
  rows: EnrichedTx[]
  balance: number
  updatedAt: Date | null
  online: boolean
  flashing: boolean
  onSelectKid: (id: string) => void
  onDeposit: () => void
  onExpense: () => void
  onOpenEntry: (txId: string) => void
  onSettings: () => void
  onRefresh: () => Promise<void>
}

function statusLabels(r: EnrichedTx): string[] {
  const out: string[] = []
  if (r.status.includes("reversed")) out.push("REVERSED")
  if (r.status.includes("corrected")) out.push("CORRECTED")
  if (r.status.includes("edited")) out.push("EDITED IN SHEET")
  if (r.status.includes("added")) out.push("ADDED IN SHEET")
  return out
}

export function Home({
  kid,
  kids,
  rows,
  balance,
  updatedAt,
  online,
  flashing,
  onSelectKid,
  onDeposit,
  onExpense,
  onOpenEntry,
  onSettings,
  onRefresh,
}: Props) {
  const ledger = useMemo(() => ledgerForKid(rows, kid.kidId), [rows, kid.kidId])
  const touchY = useRef<number | null>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const swipeX = useRef<number | null>(null)

  const updatedLabel = updatedAt
    ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : ""

  return (
    <div
      className="home"
      onTouchStart={(e) => {
        touchY.current = e.touches[0]?.clientY ?? null
        swipeX.current = e.touches[0]?.clientX ?? null
      }}
      onTouchMove={(e) => {
        const y = e.touches[0]?.clientY
        if (touchY.current != null && y != null && window.scrollY <= 0) {
          const dy = y - touchY.current
          if (dy > 0) setPull(Math.min(72, dy * 0.4))
        }
      }}
      onTouchEnd={async (e) => {
        if (pull > 48 && !refreshing) {
          setRefreshing(true)
          try {
            await onRefresh()
          } finally {
            setRefreshing(false)
          }
        }
        setPull(0)
        touchY.current = null

        const x = e.changedTouches[0]?.clientX
        if (swipeX.current != null && x != null && kids.length > 1) {
          const dx = x - swipeX.current
          if (Math.abs(dx) > 60) {
            const idx = kids.findIndex((k) => k.kidId === kid.kidId)
            if (dx < 0 && idx < kids.length - 1) onSelectKid(kids[idx + 1]!.kidId)
            if (dx > 0 && idx > 0) onSelectKid(kids[idx - 1]!.kidId)
          }
        }
        swipeX.current = null
      }}
    >
      {(pull > 0 || refreshing) && (
        <div className="pull-hint">
          {refreshing ? "Refreshing…" : pull > 48 ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}

      <div className="home-top">
        {kids.length > 1 && (
          <div className="kid-switcher">
            {kids.map((k) => {
              const active = k.kidId === kid.kidId
              return (
                <button
                  key={k.kidId}
                  type="button"
                  className={`avatar-sq sm${active ? " filled" : ""}`}
                  style={
                    active
                      ? { background: k.color, borderColor: k.color, color: "#fff" }
                      : { borderColor: k.color, color: k.color }
                  }
                  onClick={() => onSelectKid(k.kidId)}
                  aria-label={k.name}
                >
                  {(k.name[0] || "?").toUpperCase()}
                </button>
              )
            })}
          </div>
        )}

        <button type="button" className="text-btn settings-link" onClick={onSettings}>
          Settings
        </button>
      </div>

      <div className={`balance-frame${flashing ? " flash" : ""}`}>
        <BigBalance value={balance} />
        <p className="kid-name-caps">{kid.name}</p>
        {updatedLabel && <p className="updated">{updatedLabel}</p>}
      </div>

      <div className="actions">
        <button
          type="button"
          className="action-rect"
          disabled={!online}
          onClick={onDeposit}
        >
          DEPOSIT
        </button>
        <button
          type="button"
          className="action-rect"
          disabled={!online}
          onClick={onExpense}
        >
          EXPENSE
        </button>
      </div>

      <div className="ledger">
        {ledger.length === 0 && (
          <div className="empty-ledger">
            <p>No entries yet.</p>
            <p className="hint">Tap DEPOSIT to add the first one.</p>
          </div>
        )}
        {ledger.map((r, i) => {
          const showHeader = i === 0 || r.date !== ledger[i - 1]!.date
          const labels = statusLabels(r)
          const isRev = r.status.includes("reversed")
          const title =
            r.reverses
              ? `Reversal of ${r.note.replace(/^Reversal of\s*/i, "") || r.reverses}`
              : r.type === "Deposit"
                ? r.tag || "DEPOSIT"
                : "EXPENSE"
          const noteLine = r.note.split("\n")[0] || ""
          const signed =
            r.type === "Deposit" ? r.amount : -r.amount
          return (
            <div key={`${r.rowIndex}-${r.id}`}>
              {showHeader && (
                <div className="date-bar">{dateHeaderLabel(r.date)}</div>
              )}
              <button
                type="button"
                className={`ledger-row${isRev ? " muted" : ""}`}
                onClick={() => r.id && onOpenEntry(r.id)}
              >
                <div className="lr-left">
                  <span className="lr-tag">{title}</span>
                  {noteLine && <span className="lr-note">{noteLine}</span>}
                  {labels.length > 0 && (
                    <span className="lr-labels">
                      {labels.map((l) => (
                        <span key={l} className="tiny-tag">
                          {l}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                <div className="lr-right">
                  <span
                    className={`lr-amt${r.type === "Deposit" ? " pos" : ""}${isRev ? " strike" : ""}`}
                  >
                    {formatMoneySigned(signed, true)}
                  </span>
                  <span className="lr-run">
                    {formatMoneySigned(r.runningBalance)}
                  </span>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
