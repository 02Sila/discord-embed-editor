import type { CSSProperties, ReactNode } from 'react'
import { Columns2, Copy, Rows2, Trash2 } from 'lucide-react'
import { sameSelection, useEditor, type Selection } from '../model/store'

interface Props {
  sel: Selection
  z: number
  className?: string
  style?: CSSProperties
  children: ReactNode
  label: string
  innerRef?: (el: HTMLElement | null) => void
  dragProps?: Record<string, unknown>
}

export function Part({ sel, z, className = '', style, children, label, innerRef, dragProps }: Props) {
  const selected = useEditor((s) => sameSelection(s.selection, sel))
  const select = useEditor((s) => s.select)
  return (
    <div
      ref={innerRef}
      className={`part ${className} ${selected ? 'is-selected' : ''}`}
      style={{ ...style, '--z': z } as CSSProperties}
      data-part={sel.part}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        select(sel, !['embed', 'image', 'thumbnail', 'timestamp', 'sender', 'field'].includes(sel.part))
      }}
      {...dragProps}
    >
      {children}
      {selected && <PartTools sel={sel} />}
    </div>
  )
}

export function PartTools({ sel }: { sel: Selection }) {
  const { removePart, duplicateField, duplicateEmbed, updateField } = useEditor.getState()
  const field = useEditor((s) =>
    sel.part === 'field' ? s.message.embeds.find((e) => e.id === sel.embedId)?.fields.find((f) => f.id === sel.fieldId) : undefined,
  )
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }
  return (
    <div className="part-tools" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      {field && sel.embedId && (
        <button
          type="button"
          className="part-tool"
          aria-label={field.inline ? 'Put on its own line' : 'Make inline'}
          data-tip={field.inline ? 'Own line' : 'Inline'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={stop(() => updateField(sel.embedId!, field.id, { inline: !field.inline }))}
        >
          {field.inline ? <Rows2 size={14} /> : <Columns2 size={14} />}
        </button>
      )}
      {(sel.part === 'field' || sel.part === 'embed') && sel.embedId && (
        <button
          type="button"
          className="part-tool"
          aria-label="Duplicate"
          data-tip="Duplicate"
          onMouseDown={(e) => e.preventDefault()}
          onClick={stop(() =>
            sel.part === 'field' ? duplicateField(sel.embedId!, sel.fieldId!) : duplicateEmbed(sel.embedId!),
          )}
        >
          <Copy size={14} />
        </button>
      )}
      <button
        type="button"
        className="part-tool is-danger"
        aria-label="Remove"
        data-tip="Remove"
        onMouseDown={(e) => e.preventDefault()}
        onClick={stop(() => removePart(sel))}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
