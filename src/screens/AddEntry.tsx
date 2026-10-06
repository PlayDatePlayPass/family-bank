import { useMemo, useState } from "react"
import { todayYmd } from "../lib/ids"
import { depositTags, formatMoneySigned } from "../lib/ledger"
import type { Kid, TagRow, Transaction, TxType } from "../lib/types"

type Props = {
  mode: TxType
  kid: Kid
  tags: TagRow[]
  busy: boolean
  online: boolean
  prefill?: Partial<Transaction>
  correctsId?: string
  onClose: () => void
  onSave: (entry: {
    date: string
    amount: number
    tag: string
    note: string
    corrects?: string
  }) => Promise<void>
}

export function AddEntry({
  mode,
  kid,
  tags,
  busy,
  online,
  prefill,
  correctsId,
  onClose,
  onSave,
}: Props) {
  const tagOptions = useMemo(() => depositTags(tags), [tags])
  const [amountStr, setAmountStr] = useState(
    prefill?.amount != null ? String(prefill.amount) : "",
  )
  const [tag, setTag] = useState(
    prefill?.tag && prefill.tag !== "Correction" ? prefill.tag : "",
  )
  const [customTag, setCustomTag] = useState("")
  const [date, setDate] = useState(prefill?.date || todayYmd())
  const [note, setNote] = useState(prefill?.note || "")
  const [error, setError] = useState<string | null>(null)

  const amount = Number(amountStr)
  const amountOk =
    Number.isFinite(amount) && amount > 0 && /^\d+(\.\d{0,2})?$/.test(amountStr.trim())

  const resolvedTag =
    mode === "Expense"
      ? ""
      : tag === "Other"
        ? customTag.trim()
        : tag

  const tagOk = mode === "Expense" || Boolean(resolvedTag)
  const canSave = amountOk && tagOk && online && !busy

  const saveLabel = amountOk
    ? mode === "Deposit"
      ? `Add ${formatMoneySigned(amount)} deposit`
      : `Add ${formatMoneySigned(amount)} expense`
    : mode === "Deposit"
      ? "Add deposit"
      : "Add expense"

  async function submit() {
    if (!canSave) return
    setError(null)
    try {
      await onSave({
        date,
        amount,
        tag: resolvedTag,
        note: note.trim(),
        corrects: correctsId,
      })
    } catch (e) {
      setError("Didn't save. Check connection and try again.")
      void e
    }
  }

  return (
    <div className="overlay-sheet">
      <div className="sheet-head">
        <h2 style={{ color: kid.color }}>{mode.toUpperCase()}</h2>
        <button type="button" className="text-btn" onClick={onClose}>
          Close
        </button>
      </div>

      <label className="label">Amount</label>
      <input
        className="field amount-field"
        inputMode="decimal"
        value={amountStr}
        onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder="0.00"
        autoFocus
      />

      {mode === "Expense" && (
        <>
          <label className="label">Note</label>
          <textarea
            className="field"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was it for?"
          />
        </>
      )}

      {mode === "Deposit" && (
        <>
          <label className="label">Tag</label>
          <div className="chip-row">
            {tagOptions.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip${tag === t ? " on" : ""}`}
                onClick={() => setTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tag === "Other" && (
            <input
              className="field"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="Custom tag"
            />
          )}
        </>
      )}

      <label className="label">Date</label>
      <input
        className="field"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {mode === "Deposit" && (
        <>
          <label className="label">Note</label>
          <textarea
            className="field"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </>
      )}

      {error && <p className="err-msg">{error}</p>}

      <button
        type="button"
        className="btn"
        disabled={!canSave}
        style={{ background: kid.color, borderColor: kid.color }}
        onClick={submit}
      >
        {busy ? "Saving…" : saveLabel}
      </button>
    </div>
  )
}
