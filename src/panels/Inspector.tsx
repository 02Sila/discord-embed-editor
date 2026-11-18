import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import { createField, LIMITS, totalLength, type Embed } from '../model/embed'
import { isPlaceholder, PLACEHOLDER_IMAGE, PLACEHOLDER_THUMB, useEditor, type Part } from '../model/store'
import { ColorPicker } from '../ui/ColorPicker'
import { DateTimePicker } from '../ui/DateTimePicker'
import { Button, IconButton, Switch, TextArea, TextInput, urlError } from '../ui/controls'

function Section({
  id,
  title,
  active,
  onRemove,
  children,
}: {
  id: string
  title: string
  active: boolean
  onRemove?: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])
  return (
    <section ref={ref} id={id} className={active ? 'insp-section is-active' : 'insp-section'}>
      <div className="insp-head">
        <h3>{title}</h3>
        {onRemove && (
          <IconButton label={`Remove ${title.toLowerCase()}`} onClick={onRemove}>
            <Trash2 size={15} />
          </IconButton>
        )}
      </div>
      <div className="insp-body">{children}</div>
    </section>
  )
}

function AddRow({ items }: { items: { label: string; onClick: () => void }[] }) {
  if (!items.length) return null
  return (
    <div className="add-row">
      {items.map((i) => (
        <button key={i.label} type="button" className="add-chip" onClick={i.onClick}>
          <Plus size={14} />
          <span>{i.label}</span>
        </button>
      ))}
    </div>
  )
}

function urlValue(v: string) {
  return isPlaceholder(v) ? '' : v
}

