import type { EnrichedTx } from "../lib/ledger"
import { canReverse, formatMoneySigned } from "../lib/ledger"
import { describeTx, isAutoReversalNote, reversedIdOf } from "../lib/display"

type Props = {
  tx: EnrichedTx
  all: EnrichedTx[]
  online: boolean
  onClose: () => void
  onReverse: () => void
  onCorrect: () => void
  onOpenRelated: (id: string) => void
}

export function EntryDetail({
  tx,
  all,
  online,
  onClose,
  onReverse,
  onCorrect,
  onOpenRelated,
}: Props) {
  const showActions = canReverse(tx, all) && online
  const reversedBy = all.find((r) => r.reverses === tx.id)
  const corrects = tx.corrects
  const correctedBy = all.find((r) => r.corrects === tx.id)
  const reversesId = reversedIdOf(tx)
  // Auto-written "Reversal of <id>" notes are shown as a readable summary instead
  const noteText =
    reversesId && isAutoReversalNote(tx.note)
      ? `Reversal of ${describeTx(reversesId, all)}`
      : tx.note || "—"

  return (
    <div className="overlay-sheet">
      <div className="sheet-head">
        <h2>Entry</h2>
        <button type="button" className="text-btn" onClick={onClose}>
          Close
        </button>
      </div>

      <dl className="detail-dl">
        <dt>Date</dt>
        <dd>{tx.date}</dd>
        <dt>Type</dt>
        <dd>{tx.type}</dd>
        <dt>Tag</dt>
        <dd>{tx.tag || "—"}</dd>
        <dt>Amount</dt>
        <dd>{formatMoneySigned(tx.type === "Deposit" ? tx.amount : -tx.amount, true)}</dd>
        <dt>Note</dt>
        <dd className="wrap">{noteText}</dd>
        <dt>Entered By</dt>
        <dd>{tx.enteredBy || "—"}</dd>
        <dt>Entered At</dt>
        <dd>{tx.enteredAt || "—"}</dd>
        <dt>ID</dt>
        <dd className="mono">{tx.id || "—"}</dd>
      </dl>

      {tx.status.includes("added") && (
        <p className="hint">Correct this in the Sheet.</p>
      )}

      <div className="related">
        {reversesId && (tx.reverses || all.some((r) => r.id === reversesId)) && (
          <button type="button" className="text-btn" onClick={() => onOpenRelated(reversesId)}>
            Reverses: {describeTx(reversesId, all)}
          </button>
        )}
        {reversedBy && (
          <button type="button" className="text-btn" onClick={() => onOpenRelated(reversedBy.id)}>
            Reversed by: {describeTx(reversedBy.id, all)}
          </button>
        )}
        {corrects && (
          <button type="button" className="text-btn" onClick={() => onOpenRelated(corrects)}>
            Corrects: {describeTx(corrects, all)}
          </button>
        )}
        {correctedBy && (
          <button type="button" className="text-btn" onClick={() => onOpenRelated(correctedBy.id)}>
            Corrected by: {describeTx(correctedBy.id, all)}
          </button>
        )}
      </div>

      {showActions && (
        <div className="detail-actions">
          <button type="button" className="btn ghost" onClick={onReverse}>
            REVERSE
          </button>
          <button type="button" className="btn" onClick={onCorrect}>
            CORRECT
          </button>
        </div>
      )}
    </div>
  )
}
