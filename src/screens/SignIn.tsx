type Props = {
  busy: boolean
  error: string | null
  onSignIn: () => void
}

export function SignIn({ busy, error, onSignIn }: Props) {
  return (
    <div className="page sign-in">
      <header className="frame">
        <p className="eyebrow">FAMILY BANK</p>
        <h1>Family Bank</h1>
        <p className="sub">Build 6</p>
      </header>
      <section className="frame">
        {error && (
          <p className="err-msg">Couldn&apos;t sign in. Try again.</p>
        )}
        {error && <p className="hint">{error}</p>}
        <button
          type="button"
          className="btn outline"
          disabled={busy}
          onClick={onSignIn}
        >
          {busy ? "Working…" : "Sign in with Google"}
        </button>
      </section>
    </div>
  )
}
