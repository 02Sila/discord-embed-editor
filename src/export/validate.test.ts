import { describe, it, expect } from 'vitest'
import { createEmbed, createField, createMessage, LIMITS } from '../model/embed'
import { validate } from './validate'

describe('validate', () => {
  it('accepts a normal message', () => {
    const m = createMessage({ embeds: [createEmbed({ title: 'Hi', url: 'https://example.com' })] })
    expect(validate(m)).toEqual([])
  })

  it('flags an empty message', () => {
    const issues = validate(createMessage())
    expect(issues).toHaveLength(1)
    expect(issues[0]!.path).toBe('content')
  })

  it('reports how far over a limit the title is', () => {
    const m = createMessage({ embeds: [createEmbed({ title: 'x'.repeat(LIMITS.title + 12) })] })
    expect(validate(m)).toContainEqual({
      embedIndex: 0,
      path: 'embeds[0].title',
      message: 'Title is 12 characters over the 256 limit',
    })
  })

  it('checks content, username, description, footer and author lengths', () => {
    const m = createMessage({
      content: 'c'.repeat(LIMITS.content + 1),
      username: 'u'.repeat(LIMITS.username + 1),
      embeds: [
        createEmbed({
          description: 'd'.repeat(LIMITS.description + 1),
          footer: { text: 'f'.repeat(LIMITS.footer + 1), iconUrl: '' },
          author: { name: 'a'.repeat(LIMITS.author + 1), url: '', iconUrl: '' },
        }),
      ],
    })
    const paths = validate(m).map((i) => i.path)
    expect(paths).toEqual(
      expect.arrayContaining(['content', 'username', 'embeds[0].description', 'embeds[0].footer.text', 'embeds[0].author.name']),
    )
    expect(validate(m).find((i) => i.path === 'content')!.message).toBe('Message content is 1 character over the 2000 limit')
  })

  it('checks fields', () => {
    const fields = Array.from({ length: 26 }, () => createField({ name: 'n', value: 'v' }))
    fields[0] = createField({ name: '', value: '  ' })
    fields[1] = createField({ name: 'n'.repeat(257), value: 'v'.repeat(1025) })
    const issues = validate(createMessage({ embeds: [createEmbed({ fields })] }))
    const messages = issues.map((i) => i.message)
    expect(messages).toContain('There are 26 fields, Discord allows 25')
    expect(messages).toContain('Field 1 needs a name')
    expect(messages).toContain('Field 1 needs a value')
    expect(messages).toContain('Field 2 name is 1 character over the 256 limit')
    expect(messages).toContain('Field 2 value is 1 character over the 1024 limit')
  })

  it('checks the total across embeds and the embed count', () => {
    const embeds = Array.from({ length: 11 }, () => createEmbed({ description: 'x'.repeat(600) }))
    const issues = validate(createMessage({ embeds }))
    const messages = issues.map((i) => i.message)
    expect(messages).toContain('There are 11 embeds, Discord allows 10')
    expect(messages).toContain('All embeds together are 600 characters over the 6000 limit')
  })

  it('checks urls', () => {
    const m = createMessage({
      avatarUrl: 'ftp://x',
      embeds: [
        createEmbed({
          title: 'T',
          url: 'example.com',
          image: 'attachment://file.png',
          thumbnail: 'not a url',
          author: { name: 'A', url: 'javascript:alert(1)', iconUrl: 'https://ok.com/i.png' },
          footer: { text: 'F', iconUrl: 'nope' },
        }),
      ],
    })
    const paths = validate(m).map((i) => i.path)
    expect(paths.sort()).toEqual(
      ['avatarUrl', 'embeds[0].author.url', 'embeds[0].footer.iconUrl', 'embeds[0].thumbnail', 'embeds[0].url'].sort(),
    )
  })
})
