import { create } from 'zustand'
import {
  createEmbed,
  createField,
  createMessage,
  LIMITS,
  uid,
  type Embed,
  type EmbedField,
  type Message,
} from './embed'
import { starterMessage } from './templates'

export type Part =
  | 'author'
  | 'title'
  | 'description'
  | 'fields'
  | 'field'
  | 'image'
  | 'thumbnail'
  | 'footer'
  | 'timestamp'
  | 'color'
  | 'content'
  | 'sender'
  | 'embed'

export interface Selection {
  embedId: string | null
  part: Part
  fieldId?: string
  sub?: 'name' | 'value'
}

export function sameSelection(a: Selection | null, b: Selection): boolean {
  return !!a && a.embedId === b.embedId && a.part === b.part && a.fieldId === b.fieldId
}

export type BlockKind =
  | 'author'
  | 'title'
  | 'description'
  | 'field'
  | 'inline-field'
  | 'image'
  | 'thumbnail'
  | 'footer'
  | 'timestamp'
  | 'embed'

interface History {
  past: Message[]
  future: Message[]
  lastKey: string | null
  lastAt: number
}

interface State {
  message: Message
  selection: Selection | null
  editing: boolean
  history: History
  set: (fn: (m: Message) => Message, key?: string) => void
  replace: (m: Message) => void
  updateEmbed: (embedId: string, patch: Partial<Embed>, key?: string) => void
  updateField: (embedId: string, fieldId: string, patch: Partial<EmbedField>, key?: string) => void
  addBlock: (embedId: string | null, kind: BlockKind, beforeFieldId?: string) => void
  removePart: (sel: Selection) => void
  moveField: (embedId: string, fromId: string, toId: string) => void
  moveEmbed: (fromId: string, toId: string) => void
  duplicateEmbed: (embedId: string) => void
  duplicateField: (embedId: string, fieldId: string) => void
  select: (sel: Selection | null, editing?: boolean) => void
  setEditing: (editing: boolean) => void
  undo: () => void
  redo: () => void
}

const STORAGE_KEY = 'embed-editor:message'
const COALESCE_MS = 700
const HISTORY_LIMIT = 200

function loadInitial(): Message {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Message
      if (parsed && Array.isArray(parsed.embeds)) return parsed
    }
  } catch {
    /* storage unavailable */
  }
  return starterMessage()
}

function mapEmbed(m: Message, id: string, fn: (e: Embed) => Embed): Message {
  return { ...m, embeds: m.embeds.map((e) => (e.id === id ? fn(e) : e)) }
}

function move<T extends { id: string }>(list: T[], fromId: string, toId: string): T[] {
  const from = list.findIndex((x) => x.id === fromId)
  const to = list.findIndex((x) => x.id === toId)
  if (from < 0 || to < 0 || from === to) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item as T)
  return next
}

