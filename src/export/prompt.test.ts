import { describe, it, expect } from 'vitest'
import { createEmbed, createField, createMessage } from '../model/embed'
import { buildPrompt } from './prompt'
import { toWebhookJson } from './json'

const message = createMessage({
  content: 'Patch notes are out',
  username: 'Changelog',
  embeds: [
    createEmbed({
      color: 0x57f287,
      author: { name: 'Dev Team', url: 'https://example.com', iconUrl: 'https://example.com/i.png' },
      title: 'Version 2',
      url: 'https://example.com/v2',
      description: 'Big **changes**\nand fixes',
      fields: [createField({ name: 'Added', value: 'Dark mode', inline: true }), createField({ name: 'Removed', value: 'Nothing' })],
      image: 'https://example.com/banner.png',
      footer: { text: 'Thanks', iconUrl: '' },
      timestamp: '2024-05-01T12:00:00.000Z',
    }),
  ],
})

describe('buildPrompt', () => {
  it('json only mode is one sentence and the JSON', () => {
    const out = buildPrompt(message, { target: 'webhook', jsonOnly: true })
    expect(out).toBe(`Send this exact Discord message using a raw webhook POST request (JSON body):\n\n\`\`\`json\n${toWebhookJson(message)}\n\`\`\`\n`)
  })

  it('describes every part of the embed', () => {
    const out = buildPrompt(message, { target: 'discord.js', jsonOnly: false })
    expect(out.startsWith('Build this exact Discord message for discord.js v14, using EmbedBuilder.')).toBe(true)
    expect(out).toContain('Message text above the embeds: "Patch notes are out"')
    expect(out).toContain('Webhook username: "Changelog"')
    expect(out).toContain('1. Color: #57F287 (decimal 5763719)')
    expect(out).toContain('2. Author: "Dev Team", linking to https://example.com, with the icon https://example.com/i.png')
    expect(out).toContain('3. Title: "Version 2", linking to https://example.com/v2')
    expect(out).toContain('4. Description (Discord markdown, keep the formatting characters as they are), exactly:\n    Big **changes**\n    and fixes')
    expect(out).toContain('  1. "Added" (inline): "Dark mode"')
    expect(out).toContain('  2. "Removed" (own line): "Nothing"')
    expect(out).toContain('Large image: https://example.com/banner.png')
    expect(out).toContain('Footer: "Thanks"')
    expect(out).toContain('Timestamp: 2024-05-01T12:00:00.000Z')
    expect(out).toContain('Rules:')
    expect(out).toContain('```json\n' + toWebhookJson(message) + '\n```')
    expect(out).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
  })

  it('names each target', () => {
    expect(buildPrompt(message, { target: 'discord.py', jsonOnly: false })).toContain('discord.py 2.x, using discord.Embed')
    expect(buildPrompt(message, { target: 'any', jsonOnly: false })).toContain('whatever library I am using')
  })

  it('numbers multiple embeds and is deterministic', () => {
    const m = createMessage({ embeds: [createEmbed({ title: 'A' }), createEmbed({ title: 'B' })] })
    const out = buildPrompt(m, { target: 'any', jsonOnly: false })
    expect(out).toContain('Embed 1 of 2:')
    expect(out).toContain('Embed 2 of 2:')
    expect(out).not.toContain('(Discord markdown')
    expect(buildPrompt(m, { target: 'any', jsonOnly: false })).toBe(out)
  })
})
