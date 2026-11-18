import { describe, it, expect } from 'vitest'
import { formatTimestamp, parseBlocks, parseInline } from './parse'

describe('parseInline', () => {
  it('parses basic formatting', () => {
    expect(parseInline('**b** *i* _i_ __u__ ~~s~~ ||sp|| `c`')).toEqual([
      { t: 'bold', c: [{ t: 'text', v: 'b' }] },
      { t: 'text', v: ' ' },
      { t: 'italic', c: [{ t: 'text', v: 'i' }] },
      { t: 'text', v: ' ' },
      { t: 'italic', c: [{ t: 'text', v: 'i' }] },
      { t: 'text', v: ' ' },
      { t: 'underline', c: [{ t: 'text', v: 'u' }] },
      { t: 'text', v: ' ' },
      { t: 'strike', c: [{ t: 'text', v: 's' }] },
      { t: 'text', v: ' ' },
      { t: 'spoiler', c: [{ t: 'text', v: 'sp' }] },
      { t: 'text', v: ' ' },
      { t: 'code', v: 'c' },
    ])
  })

  it('handles triple markers', () => {
    expect(parseInline('***x***')).toEqual([{ t: 'bold', c: [{ t: 'italic', c: [{ t: 'text', v: 'x' }] }] }])
    expect(parseInline('___x___')).toEqual([{ t: 'underline', c: [{ t: 'italic', c: [{ t: 'text', v: 'x' }] }] }])
  })

  it('nests formatting', () => {
    expect(parseInline('**a *b* c**')).toEqual([
      { t: 'bold', c: [{ t: 'text', v: 'a ' }, { t: 'italic', c: [{ t: 'text', v: 'b' }] }, { t: 'text', v: ' c' }] },
    ])
    expect(parseInline('*a **b** c*')).toEqual([
      { t: 'italic', c: [{ t: 'text', v: 'a ' }, { t: 'bold', c: [{ t: 'text', v: 'b' }] }, { t: 'text', v: ' c' }] },
    ])
    expect(parseInline('**bold *italic***')).toEqual([
      { t: 'bold', c: [{ t: 'text', v: 'bold ' }, { t: 'italic', c: [{ t: 'text', v: 'italic' }] }] },
    ])
    expect(parseInline('||__**x**__||')).toEqual([
      { t: 'spoiler', c: [{ t: 'underline', c: [{ t: 'bold', c: [{ t: 'text', v: 'x' }] }] }] },
    ])
  })

  it('leaves unclosed markers as text', () => {
    expect(parseInline('**open')).toEqual([{ t: 'text', v: '**open' }])
    expect(parseInline('a * b')).toEqual([{ t: 'text', v: 'a * b' }])
    expect(parseInline('~~ nope | `tick')).toEqual([{ t: 'text', v: '~~ nope | `tick' }])
    expect(parseInline('snake_case_name')).toEqual([{ t: 'text', v: 'snake_case_name' }])
    expect(parseInline('****')).toEqual([{ t: 'text', v: '****' }])
  })

  it('does not parse inside code', () => {
    expect(parseInline('`**x**`')).toEqual([{ t: 'code', v: '**x**' }])
    expect(parseInline('`` a`b ``')).toEqual([{ t: 'code', v: 'a`b' }])
    expect(parseInline('**a `**` b**')).toEqual([
      { t: 'bold', c: [{ t: 'text', v: 'a ' }, { t: 'code', v: '**' }, { t: 'text', v: ' b' }] },
    ])
  })

  it('handles escapes', () => {
    expect(parseInline('\\*not italic\\*')).toEqual([{ t: 'text', v: '*not italic*' }])
    expect(parseInline('\\a')).toEqual([{ t: 'text', v: '\\a' }])
  })

  it('parses links', () => {
    expect(parseInline('[Docs](https://example.com) and https://a.com/x.')).toEqual([
      { t: 'link', href: 'https://example.com', c: [{ t: 'text', v: 'Docs' }] },
      { t: 'text', v: ' and ' },
      { t: 'link', href: 'https://a.com/x', c: [{ t: 'text', v: 'https://a.com/x' }] },
      { t: 'text', v: '.' },
    ])
    expect(parseInline('[**b**](<https://e.com>)')).toEqual([
      { t: 'link', href: 'https://e.com', c: [{ t: 'bold', c: [{ t: 'text', v: 'b' }] }] },
    ])
    expect(parseInline('[x](javascript:alert)')).toEqual([{ t: 'text', v: '[x](javascript:alert)' }])
    expect(parseInline('(see https://en.wikipedia.org/wiki/A_(b))')).toEqual([
      { t: 'text', v: '(see ' },
      { t: 'link', href: 'https://en.wikipedia.org/wiki/A_(b)', c: [{ t: 'text', v: 'https://en.wikipedia.org/wiki/A_(b)' }] },
      { t: 'text', v: ')' },
    ])
  })

  it('parses mentions, emoji and timestamps', () => {
    expect(parseInline('<@1> <@!2> <@&3> <#4> @everyone @here')).toEqual([
      { t: 'mention', kind: 'user', id: '1' },
      { t: 'text', v: ' ' },
      { t: 'mention', kind: 'user', id: '2' },
      { t: 'text', v: ' ' },
      { t: 'mention', kind: 'role', id: '3' },
      { t: 'text', v: ' ' },
      { t: 'mention', kind: 'channel', id: '4' },
      { t: 'text', v: ' ' },
      { t: 'mention', kind: 'everyone', id: 'everyone' },
      { t: 'text', v: ' ' },
      { t: 'mention', kind: 'here', id: 'here' },
    ])
    expect(parseInline('<:wave:123><a:dance:456>')).toEqual([
      { t: 'emoji', name: 'wave', id: '123', animated: false },
      { t: 'emoji', name: 'dance', id: '456', animated: true },
    ])
    expect(parseInline('<t:1700000000> <t:1700000000:R>')).toEqual([
      { t: 'timestamp', unix: 1700000000, style: 'f' },
      { t: 'text', v: ' ' },
      { t: 'timestamp', unix: 1700000000, style: 'R' },
    ])
    expect(parseInline('<@abc>')).toEqual([{ t: 'text', v: '<@abc>' }])
  })

  it('turns newlines into breaks', () => {
    expect(parseInline('a\nb')).toEqual([{ t: 'text', v: 'a' }, { t: 'br' }, { t: 'text', v: 'b' }])
  })

  it('stays fast on pathological input', () => {
    const inputs = [
      '*a '.repeat(3000),
      '_a '.repeat(3000),
      '_'.repeat(6000),
      '**'.repeat(3000) + 'x',
      '~~a'.repeat(2000),
      '||a'.repeat(2000),
      '[a'.repeat(3000),
      '[a](b'.repeat(1000),
      '`'.repeat(6000),
      '<@'.repeat(3000),
      'http://'.repeat(800),
    ]
    const start = Date.now()
    for (const s of inputs) parseInline(s)
    for (const s of inputs) parseBlocks(s)
    expect(Date.now() - start).toBeLessThan(500)
  })
})