export const useEditor = create<State>((set, get) => ({
  message: loadInitial(),
  selection: null,
  editing: false,
  history: { past: [], future: [], lastKey: null, lastAt: 0 },

  set: (fn, key) => {
    const { message, history } = get()
    const next = fn(message)
    if (next === message) return
    const now = Date.now()
    const coalesce = key != null && key === history.lastKey && now - history.lastAt < COALESCE_MS
    const past = coalesce ? history.past : [...history.past, message].slice(-HISTORY_LIMIT)
    set({ message: next, history: { past, future: [], lastKey: key ?? null, lastAt: now } })
  },

  replace: (m) => {
    get().set(() => m)
    set({ selection: null, editing: false })
  },

  updateEmbed: (embedId, patch, key) =>
    get().set((m) => mapEmbed(m, embedId, (e) => ({ ...e, ...patch })), key),

  updateField: (embedId, fieldId, patch, key) =>
    get().set(
      (m) =>
        mapEmbed(m, embedId, (e) => ({
          ...e,
          fields: e.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
        })),
      key,
    ),

  addBlock: (embedId, kind, beforeFieldId) => {
    const { message } = get()
    if (kind === 'embed') {
      if (message.embeds.length >= LIMITS.embeds) return
      const embed = createEmbed({ description: 'New embed' })
      const index = embedId ? message.embeds.findIndex((e) => e.id === embedId) + 1 : message.embeds.length
      get().set((m) => {
        const embeds = m.embeds.slice()
        embeds.splice(index, 0, embed)
        return { ...m, embeds }
      })
      set({ selection: { embedId: embed.id, part: 'description' }, editing: false })
      return
    }
    const target = message.embeds.find((e) => e.id === embedId) ?? message.embeds[0]
    if (!target) {
      const embed = createEmbed()
      get().set((m) => ({ ...m, embeds: [embed] }))
      get().addBlock(embed.id, kind)
      return
    }
    const id = target.id
    let selection: Selection = { embedId: id, part: 'embed' }
    get().set((m) =>
      mapEmbed(m, id, (e) => {
        switch (kind) {
          case 'author':
            selection = { embedId: id, part: 'author' }
            return e.author ? e : { ...e, author: { name: 'Author name', url: '', iconUrl: '' } }
          case 'title':
            selection = { embedId: id, part: 'title' }
            return e.title ? e : { ...e, title: 'Embed title' }
          case 'description':
            selection = { embedId: id, part: 'description' }
            return e.description ? e : { ...e, description: 'Write something here. **Markdown** works.' }
          case 'field':
          case 'inline-field': {
            if (e.fields.length >= LIMITS.fields) return e
            const field = createField({ inline: kind === 'inline-field' })
            selection = { embedId: id, part: 'field', fieldId: field.id }
            const fields = e.fields.slice()
            const at = beforeFieldId ? fields.findIndex((f) => f.id === beforeFieldId) : -1
            fields.splice(at < 0 ? fields.length : at, 0, field)
            return { ...e, fields }
          }
          case 'image':
            selection = { embedId: id, part: 'image' }
            return e
          case 'thumbnail':
            selection = { embedId: id, part: 'thumbnail' }
            return e
          case 'footer':
            selection = { embedId: id, part: 'footer' }
            return e.footer ? e : { ...e, footer: { text: 'Footer text', iconUrl: '' } }
          case 'timestamp':
            selection = { embedId: id, part: 'timestamp' }
            return e.timestamp ? e : { ...e, timestamp: new Date().toISOString() }
        }
      }),
    )
    if (kind === 'image' || kind === 'thumbnail') {
      const e = get().message.embeds.find((x) => x.id === id)
      if (e && !e[kind]) {
        const ph = kind === 'image' ? PLACEHOLDER_IMAGE : PLACEHOLDER_THUMB
        get().updateEmbed(id, { [kind]: ph })
      }
    }
    set({ selection, editing: false })
  },

  removePart: (sel) => {
    const { embedId, part, fieldId } = sel
    if (!embedId) {
      if (part === 'content') get().set((m) => ({ ...m, content: '' }))
      if (part === 'sender') get().set((m) => ({ ...m, username: '', avatarUrl: '' }))
      set({ selection: null, editing: false })
      return
    }
    get().set((m) => {
      if (part === 'embed') return { ...m, embeds: m.embeds.filter((e) => e.id !== embedId) }
      return mapEmbed(m, embedId, (e) => {
        switch (part) {
          case 'author':
            return { ...e, author: null }
          case 'title':
            return { ...e, title: '', url: '' }
          case 'description':
            return { ...e, description: '' }
          case 'field':
            return { ...e, fields: e.fields.filter((f) => f.id !== fieldId) }
          case 'fields':
            return { ...e, fields: [] }
          case 'image':
            return { ...e, image: '' }
          case 'thumbnail':
            return { ...e, thumbnail: '' }
          case 'footer':
            return { ...e, footer: null }
          case 'timestamp':
            return { ...e, timestamp: null }
          case 'color':
            return { ...e, color: null }
          default:
            return e
        }
      })
    })
    set({ selection: part === 'embed' ? null : { embedId, part: 'embed' }, editing: false })
  },

  moveField: (embedId, fromId, toId) =>
    get().set((m) => mapEmbed(m, embedId, (e) => ({ ...e, fields: move(e.fields, fromId, toId) }))),

  moveEmbed: (fromId, toId) => get().set((m) => ({ ...m, embeds: move(m.embeds, fromId, toId) })),

  duplicateEmbed: (embedId) => {
    const { message } = get()
    if (message.embeds.length >= LIMITS.embeds) return
    const src = message.embeds.find((e) => e.id === embedId)
    if (!src) return
    const copy: Embed = {
      ...structuredClone(src),
      id: uid(),
      fields: src.fields.map((f) => createField({ name: f.name, value: f.value, inline: f.inline })),
    }
    get().set((m) => {
      const embeds = m.embeds.slice()
      embeds.splice(embeds.findIndex((e) => e.id === embedId) + 1, 0, copy)
      return { ...m, embeds }
    })
    set({ selection: { embedId: copy.id, part: 'embed' } })
  },

  duplicateField: (embedId, fieldId) => {
    const e = get().message.embeds.find((x) => x.id === embedId)
    const f = e?.fields.find((x) => x.id === fieldId)
    if (!e || !f || e.fields.length >= LIMITS.fields) return
    const copy = createField({ name: f.name, value: f.value, inline: f.inline })
    get().set((m) =>
      mapEmbed(m, embedId, (x) => {
        const fields = x.fields.slice()
        fields.splice(fields.findIndex((y) => y.id === fieldId) + 1, 0, copy)
        return { ...x, fields }
      }),
    )
    set({ selection: { embedId, part: 'field', fieldId: copy.id } })
  },

  select: (selection, editing = false) => set({ selection, editing }),
  setEditing: (editing) => set({ editing }),

  undo: () => {
    const { history, message } = get()
    const prev = history.past[history.past.length - 1]
    if (!prev) return
    set({
      message: prev,
      editing: false,
      history: { past: history.past.slice(0, -1), future: [message, ...history.future], lastKey: null, lastAt: 0 },
    })
  },

  redo: () => {
    const { history, message } = get()
    const next = history.future[0]
    if (!next) return
    set({
      message: next,
      editing: false,
      history: { past: [...history.past, message], future: history.future.slice(1), lastKey: null, lastAt: 0 },
    })
  },
}))

export const PLACEHOLDER_IMAGE = 'https://placeholder.invalid/image'
export const PLACEHOLDER_THUMB = 'https://placeholder.invalid/thumbnail'

export function isPlaceholder(url: string): boolean {
  return url === PLACEHOLDER_IMAGE || url === PLACEHOLDER_THUMB
}

export function forExport(m: Message): Message {
  return {
    ...m,
    embeds: m.embeds.map((e) => ({
      ...e,
      image: isPlaceholder(e.image) ? '' : e.image,
      thumbnail: isPlaceholder(e.thumbnail) ? '' : e.thumbnail,
    })),
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
useEditor.subscribe((state, prev) => {
  if (state.message === prev.message) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.message))
    } catch {
      /* storage unavailable */
    }
  }, 250)
})

export function resetMessage(): void {
  useEditor.getState().replace(createMessage())
}