function EmbedForm({ embed, activePart, activeField }: { embed: Embed; activePart: Part | null; activeField?: string }) {
  const { updateEmbed, updateField, removePart, addBlock, set } = useEditor.getState()
  const id = embed.id
  const is = (p: Part) => activePart === p

  const missing = [
    !embed.author && { label: 'Author', onClick: () => addBlock(id, 'author') },
    !embed.title && { label: 'Title', onClick: () => addBlock(id, 'title') },
    !embed.description && { label: 'Description', onClick: () => addBlock(id, 'description') },
    !embed.image && { label: 'Image', onClick: () => addBlock(id, 'image') },
    !embed.thumbnail && { label: 'Thumbnail', onClick: () => addBlock(id, 'thumbnail') },
    !embed.footer && { label: 'Footer', onClick: () => addBlock(id, 'footer') },
    !embed.timestamp && { label: 'Timestamp', onClick: () => addBlock(id, 'timestamp') },
  ].filter(Boolean) as { label: string; onClick: () => void }[]

  const moveField = (from: number, to: number) =>
    set((m) => ({
      ...m,
      embeds: m.embeds.map((e) => {
        if (e.id !== id) return e
        const fields = e.fields.slice()
        const [f] = fields.splice(from, 1)
        if (f) fields.splice(to, 0, f)
        return { ...e, fields }
      }),
    }))

  return (
    <>
      <Section id="insp-color" title="Color" active={is('color') || is('embed')}>
        <ColorPicker value={embed.color} onChange={(c, key) => updateEmbed(id, { color: c }, key ? `${key}:${id}` : undefined)} />
      </Section>

      {embed.author && (
        <Section id="insp-author" title="Author" active={is('author')} onRemove={() => removePart({ embedId: id, part: 'author' })}>
          <TextInput
            label="Name"
            max={LIMITS.author}
            value={embed.author.name}
            onChange={(e) => updateEmbed(id, { author: { ...embed.author!, name: e.target.value } }, `author:${id}`)}
          />
          <TextInput
            label="Link"
            placeholder="https://"
            value={embed.author.url}
            error={urlError(embed.author.url)}
            onChange={(e) => updateEmbed(id, { author: { ...embed.author!, url: e.target.value } }, `author-url:${id}`)}
          />
          <TextInput
            label="Icon URL"
            placeholder="https://"
            value={embed.author.iconUrl}
            error={urlError(embed.author.iconUrl)}
            onChange={(e) => updateEmbed(id, { author: { ...embed.author!, iconUrl: e.target.value } }, `author-icon:${id}`)}
          />
        </Section>
      )}

      {embed.title && (
        <Section id="insp-title" title="Title" active={is('title')} onRemove={() => removePart({ embedId: id, part: 'title' })}>
          <TextInput
            label="Text"
            max={LIMITS.title}
            value={embed.title}
            onChange={(e) => updateEmbed(id, { title: e.target.value }, `title:${id}`)}
          />
          <TextInput
            label="Link"
            placeholder="https://"
            value={embed.url}
            error={urlError(embed.url)}
            onChange={(e) => updateEmbed(id, { url: e.target.value }, `url:${id}`)}
          />
        </Section>
      )}

      {embed.description && (
        <Section
          id="insp-description"
          title="Description"
          active={is('description')}
          onRemove={() => removePart({ embedId: id, part: 'description' })}
        >
          <TextArea
            label="Text"
            max={LIMITS.description}
            value={embed.description}
            onChange={(e) => updateEmbed(id, { description: e.target.value }, `desc:${id}`)}
          />
        </Section>
      )}

      <Section id="insp-fields" title={`Fields ${embed.fields.length ? `(${embed.fields.length}/${LIMITS.fields})` : ''}`} active={is('field') || is('fields')}>
        {embed.fields.map((f, i) => (
          <div key={f.id} className={activeField === f.id ? 'insp-field is-active' : 'insp-field'}>
            <div className="insp-field-head">
              <span className="insp-field-n">Field {i + 1}</span>
              <div className="insp-field-tools">
                <IconButton label="Move up" disabled={i === 0} onClick={() => moveField(i, i - 1)}>
                  <ArrowUp size={15} />
                </IconButton>
                <IconButton label="Move down" disabled={i === embed.fields.length - 1} onClick={() => moveField(i, i + 1)}>
                  <ArrowDown size={15} />
                </IconButton>
                <IconButton label="Duplicate field" onClick={() => useEditor.getState().duplicateField(id, f.id)}>
                  <Copy size={15} />
                </IconButton>
                <IconButton label="Remove field" onClick={() => removePart({ embedId: id, part: 'field', fieldId: f.id })}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </div>
            <TextInput
              label="Name"
              max={LIMITS.fieldName}
              value={f.name}
              error={f.name.trim() ? null : 'Discord needs a name'}
              onChange={(e) => updateField(id, f.id, { name: e.target.value }, `fname:${f.id}`)}
            />
            <TextArea
              label="Value"
              max={LIMITS.fieldValue}
              value={f.value}
              error={f.value.trim() ? null : 'Discord needs a value'}
              onChange={(e) => updateField(id, f.id, { value: e.target.value }, `fvalue:${f.id}`)}
            />
            <Switch label="Inline" checked={f.inline} onChange={(v) => updateField(id, f.id, { inline: v })} />
          </div>
        ))}
        {embed.fields.length < LIMITS.fields && (
          <Button
            size="sm"
            icon={<Plus size={15} />}
            onClick={() =>
              set((m) => ({
                ...m,
                embeds: m.embeds.map((e) => (e.id === id ? { ...e, fields: [...e.fields, createField()] } : e)),
              }))
            }
          >
            Add field
          </Button>
        )}
      </Section>

      {embed.image && (
        <Section id="insp-image" title="Image" active={is('image')} onRemove={() => removePart({ embedId: id, part: 'image' })}>
          <TextInput
            label="Image URL"
            placeholder="https://"
            value={urlValue(embed.image)}
            error={urlError(urlValue(embed.image))}
            autoFocus={is('image') && isPlaceholder(embed.image)}
            onChange={(e) => updateEmbed(id, { image: e.target.value || PLACEHOLDER_IMAGE }, `image:${id}`)}
          />
        </Section>
      )}

      {embed.thumbnail && (
        <Section
          id="insp-thumbnail"
          title="Thumbnail"
          active={is('thumbnail')}
          onRemove={() => removePart({ embedId: id, part: 'thumbnail' })}
        >
          <TextInput
            label="Thumbnail URL"
            placeholder="https://"
            value={urlValue(embed.thumbnail)}
            error={urlError(urlValue(embed.thumbnail))}
            autoFocus={is('thumbnail') && isPlaceholder(embed.thumbnail)}
            onChange={(e) => updateEmbed(id, { thumbnail: e.target.value || PLACEHOLDER_THUMB }, `thumb:${id}`)}
          />
        </Section>
      )}

      {embed.footer && (
        <Section id="insp-footer" title="Footer" active={is('footer')} onRemove={() => removePart({ embedId: id, part: 'footer' })}>
          <TextInput
            label="Text"
            max={LIMITS.footer}
            value={embed.footer.text}
            onChange={(e) => updateEmbed(id, { footer: { ...embed.footer!, text: e.target.value } }, `footer:${id}`)}
          />
          <TextInput
            label="Icon URL"
            placeholder="https://"
            value={embed.footer.iconUrl}
            error={urlError(embed.footer.iconUrl)}
            onChange={(e) => updateEmbed(id, { footer: { ...embed.footer!, iconUrl: e.target.value } }, `footer-icon:${id}`)}
          />
        </Section>
      )}

      {embed.timestamp && (
        <Section
          id="insp-timestamp"
          title="Timestamp"
          active={is('timestamp')}
          onRemove={() => removePart({ embedId: id, part: 'timestamp' })}
        >
          <DateTimePicker value={embed.timestamp} onChange={(iso) => updateEmbed(id, { timestamp: iso })} />
        </Section>
      )}

      <AddRow items={missing} />
    </>
  )
}

