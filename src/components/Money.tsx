import { formatMoney } from "../lib/ledger"

export function BigBalance({ value }: { value: number }) {
  const { whole, cents, neg } = formatMoney(value)
  return (
    <div className={`big-balance${neg ? " neg" : ""}`}>
      {neg && <span className="minus">-</span>}
      <span className="dollar">$</span>
      <span className="whole">{whole}</span>
      <span className="cents">.{cents}</span>
      {neg && <span className="neg-bar" aria-hidden />}
    </div>
  )
}
