import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
// build 11: self-hosted IBM Plex Sans (latin) so Android + iPhone render identically, even offline
import "@fontsource/ibm-plex-sans/latin-400.css"
import "@fontsource/ibm-plex-sans/latin-500.css"
import "@fontsource/ibm-plex-sans/latin-600.css"
import "@fontsource/ibm-plex-sans/latin-700.css"
import "./index.css"
import App from "./App.tsx"

// build 14: iOS Safari only fires :active on elements when a touchstart listener exists
document.addEventListener("touchstart", () => {}, { passive: true })

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

const SW_URL = `${import.meta.env.BASE_URL}sw.js?v=17`

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SW_URL)
      .then((reg) => reg.update())
      .catch(() => {})
  })
}
