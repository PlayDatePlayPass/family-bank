# Family Bank

Kid-centered allowance bank for Dan & Jane.

Live: https://playdateplaypass.github.io/family-bank/

## Day-one gate

1. Google Cloud OAuth Web client (Testing mode), Dan + Jane as test users.
2. Authorized JavaScript origin: `https://playdateplaypass.github.io` (and `http://localhost:5173` for local).
3. Set `googleClientId` in `public/config.json`.
4. Push `main` → Pages deploys.
5. On Android Chrome and iPhone: Add to Home Screen → open icon → Sign in → Probe Sheets API.

## Dev

```bash
npm install
npm run dev
```
