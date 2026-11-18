import { describe, it, expect } from 'vitest'
import { createEmbed, createField, createMessage } from '../model/embed'
import { decodeShare, encodeShare, shareUrl } from './share'

const message = createMessage({
  content: 'Hi there',
  embeds: [
    createEmbed({
      title: 'Shared',
      color: 0xed4245,
      description: 'Line one\nLine two',
      fields: [createField({ name: 'A', value: 'B', inline: true })],
    }),
  ],
})

describe('share', () => {
  it('round trips through the url hash', () => {
    const url = shareUrl(message, 'https://editor.example')
    expect(url.startsWith('https://editor.example#m=')).toBe(true)
    const decoded = decodeShare(url.slice(url.indexOf('#')))
    expect(decoded).not.toBeNull()
    expect(decoded!.content).toBe('Hi there')
    expect(decoded!.embeds[0]!.title).toBe('Shared')
    expect(decoded!.embeds[0]!.color).toBe(0xed4245)
    expect(decoded!.embeds[0]!.fields[0]!.inline).toBe(true)
  })

  it('accepts the code without a prefix', () => {
    expect(decodeShare(encodeShare(message))!.embeds[0]!.description).toBe('Line one\nLine two')
  })

  it('is url safe', () => {
    expect(encodeShare(message)).toMatch(/^[A-Za-z0-9+\-$]*$/)
  })

  it('returns null for garbage', () => {
    expect(decodeShare('')).toBeNull()
    expect(decodeShare('#m=')).toBeNull()
    expect(decodeShare('#m=%%%not-valid')).toBeNull()
  })
})
