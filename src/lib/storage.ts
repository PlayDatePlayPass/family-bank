const SHEET_KEY = "family-bank-sheet-id"
const KID_KEY = "family-bank-active-kid"

export function loadSheetId(): string | null {
  return localStorage.getItem(SHEET_KEY)
}

export function saveSheetId(id: string): void {
  localStorage.setItem(SHEET_KEY, id)
}

export function clearSheetId(): void {
  localStorage.removeItem(SHEET_KEY)
}

export function loadActiveKidId(): string | null {
  return localStorage.getItem(KID_KEY)
}

export function saveActiveKidId(id: string): void {
  localStorage.setItem(KID_KEY, id)
}
