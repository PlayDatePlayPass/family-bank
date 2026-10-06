import type { ThemeFamily } from "./types"

export function clampHue(h: number): number {
  let x = h % 360
  if (x < 0) x += 360
  return x
}

export function hexToHue(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0
  const n = parseInt(m[1]!, 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return clampHue(h * 60)
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}

/** Default Bold red #D0021B ≈ hue 354 / sat 98 / light 41 */
export function accentFromHue(hue: number, theme: ThemeFamily): string {
  const h = clampHue(hue)
  if (theme === "Bold") return hslToHex(h, 98, 41)
  return hslToHex(h, 80, 42)
}

export const DEFAULT_COLOR = "#D0021B"
export const DEFAULT_THEME: ThemeFamily = "Bold"

export type ThemeVars = {
  bg: string
  text: string
  muted: string
  accent: string
  line: string
  lineWidth: string
  balanceTint: string
  negative: string
  surface: string
}

export function themeVars(theme: ThemeFamily, accent: string): ThemeVars {
  if (theme === "Bright") {
    return {
      bg: "#FAF7F2",
      text: "#0B0B0B",
      muted: "#5C6670",
      accent,
      line: accent,
      lineWidth: "1.5px",
      balanceTint: hexWithAlpha(accent, 0.12),
      negative: "#C62828",
      surface: "#FFFFFF",
    }
  }
  return {
    bg: "#0B0B0B",
    text: "#F3F6FA",
    muted: "#9AA7B5",
    accent,
    line: accent,
    lineWidth: "1px",
    balanceTint: "transparent",
    negative: "#E5484D",
    surface: "#121212",
  }
}

function hexWithAlpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1]!, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${a})`
}

export function applyThemeToRoot(vars: ThemeVars): void {
  const root = document.documentElement
  root.style.setProperty("--bg", vars.bg)
  root.style.setProperty("--text", vars.text)
  root.style.setProperty("--muted", vars.muted)
  root.style.setProperty("--accent", vars.accent)
  root.style.setProperty("--line", vars.line)
  root.style.setProperty("--line-w", vars.lineWidth)
  root.style.setProperty("--balance-tint", vars.balanceTint)
  root.style.setProperty("--negative", vars.negative)
  root.style.setProperty("--surface", vars.surface)
  root.style.colorScheme = vars.bg === "#0B0B0B" ? "dark" : "light"
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute("content", vars.bg)
}
