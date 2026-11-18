export type Inline =
  | { t: 'text'; v: string }
  | { t: 'bold' | 'italic' | 'underline' | 'strike' | 'spoiler'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; c: Inline[] }
  | { t: 'mention'; kind: 'user' | 'role' | 'channel' | 'everyone' | 'here'; id: string }
  | { t: 'emoji'; name: string; id: string; animated: boolean }
  | { t: 'timestamp'; unix: number; style: string }
  | { t: 'br' }

export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'h'; level: 1 | 2 | 3; c: Inline[] }
  | { t: 'subtext'; c: Inline[] }
  | { t: 'quote'; c: Block[] }
  | { t: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { t: 'codeblock'; lang: string; v: string }

type Wrap = 'bold' | 'italic' | 'underline' | 'strike' | 'spoiler'
type CloseMode = 'plain' | 'double' | 'star' | 'under'

const MAX_DEPTH = 16
const SPECIAL = new Set(['\\', '\n', '*', '_', '~', '|', '`', '[', '<', '@', 'h'])
const WORD_RE = /[A-Za-z0-9_]/
const ALNUM_RE = /[A-Za-z0-9]/
const ESCAPABLE_RE = /[^0-9A-Za-z\s]/
const URL_RE = /^https?:\/\/[^\s<]+$/i

const USER_RE = /<@!?(\d+)>/y
const ROLE_RE = /<@&(\d+)>/y
const CHANNEL_RE = /<#(\d+)>/y
const EMOJI_RE = /<(a?):(\w{1,32}):(\d+)>/y
const TIME_RE = /<t:(-?\d{1,13})(?::([tTdDfFR]))?>/y
const AUTOLINK_RE = /<(https?:\/\/[^\s>]+)>/y

function isSpace(ch: string): boolean {
  return ch === '' || /\s/.test(ch)
}

function runLength(s: string, i: number, ch: string): number {
  let n = 0
  while (s.charAt(i + n) === ch) n++
  return n
}

function findClose(s: string, from: number, delim: string, mode: CloseMode): number {
  const ch = delim.charAt(0)
  let j = from
  while (j < s.length) {
    const c = s.charAt(j)
    if (c === '\\') {
      j += 2
      continue
    }
    if (c === '`' && ch !== '`') {
      const n = runLength(s, j, '`')
      const end = s.indexOf('`'.repeat(n), j + n)
      j = end === -1 ? j + n : end + n
      continue
    }
    if (c === ch && s.startsWith(delim, j)) {
      const r = runLength(s, j, ch)
      if (mode === 'plain') return j
      if (mode === 'double') return j + r - 2
      if (mode === 'star') {
        const prevOk = !isSpace(s.charAt(j - 1))
        if (r === 1 && prevOk) return j
        if (r >= 3 && prevOk) return j + r - 1
      } else {
        const nextOk = !WORD_RE.test(s.charAt(j + r))
        if (r === 1 && nextOk) return j
        if (r >= 3 && nextOk) return j + r - 1
      }
      j += r
      continue
    }
    j++
  }
  return -1
}

function pushText(out: Inline[], v: string): void {
  const last = out[out.length - 1]
  if (last && last.t === 'text') last.v += v
  else out.push({ t: 'text', v })
}

function wrap(kind: Wrap, c: Inline[]): Inline {
  return { t: kind, c }
}

function plainSeq(s: string): Inline[] {
  const out: Inline[] = []
  s.split('\n').forEach((part, i) => {
    if (i > 0) out.push({ t: 'br' })
    if (part) out.push({ t: 'text', v: part })
  })
  return out
}

function trimUrl(url: string): string {
  let end = url.length
  while (end > 0) {
    const c = url.charAt(end - 1)
    if ('.,:;!?\'"'.includes(c)) {
      end--
    } else if (c === ')') {
      const body = url.slice(0, end)
      const opens = body.split('(').length - 1
      const closes = body.split(')').length - 1
      if (closes > opens) end--
      else break
    } else {
      break
    }
  }
  return url.slice(0, end)
}

function parseSeq(s: string, depth: number): Inline[] {
  if (depth > MAX_DEPTH) return plainSeq(s)
  const out: Inline[] = []
  const missing = new Set<string>()
  let buf = ''
  let i = 0

  const flush = () => {
    if (buf) pushText(out, buf)
    buf = ''
  }
  const close = (from: number, delim: string, mode: CloseMode): number => {
    const key = delim + mode
    if (missing.has(key)) return -1
    const at = findClose(s, from, delim, mode)
    if (at === -1) missing.add(key)
    return at
  }
  const tryWrap = (open: number, delim: string, mode: CloseMode, build: (c: Inline[]) => Inline): boolean => {
    const start = i + open
    const end = close(start, delim, mode)
    if (end <= start) return false
    const inner = s.slice(start, end)
    if (inner.split(delim.charAt(0)).join('') === '') return false
    flush()
    out.push(build(parseSeq(inner, depth + 1)))
    i = end + delim.length
    return true
  }
  const sticky = (re: RegExp): RegExpExecArray | null => {
    re.lastIndex = i
    return re.exec(s)
  }

  while (i < s.length) {
    const ch = s.charAt(i)
    if (!SPECIAL.has(ch)) {
      buf += ch
      i++
      continue
    }

    if (ch === '\\') {
      const next = s.charAt(i + 1)
      if (next && ESCAPABLE_RE.test(next)) {
        buf += next
        i += 2
      } else {
        buf += ch
        i++
      }
      continue
    }

    if (ch === '\n') {
      flush()
      out.push({ t: 'br' })
      i++
      continue
    }

    if (ch === '`') {
      const n = runLength(s, i, '`')
      const end = s.indexOf('`'.repeat(n), i + n)
      const raw = end === -1 ? '' : s.slice(i + n, end)
      if (end !== -1 && raw.trim()) {
        let v = raw
        if (n === 2 && v.startsWith(' ') && v.endsWith(' ') && v.length > 2) v = v.slice(1, -1)
        if (n >= 3) v = v.replace(/^\n/, '').replace(/\n$/, '')
        flush()
        out.push({ t: 'code', v })
        i = end + n
      } else {
        buf += '`'.repeat(n)
        i += n
      }
      continue
    }

    if (ch === '*') {
      const r = runLength(s, i, '*')
      if (r >= 3 && tryWrap(3, '***', 'plain', (c) => wrap('bold', [wrap('italic', c)]))) continue
      if (r >= 2 && tryWrap(2, '**', 'double', (c) => wrap('bold', c))) continue
      if (!isSpace(s.charAt(i + 1)) && tryWrap(1, '*', 'star', (c) => wrap('italic', c))) continue
      const skip = Math.max(1, r - 3)
      buf += ch.repeat(skip)
      i += skip
      continue
    }

    if (ch === '_') {
      const r = runLength(s, i, '_')
      if (r >= 3 && tryWrap(3, '___', 'plain', (c) => wrap('underline', [wrap('italic', c)]))) continue
      if (r >= 2 && tryWrap(2, '__', 'double', (c) => wrap('underline', c))) continue
      if (!WORD_RE.test(s.charAt(i - 1)) && tryWrap(1, '_', 'under', (c) => wrap('italic', c))) continue
      const skip = Math.max(1, r - 3)
      buf += ch.repeat(skip)
      i += skip
      continue
    }

    if (ch === '~' && s.startsWith('~~', i)) {
      if (tryWrap(2, '~~', 'plain', (c) => wrap('strike', c))) continue
      buf += '~~'
      i += 2
      continue
    }

    if (ch === '|' && s.startsWith('||', i)) {
      if (tryWrap(2, '||', 'plain', (c) => wrap('spoiler', c))) continue
      buf += '||'
      i += 2
      continue
    }

    if (ch === '[') {
      const link = maskedLink(s, i, depth)
      if (link) {
        flush()
        out.push(link.node)
        i = link.end
        continue
      }
    }

    if (ch === 'h' && !ALNUM_RE.test(s.charAt(i - 1)) && (s.startsWith('https://', i) || s.startsWith('http://', i))) {
      let j = i
      while (j < s.length && !isSpace(s.charAt(j)) && s.charAt(j) !== '<') j++
      const url = trimUrl(s.slice(i, j))
      if (URL_RE.test(url) && !/^https?:\/\/$/i.test(url)) {
        flush()
        out.push({ t: 'link', href: url, c: [{ t: 'text', v: url }] })
        i += url.length
        continue
      }
    }

    if (ch === '<') {
      let m: RegExpExecArray | null
      let node: Inline | null = null
      if ((m = sticky(USER_RE))) node = { t: 'mention', kind: 'user', id: m[1] ?? '' }
      else if ((m = sticky(ROLE_RE))) node = { t: 'mention', kind: 'role', id: m[1] ?? '' }
      else if ((m = sticky(CHANNEL_RE))) node = { t: 'mention', kind: 'channel', id: m[1] ?? '' }
      else if ((m = sticky(EMOJI_RE))) node = { t: 'emoji', name: m[2] ?? '', id: m[3] ?? '', animated: m[1] === 'a' }
      else if ((m = sticky(TIME_RE))) node = { t: 'timestamp', unix: Number(m[1]), style: m[2] ?? 'f' }
      else if ((m = sticky(AUTOLINK_RE))) {
        const href = m[1] ?? ''
        node = { t: 'link', href, c: [{ t: 'text', v: href }] }
      }
      if (m && node) {
        flush()
        out.push(node)
        i += m[0].length
        continue
      }
    }

    if (ch === '@') {
      const kind = s.startsWith('@everyone', i) ? 'everyone' : s.startsWith('@here', i) ? 'here' : null
      if (kind) {
        flush()
        out.push({ t: 'mention', kind, id: kind })
        i += kind.length + 1
        continue
      }
    }

    buf += ch
    i++
  }
  flush()
  return out
}

function maskedLink(s: string, i: number, depth: number): { node: Inline; end: number } | null {
  let j = i + 1
  while (j < s.length) {
    const c = s.charAt(j)
    if (c === '\\') {
      j += 2
      continue
    }
    if (c === '[' || c === '\n') return null
    if (c === ']') break
    j++
  }
  if (j >= s.length || s.charAt(j + 1) !== '(') return null
  const text = s.slice(i + 1, j)
  const close = s.indexOf(')', j + 2)
  if (close === -1 || !text.trim()) return null
  let href = s.slice(j + 2, close).trim()
  if (href.startsWith('<') && href.endsWith('>')) href = href.slice(1, -1)
  if (!URL_RE.test(href)) return null
  return { node: { t: 'link', href, c: parseSeq(text, depth + 1) }, end: close + 1 }
}

export function parseInline(src: string): Inline[] {
  return parseSeq(src.replace(/\r\n?/g, '\n'), 0)
}

interface ListEntry {
  indent: number
  ordered: boolean
  num: number
  text: string
}

const LIST_RE = /^( *)([-*]|\d{1,9}\.) +(\S.*)$/
const HEADING_RE = /^(#{1,3}) +(\S.*)$/
const SUBTEXT_RE = /^-# +(\S.*)$/
const LANG_RE = /^[\w+#.-]{1,32}$/

function listEntry(line: string): ListEntry | null {
  const m = LIST_RE.exec(line)
  if (!m) return null
  const marker = m[2] ?? '-'
  const ordered = marker !== '-' && marker !== '*'
  return { indent: (m[1] ?? '').length, ordered, num: ordered ? parseInt(marker, 10) : 1, text: m[3] ?? '' }
}

function buildList(entries: ListEntry[], from: number): { list: Block; next: number } {
  const first = entries[from]!
  const base = first.indent
  const items: Block[][] = []
  let k = from
  while (k < entries.length) {
    const e = entries[k]!
    if (e.indent < base || e.indent >= base + 2 || e.ordered !== first.ordered) break
    const item: Block[] = [{ t: 'p', c: parseInline(e.text) }]
    k++
    while (k < entries.length && entries[k]!.indent >= base + 2) {
      const sub = buildList(entries, k)
      item.push(sub.list)
      k = sub.next
    }
    items.push(item)
  }
  return { list: { t: 'list', ordered: first.ordered, start: first.ordered ? first.num : 1, items }, next: k }
}

function codeBlock(content: string): Block {
  let lang = ''
  let v = content
  const nl = v.indexOf('\n')
  if (nl !== -1 && LANG_RE.test(v.slice(0, nl))) {
    lang = v.slice(0, nl)
    v = v.slice(nl + 1)
  } else if (v.startsWith('\n')) {
    v = v.slice(1)
  }
  if (v.endsWith('\n')) v = v.slice(0, -1)
  return { t: 'codeblock', lang, v }
}

function parseBlockList(src: string, headings: boolean, inQuote: boolean): Block[] {
  const out: Block[] = []
  let para: string[] = []
  const flush = () => {
    const text = para.join('\n')
    if (text) out.push({ t: 'p', c: parseInline(text) })
    para = []
  }

  let rest = src
  while (rest.length > 0) {
    const nl = rest.indexOf('\n')
    const line = nl === -1 ? rest : rest.slice(0, nl)
    const after = nl === -1 ? '' : rest.slice(nl + 1)

    if (line.startsWith('```')) {
      const end = rest.indexOf('```', 3)
      if (end !== -1 && rest.slice(3, end).trim()) {
        flush()
        out.push(codeBlock(rest.slice(3, end)))
        rest = rest.slice(end + 3).replace(/^\n/, '')
        continue
      }
    }

    if (!inQuote && line.startsWith('>>> ')) {
      flush()
      out.push({ t: 'quote', c: parseBlockList(rest.slice(4), headings, true) })
      return out
    }

    if (!inQuote && line.startsWith('> ')) {
      flush()
      const quoted: string[] = []
      let cur = rest
      while (cur.startsWith('> ')) {
        const n = cur.indexOf('\n')
        quoted.push(n === -1 ? cur.slice(2) : cur.slice(2, n))
        cur = n === -1 ? '' : cur.slice(n + 1)
      }
      out.push({ t: 'quote', c: parseBlockList(quoted.join('\n'), headings, true) })
      rest = cur
      continue
    }

    const h = headings ? HEADING_RE.exec(line) : null
    if (h) {
      flush()
      const level = (h[1] ?? '#').length as 1 | 2 | 3
      out.push({ t: 'h', level, c: parseInline(h[2] ?? '') })
      rest = after
      continue
    }

    const sub = SUBTEXT_RE.exec(line)
    if (sub) {
      flush()
      out.push({ t: 'subtext', c: parseInline(sub[1] ?? '') })
      rest = after
      continue
    }

    if (listEntry(line)) {
      flush()
      const entries: ListEntry[] = []
      let cur = rest
      for (;;) {
        const n = cur.indexOf('\n')
        const l = n === -1 ? cur : cur.slice(0, n)
        const e = cur ? listEntry(l) : null
        if (!e) break
        entries.push(e)
        cur = n === -1 ? '' : cur.slice(n + 1)
      }
      let k = 0
      while (k < entries.length) {
        const built = buildList(entries, k)
        out.push(built.list)
        k = built.next
      }
      rest = cur
      continue
    }

    para.push(line)
    if (nl === -1) break
    rest = after
  }
  flush()
  return out
}

export function parseBlocks(src: string, opts: { headings?: boolean } = {}): Block[] {
  const text = src.replace(/\r\n?/g, '\n')
  if (!text) return []
  return parseBlockList(text, opts.headings !== false, false)
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function clock(d: Date, seconds: boolean): string {
  const h = d.getHours()
  const h12 = h % 12 === 0 ? 12 : h % 12
  const s = seconds ? `:${pad(d.getSeconds())}` : ''
  return `${h12}:${pad(d.getMinutes())}${s} ${h < 12 ? 'AM' : 'PM'}`
}

function longDate(d: Date): string {
  return `${MONTHS[d.getMonth()] ?? ''} ${d.getDate()}, ${d.getFullYear()}`
}

function relative(unix: number, now: Date): string {
  const diff = unix * 1000 - now.getTime()
  const s = Math.abs(diff) / 1000
  const m = s / 60
  const h = m / 60
  const d = h / 24
  let phrase: string
  if (s < 45) phrase = 'a few seconds'
  else if (s < 90) phrase = 'a minute'
  else if (m < 45) phrase = `${Math.round(m)} minutes`
  else if (m < 90) phrase = 'an hour'
  else if (h < 22) phrase = `${Math.round(h)} hours`
  else if (h < 36) phrase = 'a day'
  else if (d < 26) phrase = `${Math.round(d)} days`
  else if (d < 45) phrase = 'a month'
  else if (d < 320) phrase = `${Math.round(d / 30.4375)} months`
  else if (d < 548) phrase = 'a year'
  else phrase = `${Math.round(d / 365.25)} years`
  return diff >= 0 ? `in ${phrase}` : `${phrase} ago`
}

export function formatTimestamp(unix: number, style: string, now: Date = new Date()): string {
  const d = new Date(unix * 1000)
  if (Number.isNaN(d.getTime())) return 'Invalid Date'
  switch (style) {
    case 't':
      return clock(d, false)
    case 'T':
      return clock(d, true)
    case 'd':
      return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`
    case 'D':
      return longDate(d)
    case 'F':
      return `${DAYS[d.getDay()] ?? ''}, ${longDate(d)} ${clock(d, false)}`
    case 'R':
      return relative(unix, now)
    default:
      return `${longDate(d)} ${clock(d, false)}`
  }
}
