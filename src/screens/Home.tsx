import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react"
import { BigBalance } from "../components/Money"
import {
  balanceForKid,
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

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

function KidPageBody({
  pageKid,
  rows,
  balance,
  updatedAt,
  online,
  flashing,
  multiKid,
  onOpenPicker,
  onDeposit,
  onExpense,
  onOpenEntry,
  onSettings,
}: {
  pageKid: Kid
  rows: EnrichedTx[]
  balance: number
  updatedAt: Date | null
  online: boolean
  flashing: boolean
  multiKid: boolean
  onOpenPicker: () => void
  onDeposit: () => void
  onExpense: () => void
  onOpenEntry: (txId: string) => void
  onSettings: () => void
}) {
  const ledger = useMemo(
    () => ledgerForKid(rows, pageKid.kidId),
    [rows, pageKid.kidId],
  )
  const updatedLabel = updatedAt
    ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : ""

  return (
    <>
      <div className="home-top">
        {multiKid ? (
          <button
            type="button"
            className="kid-name-btn"
            onClick={onOpenPicker}
            aria-haspopup="dialog"
            aria-label={`${pageKid.name}. Switch kid`}
          >
            <span className="kid-name-text">{pageKid.name}</span>
            <span className="kid-chevron">
              <ChevronDown />
            </span>
          </button>
        ) : (
          <h1 className="kid-name-btn static">
            <span className="kid-name-text">{pageKid.name}</span>
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
          const signed = r.type === "Deposit" ? r.amount : -r.amount
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
    </>
  )
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
  const touchY = useRef<number | null>(null)
  const touchX = useRef<number | null>(null)
  const axisLock = useRef<"none" | "h" | "v">("none")
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerPushed = useRef(false)
  const multiKid = kids.length > 1
  const pagerRef = useRef<HTMLDivElement>(null)
  const syncingScroll = useRef(false)
  const scrollEndTimer = useRef<number | null>(null)
  const activeIndex = Math.max(
    0,
    kids.findIndex((k) => k.kidId === kid.kidId),
  )

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
      history.back()
    } else {
      setPickerOpen(false)
    }
  }, [])

  const nearestIndex = useCallback(() => {
    const el = pagerRef.current
    if (!el) return activeIndex
    const pages = el.querySelectorAll<HTMLElement>(".home-page")
    if (!pages.length) return activeIndex
    let best = 0
    let bestDist = Infinity
    const left = el.scrollLeft
    pages.forEach((p, i) => {
      const dist = Math.abs(p.offsetLeft - left)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    return best
  }, [activeIndex])

  const commitVisibleKid = useCallback(() => {
    if (syncingScroll.current) return
    const idx = nearestIndex()
    const next = kids[idx]
    if (next && next.kidId !== kid.kidId) {
      onSelectKid(next.kidId)
    }
  }, [kids, kid.kidId, nearestIndex, onSelectKid])

  // Snap pager to active kid when selection changes (picker / persistence)
  useEffect(() => {
    const el = pagerRef.current
    if (!el || !multiKid) return
    const page = el.querySelectorAll<HTMLElement>(".home-page")[activeIndex]
    if (!page) return
    const target = page.offsetLeft
    if (Math.abs(el.scrollLeft - target) < 2) return
    syncingScroll.current = true
    el.scrollTo({
      left: target,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    })
    const done = () => {
      syncingScroll.current = false
    }
    if (prefersReducedMotion()) {
      done()
      return
    }
    const t = window.setTimeout(done, 380)
    return () => window.clearTimeout(t)
  }, [kid.kidId, activeIndex, multiKid])

  const onPagerScroll = useCallback(() => {
    if (syncingScroll.current) return
    if (scrollEndTimer.current != null) window.clearTimeout(scrollEndTimer.current)
    scrollEndTimer.current = window.setTimeout(() => {
      scrollEndTimer.current = null
      commitVisibleKid()
    }, 80)
  }, [commitVisibleKid])

  useEffect(() => {
    const el = pagerRef.current
    if (!el || !multiKid) return
    const onScrollEnd = () => commitVisibleKid()
    el.addEventListener("scrollend", onScrollEnd)
    return () => el.removeEventListener("scrollend", onScrollEnd)
  }, [multiKid, commitVisibleKid])

  const resetGesture = () => {
    touchY.current = null
    touchX.current = null
    axisLock.current = "none"
  }

  const onPageTouchStart = (e: TouchEvent) => {
    if (pickerOpen) return
    touchY.current = e.touches[0]?.clientY ?? null
    touchX.current = e.touches[0]?.clientX ?? null
    axisLock.current = "none"
  }

  const onPageTouchMove = (e: TouchEvent, pageEl: HTMLElement) => {
    if (pickerOpen) return
    const t = e.touches[0]
    if (!t || touchY.current == null || touchX.current == null) return
    const dx = t.clientX - touchX.current
    const dy = t.clientY - touchY.current
    if (axisLock.current === "none") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      axisLock.current =
        Math.abs(dx) > Math.abs(dy) && multiKid ? "h" : "v"
    }
    if (axisLock.current === "h") {
      // Pause pull-to-refresh while horizontal paging
      setPull(0)
      return
    }
    if (pageEl.scrollTop <= 0 && dy > 0) {
      setPull(Math.min(72, dy * 0.4))
    } else {
      setPull(0)
    }
  }

  const onPageTouchEnd = async () => {
    if (pickerOpen) {
      resetGesture()
      return
    }
    const wasVertical = axisLock.current === "v"
    const pullAmt = pull
    resetGesture()
    if (wasVertical && pullAmt > 48 && !refreshing) {
      setRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
      }
    }
    setPull(0)
  }

  return (
    <div className={`home${multiKid ? " home-multi" : ""}`}>
      {(pull > 0 || refreshing) && (
        <div
          className="pull-hint"
          role="status"
          style={{
            transform: `translate(-50%, ${refreshing ? 8 : Math.round(pull * 0.35)}px)`,
          }}
        >
          {refreshing
            ? "Refreshing…"
            : pull > 48
              ? "Release to refresh"
              : "Pull to refresh"}
        </div>
      )}

      {multiKid ? (
        <div
          className="home-pager"
          ref={pagerRef}
          onScroll={onPagerScroll}
          aria-label="Kids"
        >
          {kids.map((k) => {
            const pageBalance = balanceForKid(rows, k.kidId)
            const isActive = k.kidId === kid.kidId
            return (
              <div
                key={k.kidId}
                className="home-page"
                data-kid-id={k.kidId}
                aria-hidden={!isActive}
                onTouchStart={onPageTouchStart}
                onTouchMove={(e) =>
                  onPageTouchMove(e, e.currentTarget)
                }
                onTouchEnd={() => void onPageTouchEnd()}
                onTouchCancel={() => {
                  resetGesture()
                  setPull(0)
                }}
              >
                <KidPageBody
                  pageKid={k}
                  rows={rows}
                  balance={pageBalance}
                  updatedAt={isActive ? updatedAt : null}
                  online={online}
                  flashing={isActive && flashing}
                  multiKid={multiKid}
                  onOpenPicker={() => setPickerOpen(true)}
                  onDeposit={onDeposit}
                  onExpense={onExpense}
                  onOpenEntry={onOpenEntry}
                  onSettings={onSettings}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <div
          className="home-page home-page-solo"
          onTouchStart={onPageTouchStart}
          onTouchMove={(e) => onPageTouchMove(e, e.currentTarget)}
          onTouchEnd={() => void onPageTouchEnd()}
          onTouchCancel={() => {
            resetGesture()
            setPull(0)
          }}
        >
          <KidPageBody
            pageKid={kid}
            rows={rows}
            balance={balance}
            updatedAt={updatedAt}
            online={online}
            flashing={flashing}
            multiKid={false}
            onOpenPicker={() => setPickerOpen(true)}
            onDeposit={onDeposit}
            onExpense={onExpense}
            onOpenEntry={onOpenEntry}
            onSettings={onSettings}
          />
        </div>
      )}

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
                  <span className="kid-picker-check">
                    {active && <CheckIcon />}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
