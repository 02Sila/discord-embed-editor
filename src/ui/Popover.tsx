import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  anchor: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  children: ReactNode
  align?: 'start' | 'end'
  label: string
  role?: 'dialog' | 'menu' | 'listbox'
}

const GAP = 8
const GUTTER = 12

export function useIsSheet(): boolean {
  const [sheet, setSheet] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const on = () => setSheet(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return sheet
}

export function Popover({ anchor, open, onClose, children, align = 'start', label, role = 'dialog' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; origin: string } | null>(null)
  const sheet = useIsSheet()

  useLayoutEffect(() => {
    if (!open || sheet) return
    const place = () => {
      const a = anchor.current?.getBoundingClientRect()
      const el = ref.current
      if (!a || !el) return
      const w = el.offsetWidth
      const h = el.offsetHeight
      const vw = window.innerWidth
      const vh = window.innerHeight
      let left = align === 'end' ? a.right - w : a.left
      left = Math.max(GUTTER, Math.min(left, vw - w - GUTTER))
      let top = a.bottom + GAP
      let origin = 'top'
      if (top + h > vh - GUTTER && a.top - GAP - h > GUTTER) {
        top = a.top - GAP - h
        origin = 'bottom'
      }
      top = Math.max(GUTTER, Math.min(top, vh - h - GUTTER))
      setPos({ top, left, origin })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchor, align, sheet])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        anchor.current?.focus()
      }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return
      onClose()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [open, onClose, anchor])

  useEffect(() => {
    if (!open) setPos(null)
  }, [open])

  if (!open) return null

  return createPortal(
    <>
      {sheet && <div className="sheet-backdrop" onClick={onClose} />}
      <div
        ref={ref}
        role={role}
        aria-label={label}
        className={sheet ? 'popover is-sheet' : 'popover'}
        style={
          sheet
            ? undefined
            : {
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                transformOrigin: pos?.origin === 'bottom' ? 'bottom center' : 'top center',
                visibility: pos ? 'visible' : 'hidden',
              }
        }
      >
        {children}
      </div>
    </>,
    document.body,
  )
}
