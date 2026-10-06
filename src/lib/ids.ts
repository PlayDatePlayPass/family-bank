const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function randomChars(n: number): string {
  let out = ""
  const buf = new Uint8Array(n)
  crypto.getRandomValues(buf)
  for (let i = 0; i < n; i++) out += ALPHA[buf[i]! % ALPHA.length]
  return out
}

export function newKidId(): string {
  return `K-${randomChars(4)}`
}

export function newTxId(when = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0")
  const stamp =
    `${when.getFullYear()}${pad(when.getMonth() + 1)}${pad(when.getDate())}` +
    `${pad(when.getHours())}${pad(when.getMinutes())}${pad(when.getSeconds())}`
  return `T-${stamp}${randomChars(4)}`
}

/** Fingerprint of B, C, E–J (excludes display name D). */
export function fingerprint(parts: {
  date: string
  kidId: string
  type: string
  tag: string
  amount: number
  note: string
  reverses: string
  corrects: string
}): string {
  const amount = Number.isFinite(parts.amount)
    ? parts.amount.toFixed(2)
    : String(parts.amount)
  const raw = [
    parts.date.trim(),
    parts.kidId.trim(),
    parts.type.trim(),
    parts.tag.trim(),
    amount,
    parts.note,
    parts.reverses.trim(),
    parts.corrects.trim(),
  ].join("|")
  let h = 2166136261
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

export function todayYmd(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseSheetId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (fromUrl?.[1]) return fromUrl[1]
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed
  return null
}
