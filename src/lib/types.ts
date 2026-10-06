export type ThemeFamily = "Bright" | "Bold"

export type Kid = {
  kidId: string
  name: string
  color: string
  theme: ThemeFamily
  added: string
  addedBy: string
  rowIndex: number // 1-based sheet row
}

export type TxType = "Deposit" | "Expense"

export type Transaction = {
  id: string
  date: string // yyyy-mm-dd
  kidId: string
  kidName: string
  type: TxType
  tag: string
  amount: number
  note: string
  reverses: string
  corrects: string
  enteredBy: string
  enteredAt: string
  check: string
  rowIndex: number // 1-based
}

export type TagRow = {
  type: string
  tag: string
}

export type SheetIssue = {
  kind: "transaction" | "kid"
  rowIndex: number
  message: string
}

export type BankData = {
  kids: Kid[]
  transactions: Transaction[]
  tags: TagRow[]
  issues: SheetIssue[]
  spreadsheetUrl: string
  title: string
}

export type Overlay =
  | { kind: "none" }
  | { kind: "add-entry"; mode: TxType; prefill?: Partial<Transaction>; correctsId?: string }
  | { kind: "entry"; txId: string }
  | { kind: "settings" }
  | { kind: "open-account" }
  | { kind: "confirm-reverse"; txId: string }
  | { kind: "confirm-correct"; txId: string }
