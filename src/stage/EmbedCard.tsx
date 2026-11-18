import { useState, type CSSProperties } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { GripVertical, ImageIcon } from 'lucide-react'
import { hex, type Embed, type EmbedField } from '../model/embed'
import { isPlaceholder, useEditor, type Selection } from '../model/store'
import { Markdown } from '../markdown/render'
import { InlineText } from './InlineText'
import { Part } from './Part'
import { useView } from './view'

export function discordTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (that === day) return `Today at ${time}`
  if (day - that === 86400000) return `Yesterday at ${time}`
  return `${d.toLocaleDateString('en-US')} ${time}`
}

export function fieldColumns(fields: EmbedField[], hasThumb: boolean): string[] {
  const max = hasThumb ? 2 : 3
  const cols: string[] = []
  let i = 0
  while (i < fields.length) {
    const f = fields[i]!
    if (!f.inline) {
      cols.push('1 / 13')
      i++
      continue
    }
    let n = 0
    while (i + n < fields.length && fields[i + n]!.inline && n < max) n++
    const span = 12 / n
    for (let k = 0; k < n; k++) cols.push(`${1 + k * span} / ${1 + (k + 1) * span}`)
    i += n
  }
  return cols
}

function useEditingFor(sel: Selection) {
  return useEditor(
    (s) =>
      s.editing &&
      !!s.selection &&
      s.selection.embedId === sel.embedId &&
      s.selection.part === sel.part &&
      s.selection.fieldId === sel.fieldId &&
      s.selection.sub === sel.sub,
  )
}

function EditableText({
  sel,
  value,
  onChange,
  multiline,
  placeholder,
  markdown = true,
  inlineMd = false,
}: {
  sel: Selection
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  placeholder: string
  markdown?: boolean
  inlineMd?: boolean
}) {
  const editing = useEditingFor(sel)
  const setEditing = useEditor((s) => s.setEditing)
  const select = useEditor((s) => s.select)
  return (
    <span
      className="editable"
      onClick={(e) => {
        e.stopPropagation()
        select(sel, true)
      }}
    >
      <InlineText
        value={value}
        editing={editing}
        onChange={onChange}
        onDone={() => setEditing(false)}
        multiline={multiline}
        placeholder={placeholder}
      >
        {markdown ? <Markdown text={value} inline={inlineMd} /> : value}
      </InlineText>
    </span>
  )
}

function Media({ url, kind, embedId }: { url: string; kind: 'image' | 'thumbnail'; embedId: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  const select = useEditor((s) => s.select)
  const empty = !url || isPlaceholder(url) || failed === url
  if (empty) {
    return (
      <button
        type="button"
        className={`media-slot media-${kind}`}
        onClick={(e) => {
          e.stopPropagation()
          select({ embedId, part: kind })
        }}
      >
        <ImageIcon size={kind === 'image' ? 28 : 20} />
        {kind === 'image' && <span>{failed === url && url && !isPlaceholder(url) ? 'Image did not load' : 'Add an image URL'}</span>}
      </button>
    )
  }
  return <img className={`media-${kind}`} src={url} alt="" draggable={false} onError={() => setFailed(url)} />
}

function SortableField({
  field,
  embedId,
  column,
}: {
  field: EmbedField
  embedId: string
  column: string
}) {
  const { updateField } = useEditor.getState()
  const zoom = useView((s) => s.zoom)
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `field:${field.id}`,
    data: { type: 'field', embedId, fieldId: field.id },
  })
  const t = transform ? `translate3d(${transform.x / zoom}px, ${transform.y / zoom}px, 0) ` : ''
  const sel: Selection = { embedId, part: 'field', fieldId: field.id }
  return (
    <Part
      sel={sel}
      z={2}
      label="Field"
      className={`dc-field ${isDragging ? 'is-dragging' : ''}`}
      innerRef={setNodeRef}
      dragProps={{ ...attributes, ...listeners }}
      style={{ gridColumn: column, '--drag': t, transition } as CSSProperties}
    >
      <div className="dc-field-name">
        <EditableText
          sel={{ ...sel, sub: 'name' }}
          value={field.name}
          inlineMd
          placeholder="Field name"
          onChange={(v) => updateField(embedId, field.id, { name: v }, `fname:${field.id}`)}
        />
      </div>
      <div className="dc-field-value">
        <EditableText
          sel={{ ...sel, sub: 'value' }}
          value={field.value}
          multiline
          placeholder="Field value"
          onChange={(v) => updateField(embedId, field.id, { value: v }, `fvalue:${field.id}`)}
        />
      </div>
    </Part>
  )
}

