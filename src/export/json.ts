import {
  createEmbed,
  createField,
  isEmbedEmpty,
  LIMITS,
  parseHex,
  type Embed,
  type EmbedField,
  type Message,
} from '../model/embed'

export type ImportResult = { ok: true; message: Message } | { ok: false; error: string }

type Json = Record<string, unknown>

export function isoTimestamp(ts: string | null): string | null {
  if (!ts) return null
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function exportableEmbeds(m: Message): Embed[] {
  return m.embeds.filter((e) => !isEmbedEmpty(e))
}

export function toApiEmbed(e: Embed): Json {
  const out: Json = {}
  if (e.author?.name) {
    const author: Json = { name: e.author.name }
    if (e.author.url) author.url = e.author.url
    if (e.author.iconUrl) author.icon_url = e.author.iconUrl
    out.author = author
  }
  if (e.title) out.title = e.title
  if (e.title && e.url) out.url = e.url
  if (e.description) out.description = e.description
  if (e.color !== null) out.color = e.color
  if (e.fields.length > 0) {
    out.fields = e.fields.map((f) => {
      const field: Json = { name: f.name, value: f.value }
      if (f.inline) field.inline = true
      return field
    })
  }
  if (e.thumbnail) out.thumbnail = { url: e.thumbnail }
  if (e.image) out.image = { url: e.image }
  if (e.footer?.text) {
    const footer: Json = { text: e.footer.text }
    if (e.footer.iconUrl) footer.icon_url = e.footer.iconUrl
    out.footer = footer
  }
  const ts = isoTimestamp(e.timestamp)
  if (ts) out.timestamp = ts
  return out
}

export function toEmbedsJson(m: Message): string {
  return JSON.stringify({ embeds: exportableEmbeds(m).map(toApiEmbed) }, null, 2)
}

export function toWebhookPayload(m: Message): Json {
  const out: Json = {}
  if (m.content) out.content = m.content
  if (m.username) out.username = m.username
  if (m.avatarUrl) out.avatar_url = m.avatarUrl
  out.embeds = exportableEmbeds(m).map(toApiEmbed)
  return out
}

export function toWebhookJson(m: Message): string {
  return JSON.stringify(toWebhookPayload(m), null, 2)
}

const EMBED_KEYS = [
  'title',
  'description',
  'url',
  'color',
  'author',
  'footer',
  'fields',
  'image',
  'thumbnail',
  'timestamp',
]

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

function mediaUrl(v: unknown): string {
  if (typeof v === 'string') return v
  if (isObject(v)) return str(v.url)
  return ''
}

function parseColor(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.trunc(v)
    return n >= 0 && n <= 0xffffff ? n : null
  }
  if (typeof v === 'string') {
    const s = v.trim()
    if (/^\d+$/.test(s)) return parseColor(Number(s))
    return parseHex(s.replace(/^0x/i, ''))
  }
  return null
}

function parseTimestamp(v: unknown): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function parseField(v: unknown): EmbedField | null {
  if (!isObject(v)) return null
  return createField({ name: str(v.name), value: str(v.value), inline: v.inline === true })
}

function looksLikeEmbed(v: unknown): v is Json {
  return isObject(v) && EMBED_KEYS.some((k) => k in v)
}

export function fromApiEmbed(raw: Json): Embed {
  const author = isObject(raw.author)
    ? {
        name: str(raw.author.name),
        url: str(raw.author.url),
        iconUrl: str(raw.author.icon_url ?? raw.author.iconURL ?? raw.author.iconUrl),
      }
    : null
  const footer = isObject(raw.footer)
    ? {
        text: str(raw.footer.text),
        iconUrl: str(raw.footer.icon_url ?? raw.footer.iconURL ?? raw.footer.iconUrl),
      }
    : null
  const fields = Array.isArray(raw.fields)
    ? raw.fields.map(parseField).filter((f): f is EmbedField => f !== null).slice(0, LIMITS.fields)
    : []
  return createEmbed({
    color: parseColor(raw.color),
    author,
    title: str(raw.title),
    url: str(raw.url),
    description: str(raw.description),
    fields,
    image: mediaUrl(raw.image),
    thumbnail: mediaUrl(raw.thumbnail),
    footer,
    timestamp: parseTimestamp(raw.timestamp),
  })
}

function embedsFrom(list: unknown[]): Embed[] {
  return list.filter(looksLikeEmbed).slice(0, LIMITS.embeds).map(fromApiEmbed)
}

function messageFrom(root: unknown): Message | null {
  if (Array.isArray(root)) {
    const embeds = embedsFrom(root)
    return embeds.length > 0 ? { content: '', username: '', avatarUrl: '', embeds } : null
  }
  if (!isObject(root)) return null

  if (Array.isArray(root.messages)) {
    const first: unknown = root.messages[0]
    if (isObject(first)) return messageFrom(isObject(first.data) ? first.data : first)
    return null
  }

  const content = str(root.content)
  const username = str(root.username)
  const avatarUrl = str(root.avatar_url ?? root.avatarUrl)
  let embeds: Embed[] = []
  if (Array.isArray(root.embeds)) embeds = embedsFrom(root.embeds)
  else if (looksLikeEmbed(root.embed)) embeds = [fromApiEmbed(root.embed)]
  else if (looksLikeEmbed(root)) embeds = [fromApiEmbed(root)]

  if (!content && !username && !avatarUrl && embeds.length === 0) return null
  return { content, username, avatarUrl, embeds }
}

export function parseImport(text: string): ImportResult {
  let root: unknown
  try {
    root = JSON.parse(text)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `That is not valid JSON: ${reason}` }
  }
  const message = messageFrom(root)
  if (!message) return { ok: false, error: 'No embed found in that JSON' }
  return { ok: true, message }
}
