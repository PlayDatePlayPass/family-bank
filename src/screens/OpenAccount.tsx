import { useMemo, useState } from "react"
import { ColorWheel } from "../components/ColorWheel"
import { BigBalance } from "../components/Money"
import {
  accentFromHue,
  DEFAULT_COLOR,
  DEFAULT_THEME,
  hexToHue,
} from "../lib/theme"
import type { ThemeFamily } from "../lib/types"

type Props = {
  existingNames: string[]
  busy: boolean
  online: boolean
  error: string | null
  onCancel?: () => void
  onOpen: (args: {
    name: string
    theme: ThemeFamily
    color: string
  }) => void
}

export function OpenAccount({
  existingNames,
  busy,
  online,
  error,
  onCancel,
  onOpen,
}: Props) {
  const [name, setName] = useState("")
  const [theme, setTheme] = useState<ThemeFamily>(DEFAULT_THEME)
  const [hue, setHue] = useState(hexToHue(DEFAULT_COLOR))
  const color = useMemo(() => accentFromHue(hue, theme), [hue, theme])
  const letter = (name.trim()[0] || "?").toUpperCase()

  const nameTaken = existingNames.some(
    (n) => n.toLowerCase() === name.trim().toLowerCase(),
  )

  return (
    <div className="page sheet-page">
      <header className="sheet-head">
        <p className="eyebrow">OPEN ACCOUNT</p>
        {onCancel && (
          <button type="button" className="text-btn" onClick={onCancel}>
            Back
          </button>
        )}
      </header>

      <label className="label">Name</label>
      <input
        className="field large"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Kid name"
        autoFocus
      />
      {nameTaken && <p className="err-msg">That name is taken.</p>}

      <label className="label">Theme</label>
      <div className="theme-toggle">
        <button
          type="button"
          className={theme === "Bright" ? "active" : ""}
          onClick={() => setTheme("Bright")}
        >
          Bright (4–8)
        </button>
        <button
          type="button"
          className={theme === "Bold" ? "active" : ""}
          onClick={() => setTheme("Bold")}
        >
          Bold (9–15)
        </button>
      </div>

      <label className="label">Color</label>
      <ColorWheel hue={hue} onChange={setHue} accent={color} />

      <div
        className="preview-card"
        style={{
          ["--accent" as string]: color,
          ["--line" as string]: color,
          background: theme === "Bold" ? "#0B0B0B" : "#FAF7F2",
          color: theme === "Bold" ? "#F3F6FA" : "#0B0B0B",
        }}
      >
        <div className="avatar-sq" style={{ background: color, color: "#fff" }}>
          {letter}
        </div>
        <div className="preview-bal">
          <BigBalance value={0} />
        </div>
        <p className="preview-name">{name.trim() || "Name"}</p>
      </div>

      {error && <p className="err-msg">{error}</p>}

      <button
        type="button"
        className="btn"
        disabled={busy || !online || !name.trim() || nameTaken}
        style={{ background: color, borderColor: color }}
        onClick={() =>
          onOpen({ name: name.trim(), theme, color })
        }
      >
        {busy ? "Opening…" : "Open Account"}
      </button>
    </div>
  )
}