export function EmbedCard({ embed, index }: { embed: Embed; index: number }) {
  const { updateEmbed } = useEditor.getState()
  const zoom = useView((s) => s.zoom)
  const dragKind = useView((s) => s.dragging)
  const { setNodeRef, attributes, listeners, transform, transition, isDragging, isOver } = useSortable({
    id: `embed:${embed.id}`,
    data: { type: 'embed', embedId: embed.id },
  })
  const drop = useDroppable({ id: `embed-body:${embed.id}`, data: { type: 'embed-body', embedId: embed.id } })
  const id = embed.id
  const hasThumb = !!embed.thumbnail
  const cols = fieldColumns(embed.fields, hasThumb)
  const showFooter = !!embed.footer || !!embed.timestamp
  const blank =
    !embed.author && !embed.title && !embed.description && !embed.fields.length && !embed.image && !embed.thumbnail && !showFooter
  const t = transform ? `translate3d(${transform.x / zoom}px, ${transform.y / zoom}px, 0)` : undefined

  return (
    <div
      ref={setNodeRef}
      className={`dc-embed-wrap ${isDragging ? 'is-dragging' : ''}`}
      style={{ transform: t, transition }}
    >
      <Part
        sel={{ embedId: id, part: 'embed' }}
        z={0}
        label={`Embed ${index + 1}`}
        innerRef={drop.setNodeRef}
        className={`dc-embed ${drop.isOver || isOver ? 'is-drop' : ''} ${dragKind ? 'is-target' : ''}`}
        style={{ borderLeftColor: embed.color != null ? hex(embed.color) : 'var(--dc-default-bar)' }}
      >
        <button type="button" className="embed-grip" aria-label={`Drag embed ${index + 1}`} {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>
        <div className={`dc-embed-grid ${hasThumb ? 'has-thumb' : ''}`}>
          {embed.author && (
            <Part sel={{ embedId: id, part: 'author' }} z={1} label="Author" className="dc-author">
              {embed.author.iconUrl && <img className="dc-author-icon" src={embed.author.iconUrl} alt="" draggable={false} />}
              <span className={embed.author.url ? 'dc-author-name is-link' : 'dc-author-name'}>
                <EditableText
                  sel={{ embedId: id, part: 'author' }}
                  value={embed.author.name}
                  markdown={false}
                  placeholder="Author name"
                  onChange={(v) => updateEmbed(id, { author: { ...embed.author!, name: v } }, `author:${id}`)}
                />
              </span>
            </Part>
          )}
          {embed.title && (
            <Part sel={{ embedId: id, part: 'title' }} z={1.5} label="Title" className={embed.url ? 'dc-title is-link' : 'dc-title'}>
              <EditableText
                sel={{ embedId: id, part: 'title' }}
                value={embed.title}
                inlineMd
                placeholder="Title"
                onChange={(v) => updateEmbed(id, { title: v }, `title:${id}`)}
              />
            </Part>
          )}
          {embed.description && (
            <Part sel={{ embedId: id, part: 'description' }} z={1} label="Description" className="dc-description">
              <EditableText
                sel={{ embedId: id, part: 'description' }}
                value={embed.description}
                multiline
                placeholder="Description"
                onChange={(v) => updateEmbed(id, { description: v }, `desc:${id}`)}
              />
            </Part>
          )}
          {embed.fields.length > 0 && (
            <SortableContext items={embed.fields.map((f) => `field:${f.id}`)} strategy={rectSortingStrategy}>
              <div className="dc-fields">
                {embed.fields.map((f, i) => (
                  <SortableField key={f.id} field={f} embedId={id} column={cols[i] ?? '1 / 13'} />
                ))}
              </div>
            </SortableContext>
          )}
          {embed.image && (
            <Part sel={{ embedId: id, part: 'image' }} z={2.5} label="Image" className="dc-image">
              <Media url={embed.image} kind="image" embedId={id} />
            </Part>
          )}
          {embed.thumbnail && (
            <Part sel={{ embedId: id, part: 'thumbnail' }} z={3} label="Thumbnail" className="dc-thumb">
              <Media url={embed.thumbnail} kind="thumbnail" embedId={id} />
            </Part>
          )}
          {showFooter && (
            <div className="dc-footer">
              {embed.footer && (
                <Part sel={{ embedId: id, part: 'footer' }} z={1} label="Footer" className="dc-footer-text">
                  {embed.footer.iconUrl && <img className="dc-footer-icon" src={embed.footer.iconUrl} alt="" draggable={false} />}
                  <EditableText
                    sel={{ embedId: id, part: 'footer' }}
                    value={embed.footer.text}
                    markdown={false}
                    placeholder="Footer text"
                    onChange={(v) => updateEmbed(id, { footer: { ...embed.footer!, text: v } }, `footer:${id}`)}
                  />
                </Part>
              )}
              {embed.footer && embed.timestamp && <span className="dc-footer-sep">•</span>}
              {embed.timestamp && (
                <Part sel={{ embedId: id, part: 'timestamp' }} z={1} label="Timestamp" className="dc-timestamp">
                  {discordTime(embed.timestamp)}
                </Part>
              )}
            </div>
          )}
          {blank && <div className="embed-blank">Drop blocks here</div>}
        </div>
      </Part>
    </div>
  )
}
