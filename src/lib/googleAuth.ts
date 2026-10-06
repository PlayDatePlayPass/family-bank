export type AppConfig = {
  googleClientId: string
}

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (resp: TokenResponse) => void
            error_callback?: (err: { type?: string; message?: string }) => void
          }) => {
            requestAccessToken: (opts?: { prompt?: string }) => void
          }
        }
      }
    }
  }
}

export type TokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

const TOKEN_KEY = "family-bank-token"
const EMAIL_KEY = "family-bank-email"
const EXPIRES_KEY = "family-bank-token-expires"

export async function loadConfig(): Promise<AppConfig> {
  const res = await fetch(`${import.meta.env.BASE_URL}config.json`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Missing config.json")
  return (await res.json()) as AppConfig
}

export function loadStoredAuth(): {
  accessToken: string | null
  email: string | null
  expiresAt: number | null
} {
  return {
    accessToken: localStorage.getItem(TOKEN_KEY),
    email: localStorage.getItem(EMAIL_KEY),
    expiresAt: Number(localStorage.getItem(EXPIRES_KEY) || 0) || null,
  }
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EMAIL_KEY)
  localStorage.removeItem(EXPIRES_KEY)
}

function storeToken(token: string, expiresIn: number) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(
    EXPIRES_KEY,
    String(Date.now() + Math.max(0, expiresIn - 60) * 1000),
  )
}

export function waitForGoogle(timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      if (window.google?.accounts?.oauth2) {
        resolve()
        return
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Google Identity Services failed to load"))
        return
      }
      window.setTimeout(tick, 50)
    }
    tick()
  })
}

export async function requestAccessToken(
  clientId: string,
  prompt: "" | "consent" = "",
): Promise<string> {
  await waitForGoogle()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SHEETS_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(
            new Error(
              resp.error_description || resp.error || "Sign-in failed",
            ),
          )
          return
        }
        storeToken(resp.access_token, Number(resp.expires_in || 3600))
        resolve(resp.access_token)
      },
      error_callback: (err) => {
        reject(new Error(err.message || err.type || "Sign-in cancelled"))
      },
    })
    client.requestAccessToken({ prompt })
  })
}

export async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error("Could not load Google profile")
  const data = (await res.json()) as { email?: string }
  if (!data.email) throw new Error("No email on Google profile")
  localStorage.setItem(EMAIL_KEY, data.email)
  return data.email
}

export async function probeSheetsApi(accessToken: string): Promise<string> {
  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title: "Family Bank — auth probe (safe to delete)" },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sheets API failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    spreadsheetId?: string
    spreadsheetUrl?: string
  }
  return data.spreadsheetUrl || data.spreadsheetId || "ok"
}
