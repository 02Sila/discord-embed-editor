import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

interface Props {
  value: string
  editing: boolean
  onChange: (v: string) => void
  onDone: () => void
  multiline?: boolean
  placeholder: string
  className?: string
  children: ReactNode
}

export function InlineText({ value, editing, onChange, onDone, multiline = false, placeholder, className = '', children }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = el.scrollHeight + 'px'
  }, [value, editing])

  useEffect(() => {
    if (!editing) return
    const el = ref.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  if (editing) {
    return (
      <textarea
        ref={ref}
        className={`inline-edit ${className}`}
        value={value}
        placeholder={placeholder}
        rows={1}
        spellCheck
        aria-label={placeholder}
        onChange={(e) => onChange(multiline ? e.target.value : e.target.value.replace(/\n/g, ' '))}
        onBlur={onDone}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape' || (e.key === 'Enter' && !multiline && !e.shiftKey)) {
            e.preventDefault()
            onDone()
          }
        }}
      />
    )
  }

  return <>{value ? children : <span className="inline-placeholder">{placeholder}</span>}</>
}
