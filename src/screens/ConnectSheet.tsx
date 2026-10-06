import { useState } from "react"

type Props = {
  busy: boolean
  online: boolean
  error: string | null
  createdUrl: string | null
  onCreate: () => void
  onUseExisting: (input: string) => void
}

export function ConnectSheet({
  busy,
  online,
  error,
  createdUrl,
  onCreate,
  onUseExisting,
}: Props) {
  const [paste, setPaste] = useState("")

  return (
    <div className="page">
      <header className="frame">
        <p className="eyebrow">FAMILY BANK</p>
        <h1>Connect Sheet</h1>
        <p className="sub">Build 9 — one Google Sheet is the bank.</p>
      </header>

      {createdUrl && (
        <section className="frame">
          <p>
            Share this Sheet with your co-parent from Google Drive.
          </p>
          <a
            className="btn outline"
            href={createdUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in Sheets
          </a>
        </section>
      )}

      <button
        type="button"
        className="choice-rect"
        disabled={busy || !online}
        onClick={onCreate}
      >
        <strong>Create family Sheet</strong>
        <span>New Family Bank file in your Drive</span>
      </button>

      <div className="choice-rect static">
        <strong>Use existing Sheet</strong>
        <span>Paste a link or spreadsheet ID</span>
        <input
          className="field"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          type="button"
          className="btn"
          disabled={busy || !online || !paste.trim()}
          onClick={() => onUseExisting(paste)}
        >
          {busy ? "Checking…" : "Connect"}
        </button>
      </div>

      {error && (
        <section className="frame warn">
          <p>{error}</p>
        </section>
      )}
    </div>
  )
}
