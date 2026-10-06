// Build 12: display-only helpers so the UI never shows raw tx IDs.
// Pure formatting — does not change what is stored in the Sheet.
import type { EnrichedTx } from "./ledger"
import { formatMoneySigned } from "./ledger"
import type { TxType } from "./types"

const AUTO_REVERSAL_NOTE = /^\s*reversal of\s+(\S+)\s*$/i
// Only trust an id parsed from free text if it looks like an app tx id (T-…)
const AUTO_REVERSAL_NOTE_TXID = /^\s*reversal of\s+(T-[A-Z0-9]+)\s*$/i
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** True when a note is the app's auto-written "Reversal of <id>". */
export function isAutoReversalNote(note: string): boolean {
  return AUTO_REVERSAL_NOTE.test(note)
}

/** Id of the entry a row reverses (Reverses column, else parsed from an auto note). */
export function reversedIdOf(r: EnrichedTx): string {
  if (r.reverses) return r.reverses
  return AUTO_REVERSAL_NOTE_TXID.exec(r.note.split("\n")[0] || "")?.[1] || ""
}

export function isReversalRow(r: EnrichedTx): boolean {
  return Boolean(reversedIdOf(r))
}

function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  return `${SHORT_MONTHS[m - 1]} ${d}`
}

function typeAmount(type: TxType | string, amount: number): string {
  return `${type} ${formatMoneySigned(Math.abs(amount))}`
}

/** "Mistake" — or "Expense $3.00" if the original has no note / can't be found. */
export function reversalNoteLine(r: EnrichedTx, all: EnrichedTx[]): string {
  const id = reversedIdOf(r)
  const original = id ? all.find((t) => t.id === id) : undefined
  if (original) {
    const line = (original.note.split("\n")[0] || "").trim()
    if (line && !isAutoReversalNote(line)) return line
    return typeAmount(original.type, original.amount)
  }
  // Original not loaded: a reversal is the opposite type for the same amount
  const origType = r.type === "Deposit" ? "Expense" : "Deposit"
  return typeAmount(origType, r.amount)
}

/** Human summary of an entry for links, e.g. "Expense $3.00 · Oct 3 · Mistake". */
export function describeTx(id: string, all: EnrichedTx[]): string {
  const t = all.find((x) => x.id === id)
  if (!t) return "original entry"
  const parts = [typeAmount(t.type, t.amount), shortDate(t.date)]
  const line = (t.note.split("\n")[0] || "").trim()
  if (line && !isAutoReversalNote(line)) parts.push(line)
  return parts.join(" · ")
}