describe('parseBlocks', () => {
  it('returns nothing for empty input', () => {
    expect(parseBlocks('')).toEqual([])
  })

  it('joins paragraph lines with breaks', () => {
    expect(parseBlocks('one\ntwo')).toEqual([
      { t: 'p', c: [{ t: 'text', v: 'one' }, { t: 'br' }, { t: 'text', v: 'two' }] },
    ])
  })

  it('parses headings and subtext', () => {
    expect(parseBlocks('# One\n## Two\n### Three\n#### Four\n-# small')).toEqual([
      { t: 'h', level: 1, c: [{ t: 'text', v: 'One' }] },
      { t: 'h', level: 2, c: [{ t: 'text', v: 'Two' }] },
      { t: 'h', level: 3, c: [{ t: 'text', v: 'Three' }] },
      { t: 'p', c: [{ t: 'text', v: '#### Four' }] },
      { t: 'subtext', c: [{ t: 'text', v: 'small' }] },
    ])
    expect(parseBlocks('# Not a heading', { headings: false })).toEqual([
      { t: 'p', c: [{ t: 'text', v: '# Not a heading' }] },
    ])
    expect(parseBlocks('#nospace')).toEqual([{ t: 'p', c: [{ t: 'text', v: '#nospace' }] }])
  })

  it('parses quotes', () => {
    expect(parseBlocks('> a\n> b\nc')).toEqual([
      { t: 'quote', c: [{ t: 'p', c: [{ t: 'text', v: 'a' }, { t: 'br' }, { t: 'text', v: 'b' }] }] },
      { t: 'p', c: [{ t: 'text', v: 'c' }] },
    ])
    expect(parseBlocks('before\n>>> all\nof this')).toEqual([
      { t: 'p', c: [{ t: 'text', v: 'before' }] },
      { t: 'quote', c: [{ t: 'p', c: [{ t: 'text', v: 'all' }, { t: 'br' }, { t: 'text', v: 'of this' }] }] },
    ])
    expect(parseBlocks('> > x')).toEqual([{ t: 'quote', c: [{ t: 'p', c: [{ t: 'text', v: '> x' }] }] }])
  })

  it('parses nested lists', () => {
    expect(parseBlocks('- a\n  - b\n- c\n1. x\n2. y')).toEqual([
      {
        t: 'list',
        ordered: false,
        start: 1,
        items: [
          [
            { t: 'p', c: [{ t: 'text', v: 'a' }] },
            { t: 'list', ordered: false, start: 1, items: [[{ t: 'p', c: [{ t: 'text', v: 'b' }] }]] },
          ],
          [{ t: 'p', c: [{ t: 'text', v: 'c' }] }],
        ],
      },
      {
        t: 'list',
        ordered: true,
        start: 1,
        items: [[{ t: 'p', c: [{ t: 'text', v: 'x' }] }], [{ t: 'p', c: [{ t: 'text', v: 'y' }] }]],
      },
    ])
    const started = parseBlocks('3. three')[0]
    expect(started && started.t === 'list' && started.start).toBe(3)
    expect(parseBlocks('*not a list*')).toEqual([{ t: 'p', c: [{ t: 'italic', c: [{ t: 'text', v: 'not a list' }] }] }])
  })

  it('parses code blocks', () => {
    expect(parseBlocks('```js\nconst a = 1\n```\nafter')).toEqual([
      { t: 'codeblock', lang: 'js', v: 'const a = 1' },
      { t: 'p', c: [{ t: 'text', v: 'after' }] },
    ])
    expect(parseBlocks('```\n**raw**\n# not heading\n```')).toEqual([
      { t: 'codeblock', lang: '', v: '**raw**\n# not heading' },
    ])
    expect(parseBlocks('```one liner```')).toEqual([{ t: 'codeblock', lang: '', v: 'one liner' }])
    expect(parseBlocks('```unclosed\ntext')).toEqual([
      { t: 'p', c: [{ t: 'text', v: '```unclosed' }, { t: 'br' }, { t: 'text', v: 'text' }] },
    ])
  })

  it('parses blocks inside quotes', () => {
    expect(parseBlocks('> # Title\n> - item')).toEqual([
      {
        t: 'quote',
        c: [
          { t: 'h', level: 1, c: [{ t: 'text', v: 'Title' }] },
          { t: 'list', ordered: false, start: 1, items: [[{ t: 'p', c: [{ t: 'text', v: 'item' }] }]] },
        ],
      },
    ])
  })
})

