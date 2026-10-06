import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// GitHub Pages project site: /family-bank/
export default defineConfig({
  plugins: [react()],
  base: "/family-bank/",
})
