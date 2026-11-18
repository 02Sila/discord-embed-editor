import { useMemo, useRef, useState } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react'
import { Popover } from './Popover'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function formatLocal(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function DateTimePicker({ value, onChange }: { value: string | null; onChange: (iso: string | null) => void }) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const current = value ? new Date(value) : new Date()
  const [view, setView] = useState(() => new Date(current.getFullYear(), current.getMonth(), 1))
  const [focusDay, setFocusDay] = useState(current)
  const gridRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => {
    const first = new Date(view)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [view])

  const setDate = (d: Date) => {
    const next = new Date(current)
    next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate())
    onChange(next.toISOString())
  }

  const setTime = (h: number, m: number) => {
    const next = new Date(current)
    next.setHours(h, m, 0, 0)
    onChange(next.toISOString())
  }

  const moveFocus = (d: Date) => {
    setFocusDay(d)
    if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) {
      setView(new Date(d.getFullYear(), d.getMonth(), 1))
    }
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>('[data-focus="true"]')?.focus()
    })
  }

  const onGridKey = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    const s = step[e.key]
    if (s != null) {
      e.preventDefault()
      moveFocus(new Date(focusDay.getFullYear(), focusDay.getMonth(), focusDay.getDate() + s))
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      moveFocus(new Date(focusDay.getFullYear(), focusDay.getMonth() + (e.key === 'PageUp' ? -1 : 1), focusDay.getDate()))
    }
  }

  const today = new Date()
  const hh = String(current.getHours()).padStart(2, '0')
  const mm = String(current.getMinutes()).padStart(2, '0')

  return (
    <div className="dtp">
      <button
        ref={anchor}
        type="button"
        className="input dtp-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setView(new Date(current.getFullYear(), current.getMonth(), 1))
          setFocusDay(current)
          setOpen((o) => !o)
        }}
      >
        <CalendarClock size={16} />
        <span>{value ? formatLocal(value) : 'No timestamp'}</span>
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} label="Pick date and time">
        <div className="cal">
          <div className="cal-head">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous month"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="cal-title">{view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next month"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="cal-grid" role="grid" ref={gridRef} onKeyDown={onGridKey}>
            {WEEKDAYS.map((w) => (
              <span key={w} className="cal-wd" role="columnheader">
                {w}
              </span>
            ))}
            {days.map((d) => {
              const selected = value != null && sameDay(d, current)
              const focused = sameDay(d, focusDay)
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  role="gridcell"
                  aria-selected={selected}
                  data-focus={focused}
                  tabIndex={focused ? 0 : -1}
                  className={[
                    'cal-day',
                    d.getMonth() !== view.getMonth() && 'is-out',
                    sameDay(d, today) && 'is-today',
                    selected && 'is-selected',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setFocusDay(d)
                    setDate(d)
                  }}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
          <div className="cal-time">
            <label className="cal-time-field">
              <span>Time</span>
              <input
                className="input"
                inputMode="numeric"
                aria-label="Hours"
                value={hh}
                onChange={(e) => {
                  const h = parseInt(e.target.value.replace(/\D/g, '').slice(-2) || '0', 10)
                  if (h <= 23) setTime(h, current.getMinutes())
                }}
              />
              <span aria-hidden>:</span>
              <input
                className="input"
                inputMode="numeric"
                aria-label="Minutes"
                value={mm}
                onChange={(e) => {
                  const m = parseInt(e.target.value.replace(/\D/g, '').slice(-2) || '0', 10)
                  if (m <= 59) setTime(current.getHours(), m)
                }}
              />
            </label>
            <div className="cal-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(new Date().toISOString())}>
                Now
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </Popover>
    </div>
  )
}
