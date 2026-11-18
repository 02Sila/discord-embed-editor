import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, children, className = '', ...rest },
  ref,
) {
  return (
    <button ref={ref} type="button" className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon}
      {children != null && <span>{children}</span>}
    </button>
  )
})

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, children, className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      data-tip={label}
      aria-pressed={active}
      className={`icon-btn ${active ? 'is-active' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="switch-track">
        <span className="switch-thumb" />
      </span>
      <span className="switch-label">{label}</span>
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (v: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  return (
    <div className={`segmented segmented-${size}`} role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className="segmented-item"
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
            if (!dir) return
            e.preventDefault()
            const next = (i + dir + options.length) % options.length
            const opt = options[next]
            if (opt) onChange(opt.value)
            refs.current[next]?.focus()
          }}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function Counter({ length, max }: { length: number; max: number }) {
  const over = length > max
  if (length < max * 0.8 && !over) return null
  return (
    <span className={over ? 'counter is-over' : 'counter'}>
      {length}/{max}
    </span>
  )
}

type FieldProps = {
  label: string
  max?: number
  hint?: string
  error?: string | null
}

export function TextInput({
  label,
  max,
  error,
  value,
  ...rest
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> & { value: string }) {
  const id = useId()
  return (
    <div className={error ? 'field has-error' : 'field'}>
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        {max != null && <Counter length={value.length} max={max} />}
      </div>
      <input id={id} className="input" value={value} spellCheck={false} {...rest} />
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}

export function TextArea({
  label,
  max,
  error,
  value,
  ...rest
}: FieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> & { value: string }) {
  const id = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight + 2, 360) + 'px'
  }, [value])
  return (
    <div className={error ? 'field has-error' : 'field'}>
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        {max != null && <Counter length={value.length} max={max} />}
      </div>
      <textarea id={id} ref={ref} className="input textarea" value={value} rows={2} {...rest} />
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}

export function urlError(v: string): string | null {
  if (!v) return null
  return /^https?:\/\/\S+$/i.test(v) ? null : 'Use a full http or https link'
}
