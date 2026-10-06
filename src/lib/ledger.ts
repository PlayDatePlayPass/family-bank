import { fingerprint } from "./ids"
import type { Kid, SheetIssue, Transaction, TxType } from "./types"

export type LedgerRowStatus =
  | "ok"
  | "reversed"
  | "corrected"
  | "edited"
  | "added"

export type EnrichedTx = Transaction & {
  status: LedgerRowStatus[]
  runningBalance: number
  belongsToKidId: string | null
  valid: boolean
}

function resolveKid(
  tx: Transaction,
  kids: Kid[],
): { kidId: string | null; valid: boolean; issue?: string } {
  if (tx.kidId) {
    const k = kids.find((x) => x.kidId === tx.kidId)
    if (!k) return { kidId: null, valid: false, issue: "Unknown Kid ID" }
    return { kidId: k.kidId, valid: true }
  }
  // blank ID: match by name
  if (!tx.kidName.trim()) {
    return { kidId: null, valid: false, issue: "Missing Kid ID and name" }
  }
  const matches = kids.filter(
    (k) => k.name.toLowerCase() === tx.kidName.trim().toLowerCase(),
  )
  if (matches.length === 1) return { kidId: matches[0]!.kidId, valid: true }
  if (matches.length === 0) {
    return { kidId: null, valid: false, issue: "Name not in Kids" }
  }
  return { kidId: null, valid: false, issue: "Ambiguous kid name" }
}

export function enrichTransactions(
  txs: Transaction[],
  kids: Kid[],
): { rows: EnrichedTx[]; issues: SheetIssue[] } {
  const issues: SheetIssue[] = []
  const reversedBy = new Set(
    txs.filter((t) => t.reverses).map((t) => t.reverses),
  )
  const correctedBy = new Set(
    txs.filter((t) => t.corrects).map((t) => t.corrects),
  )

  const rows: EnrichedTx[] = []
  for (const tx of txs) {
    const status: LedgerRowStatus[] = []
    const resolved = resolveKid(tx, kids)
    let valid = resolved.valid

    if (!tx.id) status.push("added")
    else {
      const expected = fingerprint({
        date: tx.date,
        kidId: tx.kidId,
        type: tx.type,
        tag: tx.tag,
        amount: tx.amount,
        note: tx.note,
        reverses: tx.reverses,
        corrects: tx.corrects,
      })
      if (tx.check && tx.check !== expected) status.push("edited")
    }

    if (tx.id && reversedBy.has(tx.id)) status.push("reversed")
    if (tx.id && correctedBy.has(tx.id)) status.push("corrected")

    if (tx.type !== "Deposit" && tx.type !== "Expense") {
      valid = false
      issues.push({
        kind: "transaction",
        rowIndex: tx.rowIndex,
        message: `Bad Type "${tx.type}"`,
      })
    }
    if (!(tx.amount > 0) || !Number.isFinite(tx.amount)) {
      valid = false
      issues.push({
        kind: "transaction",
        rowIndex: tx.rowIndex,
        message: "Amount must be > 0",
      })
    }
    if (!resolved.valid && resolved.issue) {
      issues.push({
        kind: "transaction",
        rowIndex: tx.rowIndex,
        message: resolved.issue,
      })
    }

    rows.push({
      ...tx,
      status,
      runningBalance: 0,
      belongsToKidId: resolved.kidId,
      valid,
    })
  }

  for (const kid of kids) {
    if (!kid.kidId) {
      issues.push({
        kind: "kid",
        rowIndex: kid.rowIndex,
        message: "Kid missing ID — use Fix in Settings",
      })
    }
  }

  return { rows, issues }
}

export function balanceForKid(rows: EnrichedTx[], kidId: string): number {
  let bal = 0
  for (const r of rows) {
    if (!r.valid || r.belongsToKidId !== kidId) continue
    bal += r.type === "Deposit" ? r.amount : -r.amount
  }
  return bal
}

export function ledgerForKid(
  rows: EnrichedTx[],
  kidId: string,
): EnrichedTx[] {
  const filtered = rows
    .filter((r) => r.valid && r.belongsToKidId === kidId)
    .slice()
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date)
      if (d !== 0) return d
      return a.enteredAt.localeCompare(b.enteredAt) || a.rowIndex - b.rowIndex
    })

  let running = 0
  for (const r of filtered) {
    running += r.type === "Deposit" ? r.amount : -r.amount
    r.runningBalance = running
  }
  // newest first for display
  return filtered.slice().reverse()
}

export function formatMoney(n: number): { whole: string; cents: string; neg: boolean } {
  const neg = n < 0
  const abs = Math.abs(n)
  const fixed = abs.toFixed(2)
  const [w, c] = fixed.split(".")
  const whole = Number(w).toLocaleString("en-US")
  return { whole, cents: c || "00", neg }
}

export function formatMoneySigned(n: number, asDelta = false): string {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (asDelta) return n >= 0 ? `+$${abs}` : `-$${abs}`
  return n < 0 ? `-$${abs}` : `$${abs}`
}

export function dateHeaderLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd.toUpperCase()
  const dt = new Date(y, m - 1, d)
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ]
  return `${days[dt.getDay()]} ${months[dt.getMonth()]} ${d}`
}

export function canReverse(tx: EnrichedTx, all: EnrichedTx[]): boolean {
  if (!tx.id) return false
  if (tx.status.includes("added")) return false
  if (all.some((r) => r.reverses === tx.id)) return false
  return true
}

export function oppositeType(t: TxType): TxType {
  return t === "Deposit" ? "Expense" : "Deposit"
}

export function depositTags(tags: { type: string; tag: string }[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tags) {
    if (t.type !== "Deposit") continue
    if (t.tag === "Correction") continue
    if (seen.has(t.tag)) continue
    seen.add(t.tag)
    out.push(t.tag)
  }
  return out
}
