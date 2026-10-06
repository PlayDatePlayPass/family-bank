import { useMemo, useState } from "react"
import { ColorWheel } from "../components/ColorWheel"
import {
  accentFromHue,
  hexToHue,
} from "../lib/theme"
import type { BankData, Kid, ThemeFamily } from "../lib/types"

type Props = {
  email: string
  data: BankData
  online: boolean
  busy: boolean
  onClose: () => void
  onSignOut: () => void
  onSwitchSheet: () => void
  onAddKid: () => void
  onUpdateKid: (
    kid: Kid,
    fields: { name: string; color: string; theme: ThemeFamily },
  ) => Promise<void>
  onAddTag: (tag: string) => Promise<void>
  onFixKidId: (kid: Kid) => Promise<void>
}

export function Settings({
  email,
  data,
  online,
  busy,
  onClose,
  onSignOut,
  onSwitchSheet,
  onAddKid,
  onUpdateKid,
  onAddTag,
  onFixKidId,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [newTag, setNewTag] = useState("")
  const [err, setErr] = useState<string | null>(null)

  return (
    <div className="overlay-sheet">
      <div className="sheet-head">
        <h2>Settings</h2>
        <button type="button" className="text-btn" onClick={onClose}>
          Close
        </button>
      </div>

      <h3 className="section-title">Kids</h3>
      {data.kids.map((k) => {
        const editKey = k.kidId || `row-${k.rowIndex}`
        return editing === editKey ? (
          <KidEditor
            key={k.kidId}
            kid={k}
            others={data.kids.filter((x) => x.kidId !== k.kidId).map((x) => x.name)}
            busy={busy}
            online={online}
            onCancel={() => setEditing(null)}
            onSave={async (fields) => {
              setErr(null)
              try {
                await onUpdateKid(k, fields)
                setEditing(null)
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Save failed")
              }
            }}
          />
        ) : (
          <div key={k.kidId} className="kid-row">
            <div
              className="avatar-sq sm filled"
              style={{ background: k.color, borderColor: k.color }}
            >
              {(k.name[0] || "?").toUpperCase()}
            </div>
            <div className="kid-row-meta">
              <strong>{k.name}</strong>
              <span>
                {k.theme} · {k.color}
                {!k.kidId && " · missing ID"}
              </span>
            </div>
            <button
              type="button"
              className="text-btn"
              disabled={!online}
              onClick={() => setEditing(editKey)}
            >
              Edit
            </button>
            {!k.kidId && (
              <button
                type="button"
                className="text-btn"
                disabled={!online || busy}
                onClick={() => onFixKidId(k)}
              >
                Fix
              </button>
            )}
          </div>
        )
      })}
      <button
        type="button"
        className="btn outline"
        disabled={!online}
        onClick={onAddKid}
      >
        Add kid
      </button>

      <h3 className="section-title">Deposit tags</h3>
      <ul className="tag-list">
        {data.tags
          .filter((t) => t.type === "Deposit" && t.tag !== "Correction")
          .map((t) => (
            <li key={`${t.type}-${t.tag}`}>{t.tag}</li>
          ))}
      </ul>
      <div className="row-input">
        <input
          className="field"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="New tag"
        />
        <button
          type="button"
          className="btn"
          disabled={!online || busy || !newTag.trim()}
          onClick={async () => {
            await onAddTag(newTag.trim())
            setNewTag("")
          }}
        >
          Add tag
        </button>
      </div>

      <h3 className="section-title">Sheet</h3>
      <a
        className="btn outline"
        href={data.spreadsheetUrl}
        target="_blank"
        rel="noreferrer"
      >
        Open in Google Sheets
      </a>
      <button type="button" className="btn ghost" onClick={onSwitchSheet}>
        Switch Sheet
      </button>

      {data.issues.length > 0 && (
        <>
          <h3 className="section-title">Sheet issues</h3>
          <ul className="issue-list">
            {data.issues.map((i, idx) => (
              <li key={`${i.kind}-${i.rowIndex}-${idx}`}>
                Row {i.rowIndex}: {i.message}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="section-title">Account</h3>
      <p className="hint">{email}</p>
      <button type="button" className="btn ghost" onClick={onSignOut}>
        Sign out
      </button>

      {err && <p className="err-msg">{err}</p>}
      <p className="foot">Build 6</p>
    </div>
  )
}

function KidEditor({
  kid,
  others,
  busy,
  online,
  onCancel,
  onSave,
}: {
  kid: Kid
  others: string[]
  busy: boolean
  online: boolean
  onCancel: () => void
  onSave: (f: { name: string; color: string; theme: ThemeFamily }) => void
}) {
  const [name, setName] = useState(kid.name)
  const [theme, setTheme] = useState<ThemeFamily>(kid.theme)
  const [hue, setHue] = useState(hexToHue(kid.color))
  const color = useMemo(() => accentFromHue(hue, theme), [hue, theme])
  const taken = others.some((n) => n.toLowerCase() === name.trim().toLowerCase())

  return (
    <div className="kid-editor frame">
      <input
        className="field"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {taken && <p className="err-msg">That name is taken.</p>}
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
      <ColorWheel hue={hue} onChange={setHue} accent={color} />
      <div className="row-input">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn"
          disabled={!online || busy || !name.trim() || taken}
          onClick={() => onSave({ name: name.trim(), color, theme })}
        >
          Save
        </button>
      </div>
    </div>
  )
}
