import { useCallback, useRef } from "react"
import { clampHue } from "../lib/theme"

type Props = {
  hue: number
  onChange: (hue: number) => void
  accent: string
}

function hueFromPointer(
  el: HTMLElement,
  clientX: number,
  clientY: number,
): number {
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const ang = Math.atan2(clientY - cy, clientX - cx)
  // 0 at top going clockwise → convert to CSS hue (0 at red, CCW)
  let deg = (ang * 180) / Math.PI + 90
  return clampHue(deg)
}

export function ColorWheel({ hue, onChange, accent }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const setFromEvent = useCallback(
    (e: React.PointerEvent) => {
      if (!ref.current) return
      onChange(hueFromPointer(ref.current, e.clientX, e.clientY))
    },
    [onChange],
  )

  return (
    <div className="wheel-wrap">
      <div
        ref={ref}
        className="wheel"
        style={{ ["--wheel-accent" as string]: accent }}
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          setFromEvent(e)
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return
          setFromEvent(e)
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(hue)}
        aria-label="Color hue"
        tabIndex={0}
      >
        <div
          className="wheel-knob"
          style={{
            transform: `rotate(${hue}deg) translateY(-58px)`,
          }}
        />
        <div className="wheel-center" style={{ background: accent }} />
      </div>
    </div>
  )
}
