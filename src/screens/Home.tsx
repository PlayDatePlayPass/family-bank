import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BigBalance } from "../components/Money"
import {
  dateHeaderLabel,
  formatMoneySigned,
  ledgerForKid,
  type EnrichedTx,
} from "../lib/ledger"
import { isReversalRow, reversalNoteLine } from "../lib/display"
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

function GearIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <path d="M10.3 2.5h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9-2.6-.5v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M3.5 6l4.5 4.5L12.5 6" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  )
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerPushed = useRef(false)
  const multiKid = kids.length > 1

  // Android back closes the kid picker (same pushState/popstate pattern as App overlays)
  useEffect(() => {
    if (!pickerOpen) return
    if (!pickerPushed.current) {
      history.pushState({ fbKidPicker: true }, "")
      pickerPushed.current = true
    }
    const onPop = () => {
      pickerPushed.current = false
      setPickerOpen(false)
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [pickerOpen])

  const closePicker = useCallback(() => {
    if (pickerPushed.current) {
      // pops our history entry; popstate handler closes the sheet
      history.back()
    } else {
      setPickerOpen(false)
    }
  }, [])

  const updatedLabel = updatedAt
    ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : ""

  return (
    <div
      className="home"
      onTouchStart={(e) => {
        if (pickerOpen) return
        touchY.current = e.touches[0]?.clientY ?? null
        swipeX.current = e.touches[0]?.clientX ?? null
      }}
      onTouchMove={(e) => {
        if (pickerOpen) return
        const y = e.touches[0]?.clientY
        if (touchY.current != null && y != null && window.scrollY <= 0) {
          const dy = y - touchY.current
          if (dy > 0) setPull(Math.min(72, dy * 0.4))
        }
      }}
      onTouchEnd={async (e) => {
        if (pickerOpen) return
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
        <div
          className="pull-hint"
          role="status"
          style={{ transform: `translate(-50%, ${refreshing ? 8 : Math.round(pull * 0.35)}px)` }}
        >
          {refreshing ? "Refreshing…" : pull > 48 ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}

      <div className="home-top">
        {multiKid ? (
          <button
            type="button"
            className="kid-name-btn"
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            aria-label={`${kid.name}. Switch kid`}
          >
            <span className="kid-name-text">{kid.name}</span>
            <span className="kid-chevron">
              <ChevronDown />
            </span>
          </button>
        ) : (
          <h1 className="kid-name-btn static">
            <span className="kid-name-text">{kid.name}</span>
          </h1>
        )}

        <button
          type="button"
          className="icon-btn gear-btn"
          onClick={onSettings}
          aria-label="Settings"
        >
          <GearIcon />
        </button>
      </div>

      <div className={`balance-frame${flashing ? " flash" : ""}`}>
        <BigBalance value={balance} />
        {updatedLabel && <p className="updated">{updatedLabel}</p>}
      </div>

      <div className="actions">
        <button
          type="button"
          className="action-rect primary"
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
          const reversal = isReversalRow(r)
          const title = reversal
            ? "REVERSAL"
            : r.type === "Deposit"
              ? r.tag || "DEPOSIT"
              : "EXPENSE"
          const noteLine = reversal
            ? reversalNoteLine(r, rows)
            : r.note.split("\n")[0] || ""
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
                    className={`lr-amt ${signed >= 0 ? "pos" : "neg"}${isRev ? " strike" : ""}`}
                  >
                    {signed >= 0 ? "+" : "\u2212"}
                    {formatMoneySigned(Math.abs(signed))}
                  </span>
                  <span
                    className={`lr-run${r.runningBalance < 0 ? " below-zero" : ""}`}
                  >
                    {formatMoneySigned(r.runningBalance)}
                  </span>
                </div>
              </button>
            </div>
          )
        })}
      </div>

      {pickerOpen && multiKid && (
        <div className="kid-picker-root" onClick={closePicker}>
          <div
            className="kid-picker"
            role="dialog"
            aria-modal="true"
            aria-label="Switch kid"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="kid-picker-title">SWITCH KID</p>
            {kids.map((k) => {
              const active = k.kidId === kid.kidId
              return (
                <button
                  key={k.kidId}
                  type="button"
                  className={`kid-picker-row${active ? " active" : ""}`}
                  aria-current={active ? "true" : undefined}
                  onClick={() => {
                    if (!active) onSelectKid(k.kidId)
                    closePicker()
                  }}
                >
                  <span className="kid-swatch" style={{ background: k.color }} />
                  <span className="kid-picker-name">{k.name}</span>
                  <span className="kid-picker-check">{active && <CheckIcon />}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