describe('formatTimestamp', () => {
  const unix = 1700000000

  it('formats each style', () => {
    expect(formatTimestamp(unix, 't')).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/)
    expect(formatTimestamp(unix, 'T')).toMatch(/^\d{1,2}:\d{2}:\d{2} (AM|PM)$/)
    expect(formatTimestamp(unix, 'd')).toMatch(/^\d{2}\/\d{2}\/2023$/)
    expect(formatTimestamp(unix, 'D')).toMatch(/^November 1[45], 2023$/)
    expect(formatTimestamp(unix, 'f')).toMatch(/^November 1[45], 2023 \d{1,2}:\d{2} (AM|PM)$/)
    expect(formatTimestamp(unix, 'F')).toMatch(/^(Tuesday|Wednesday), November 1[45], 2023 \d{1,2}:\d{2} (AM|PM)$/)
    expect(formatTimestamp(unix, 'x')).toBe(formatTimestamp(unix, 'f'))
  })

  it('formats relative times', () => {
    const now = new Date(unix * 1000)
    expect(formatTimestamp(unix + 3 * 3600, 'R', now)).toBe('in 3 hours')
    expect(formatTimestamp(unix - 2 * 86400, 'R', now)).toBe('2 days ago')
    expect(formatTimestamp(unix + 10, 'R', now)).toBe('in a few seconds')
    expect(formatTimestamp(unix - 60, 'R', now)).toBe('a minute ago')
    expect(formatTimestamp(unix - 5 * 365 * 86400, 'R', now)).toBe('5 years ago')
  })
})