export function Inspector() {
  const message = useEditor((s) => s.message)
  const selection = useEditor((s) => s.selection)
  const { set, select, addBlock } = useEditor.getState()
  const embed = message.embeds.find((e) => e.id === selection?.embedId) ?? message.embeds[0]
  const index = embed ? message.embeds.indexOf(embed) : -1
  const total = totalLength(message)
  const part = selection?.embedId && selection.embedId === embed?.id ? selection.part : null

  return (
    <div className="inspector">
      <Section id="insp-message" title="Message" active={selection?.part === 'content' || selection?.part === 'sender'}>
        <TextArea
          label="Content"
          max={LIMITS.content}
          value={message.content}
          placeholder="Text above the embeds"
          onChange={(e) => set((m) => ({ ...m, content: e.target.value }), 'content')}
        />
        <div className="field-pair">
          <TextInput
            label="Username"
            max={LIMITS.username}
            value={message.username}
            placeholder="Webhook"
            onChange={(e) => set((m) => ({ ...m, username: e.target.value }), 'username')}
          />
          <TextInput
            label="Avatar URL"
            value={message.avatarUrl}
            placeholder="https://"
            error={urlError(message.avatarUrl)}
            onChange={(e) => set((m) => ({ ...m, avatarUrl: e.target.value }), 'avatar')}
          />
        </div>
      </Section>

      <div className="embed-tabs" role="tablist" aria-label="Embeds">
        {message.embeds.map((e, i) => (
          <button
            key={e.id}
            type="button"
            role="tab"
            aria-selected={e.id === embed?.id}
            className="embed-tab"
            onClick={() => select({ embedId: e.id, part: 'embed' })}
          >
            Embed {i + 1}
          </button>
        ))}
        {message.embeds.length < LIMITS.embeds && (
          <IconButton label="Add embed" onClick={() => addBlock(embed?.id ?? null, 'embed')}>
            <Plus size={16} />
          </IconButton>
        )}
        <span className={total > LIMITS.total ? 'counter is-over embed-total' : 'counter embed-total'}>
          {total.toLocaleString()} / {LIMITS.total.toLocaleString()}
        </span>
      </div>

      {embed ? (
        <div role="tabpanel" aria-label={`Embed ${index + 1}`} key={embed.id}>
          <EmbedForm embed={embed} activePart={part} activeField={selection?.fieldId} />
        </div>
      ) : (
        <div className="insp-empty">
          <p>No embeds yet.</p>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => addBlock(null, 'embed')}>
            Add embed
          </Button>
        </div>
      )}
    </div>
  )
}
