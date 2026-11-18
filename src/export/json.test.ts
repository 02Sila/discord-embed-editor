import { describe, it, expect } from 'vitest'
import { createEmbed, createField, createMessage, type Message } from '../model/embed'
import { parseImport, toApiEmbed, toEmbedsJson, toWebhookJson, toWebhookPayload } from './json'

function fullMessage(): Message {
  return createMessage({
    content: 'Hello <@123>',
    username: 'Release Bot',
    avatarUrl: 'https://example.com/avatar.png',
    embeds: [
      createEmbed({
        color: 0x5865f2,
        author: { name: 'Author', url: 'https://example.com/a', iconUrl: 'https://example.com/a.png' },
        title: 'Title',
        url: 'https://example.com',
        description: 'Some **bold** text',
        fields: [
          createField({ name: 'One', value: '1', inline: true }),
          createField({ name: 'Two', value: '2', inline: false }),
        ],
        thumbnail: 'https://example.com/t.png',
        image: 'https://example.com/i.png',
        footer: { text: 'Footer', iconUrl: 'https://example.com/f.png' },
        timestamp: '2024-05-01T12:00:00.000Z',
      }),
    ],
  })
}

function strip(m: Message) {
  return {
    ...m,
    embeds: m.embeds.map((e) => ({ ...e, id: '', fields: e.fields.map((f) => ({ ...f, id: '' })) })),
  }
}

describe('toApiEmbed', () => {
  it('emits snake_case keys in Discord order', () => {
    const out = toApiEmbed(fullMessage().embeds[0]!)
    expect(Object.keys(out)).toEqual([
      'author',
      'title',
      'url',
      'description',
      'color',
      'fields',
      'thumbnail',
      'image',
      'footer',
      'timestamp',
    ])
    expect(out.author).toEqual({ name: 'Author', url: 'https://example.com/a', icon_url: 'https://example.com/a.png' })
    expect(out.footer).toEqual({ text: 'Footer', icon_url: 'https://example.com/f.png' })
    expect(out.fields).toEqual([
      { name: 'One', value: '1', inline: true },
      { name: 'Two', value: '2' },
    ])
  })

  it('omits empty and unset parts', () => {
    const out = toApiEmbed(
      createEmbed({
        description: 'Only this',
        url: 'https://example.com',
        author: { name: '', url: 'https://example.com', iconUrl: '' },
        footer: { text: '', iconUrl: 'https://example.com/f.png' },
        timestamp: 'not a date',
      }),
    )
    expect(out).toEqual({ description: 'Only this' })
  })

  it('keeps color 0', () => {
    expect(toApiEmbed(createEmbed({ title: 'x', color: 0 })).color).toBe(0)
  })
})

describe('message exports', () => {
  it('skips empty embeds', () => {
    const m = createMessage({ embeds: [createEmbed(), createEmbed({ title: 'Kept' })] })
    expect(JSON.parse(toEmbedsJson(m))).toEqual({ embeds: [{ title: 'Kept' }] })
  })

  it('builds a webhook payload with only set keys', () => {
    expect(toWebhookPayload(createMessage({ content: 'hi' }))).toEqual({ content: 'hi', embeds: [] })
    const payload = toWebhookPayload(fullMessage())
    expect(Object.keys(payload)).toEqual(['content', 'username', 'avatar_url', 'embeds'])
  })
})

describe('parseImport', () => {
  it('round trips a full message', () => {
    const m = fullMessage()
    const result = parseImport(toWebhookJson(m))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(strip(result.message)).toEqual(strip(m))
    expect(result.message.embeds[0]!.id).not.toBe('')
  })

  it('accepts a bare array, a single embed and an embed key', () => {
    const a = parseImport('[{"title":"A"},{"title":"B"}]')
    expect(a.ok && a.message.embeds.map((e) => e.title)).toEqual(['A', 'B'])
    const b = parseImport('{"title":"Solo","color":"#ff0000"}')
    expect(b.ok && b.message.embeds[0]!.color).toBe(0xff0000)
    const c = parseImport('{"embed":{"description":"Inside"}}')
    expect(c.ok && c.message.embeds[0]!.description).toBe('Inside')
  })

  it('accepts discohook style messages', () => {
    const r = parseImport(
      JSON.stringify({ messages: [{ data: { content: 'First', embeds: [{ title: 'T' }] } }, { data: { content: 'Second' } }] }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.message.content).toBe('First')
    expect(r.message.embeds[0]!.title).toBe('T')
  })

  it('coerces colors, media strings and ignores unknown keys', () => {
    const r = parseImport(
      JSON.stringify({ embeds: [{ title: 'x', color: '0x00ff00', image: 'https://e.com/i.png', bogus: 1 }] }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.message.embeds[0]!.color).toBe(0x00ff00)
    expect(r.message.embeds[0]!.image).toBe('https://e.com/i.png')
    expect('bogus' in r.message.embeds[0]!).toBe(false)
  })

  it('clamps to 10 embeds', () => {
    const embeds = Array.from({ length: 14 }, (_, i) => ({ title: `E${i}` }))
    const r = parseImport(JSON.stringify({ embeds }))
    expect(r.ok && r.message.embeds.length).toBe(10)
  })

  it('reports invalid JSON and unrecognised shapes', () => {
    const bad = parseImport('{nope')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toMatch(/^That is not valid JSON: /)
    const empty = parseImport('{"hello":"world"}')
    expect(empty).toEqual({ ok: false, error: 'No embed found in that JSON' })
    expect(parseImport('42')).toEqual({ ok: false, error: 'No embed found in that JSON' })
  })
})
