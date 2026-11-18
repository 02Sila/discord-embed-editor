import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Check, X } from 'lucide-react'
import { DISCORD_COLORS, hex, parseHex } from '../model/embed'
import { Popover } from './Popover'

interface HSV {
  h: number
  s: number
  v: number
}

function toHsv(c: number): HSV {
  const r = ((c >> 16) & 255) / 255
  const g = ((c >> 8) & 255) / 255
  const b = (c & 255) / 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max ? d / max : 0, v: max }
}

function fromHsv({ h, s, v }: HSV): number {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
  }
  return (f(5) << 16) | (f(3) << 8) | f(1)
}

function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null)
  const handle = (e: RPointerEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    onMove(
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    )
  }
  return {
    ref,
    onPointerDown: (e: RPointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      handle(e)
    },
    onPointerMove: (e: RPointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) handle(e)
    },
  }
}

export function ColorPicker({ value, onChange }: { value: number | null; onChange: (c: number | null, key?: string) => void }) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [hsv, setHsv] = useState<HSV>(() => toHsv(value ?? 0x00a8fc))
  const [text, setText] = useState(value != null ? hex(value) : '')

  useEffect(() => {
    if (value != null && fromHsv(hsv) !== value) setHsv(toHsv(value))
    setText(value != null ? hex(value) : '')
  }, [value])

  const commit = (next: HSV) => {
    setHsv(next)
    onChange(fromHsv(next), 'color-drag')
  }

  const sv = useDrag((x, y) => commit({ ...hsv, s: x, v: 1 - y }))
  const hue = useDrag((x) => commit({ ...hsv, h: x * 359.9 }))

  const keyNudge = (e: React.KeyboardEvent, axis: 's' | 'v' | 'h') => {
    const step = (e.shiftKey ? 10 : 1) * (axis === 'h' ? 1 : 0.01)
    const map: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }
    const d = map[e.key]
    if (d == null) return
    e.preventDefault()
    const max = axis === 'h' ? 359.9 : 1
    commit({ ...hsv, [axis]: Math.max(0, Math.min(max, hsv[axis] + d)) })
  }

  return (
    <div className="color-picker">
      <button
        ref={anchor}
        type="button"
        className="color-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value == null ? 'swatch is-none' : 'swatch'} style={value != null ? { background: hex(value) } : undefined} />
        <span>{value != null ? hex(value) : 'Default'}</span>
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} label="Embed color">
        <div className="cp">
          <div
            className="cp-sv"
            style={{ background: `hsl(${hsv.h} 100% 50%)` }}
            {...sv}
            role="slider"
            tabIndex={0}
            aria-label="Saturation and brightness"
            aria-valuetext={`${Math.round(hsv.s * 100)}% saturation, ${Math.round(hsv.v * 100)}% brightness`}
            onKeyDown={(e) => keyNudge(e, e.key === 'ArrowUp' || e.key === 'ArrowDown' ? 'v' : 's')}
          >
            <div className="cp-sv-white" />
            <div className="cp-sv-black" />
            <div className="cp-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex(fromHsv(hsv)) }} />
          </div>
          <div
            className="cp-hue"
            {...hue}
            role="slider"
            tabIndex={0}
            aria-label="Hue"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsv.h)}
            onKeyDown={(e) => keyNudge(e, 'h')}
          >
            <div className="cp-thumb" style={{ left: `${(hsv.h / 360) * 100}%`, top: '50%', background: `hsl(${hsv.h} 100% 50%)` }} />
          </div>
          <div className="cp-row">
            <input
              className="input cp-hex"
              aria-label="Hex color"
              value={text}
              placeholder="#000000"
              spellCheck={false}
              onChange={(e) => {
                setText(e.target.value)
                const c = parseHex(e.target.value)
                if (c != null) onChange(c, 'color-hex')
              }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
              <X size={14} />
              <span>No color</span>
            </button>
          </div>
          <div className="cp-presets" role="listbox" aria-label="Discord colors">
            {DISCORD_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="option"
                aria-selected={value === c.value}
                aria-label={c.name}
                data-tip={c.name}
                className="cp-preset"
                style={{ background: hex(c.value) }}
                onClick={() => onChange(c.value)}
              >
                {value === c.value && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
      </Popover>
    </div>
  )
}
