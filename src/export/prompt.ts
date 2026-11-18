import { hex, type Embed, type Message } from '../model/embed'
import { exportableEmbeds, isoTimestamp, toWebhookJson } from './json'

export type PromptTarget = 'discord.js' | 'discord.py' | 'webhook' | 'any'

const TARGETS: Record<PromptTarget, string> = {
  'discord.js': 'discord.js v14, using EmbedBuilder',
  'discord.py': 'discord.py 2.x, using discord.Embed',
  webhook: 'a raw webhook POST request (JSON body)',
  any: 'whatever library I am using',
}

const MARKDOWN_RE = /[*_~`|>#[\]]|<[@#:at]/

function quote(text: string): string {
  return text
    .split('\n')
    .map((line) => (line ? `    ${line}` : '    '))
    .join('\n')
}

function textLine(label: string, text: string): string[] {
  const note = MARKDOWN_RE.test(text) ? ' (Discord markdown, keep the formatting characters as they are)' : ''
  if (!text.includes('\n') && text.length <= 80) return [`${label}${note}: "${text}"`]
  return [`${label}${note}, exactly:`, quote(text)]
}

function describeEmbed(e: Embed): string[] {
  const lines: string[] = []
  if (e.color !== null) lines.push(`Color: ${hex(e.color)} (decimal ${e.color})`)
  if (e.author?.name) {
    let line = `Author: "${e.author.name}"`
    if (e.author.url) line += `, linking to ${e.author.url}`
    if (e.author.iconUrl) line += `, with the icon ${e.author.iconUrl}`
    lines.push(line)
  }
  if (e.title) {
    const parts = textLine('Title', e.title)
    if (e.url) parts[parts.length - 1] += `, linking to ${e.url}`
    lines.push(...parts)
  }
  if (e.description) lines.push(...textLine('Description', e.description))
  if (e.fields.length > 0) {
    lines.push(`${e.fields.length === 1 ? 'One field' : `${e.fields.length} fields, in this order`}:`)
    e.fields.forEach((f, i) => {
      const layout = f.inline ? 'inline' : 'own line'
      const value = f.value.includes('\n') ? `\n${quote(f.value)}` : ` "${f.value}"`
      lines.push(`  ${i + 1}. "${f.name}" (${layout}):${value}`)
    })
  }
  if (e.thumbnail) lines.push(`Thumbnail: ${e.thumbnail}`)
  if (e.image) lines.push(`Large image: ${e.image}`)
  if (e.footer?.text) {
    let line = `Footer: "${e.footer.text}"`
    if (e.footer.iconUrl) line += `, with the icon ${e.footer.iconUrl}`
    lines.push(line)
  }
  const ts = isoTimestamp(e.timestamp)
  if (ts) lines.push(`Timestamp: ${ts}`)
  return lines
}

export function buildPrompt(m: Message, opts: { target: PromptTarget; jsonOnly: boolean }): string {
  const json = '```json\n' + toWebhookJson(m) + '\n```'
  if (opts.jsonOnly) {
    return `Send this exact Discord message using ${TARGETS[opts.target]}:\n\n${json}\n`
  }

  const embeds = exportableEmbeds(m)
  const out: string[] = []
  out.push(`Build this exact Discord message for ${TARGETS[opts.target]}.`)

  const header: string[] = []
  if (m.content) header.push(...textLine('Message text above the embeds', m.content))
  if (m.username) header.push(`Webhook username: "${m.username}"`)
  if (m.avatarUrl) header.push(`Webhook avatar: ${m.avatarUrl}`)
  if (header.length > 0) out.push('', ...header)

  embeds.forEach((e, i) => {
    out.push('', embeds.length > 1 ? `Embed ${i + 1} of ${embeds.length}:` : 'The embed:')
    let n = 0
    for (const line of describeEmbed(e)) {
      out.push(line.startsWith('  ') ? line : `${++n}. ${line}`)
    }
  })

  out.push(
    '',
    'Rules:',
    '- Keep every piece of text exactly as written, including line breaks and markdown.',
    '- Keep the fields in the order listed and respect inline versus own line.',
    '- Leave out anything not listed above.',
    '- Respect Discord limits: 256 characters for titles and field names, 4096 for the description, 1024 per field value, 25 fields and 6000 characters per message across all embeds.',
    '',
    'This JSON is the source of truth if anything above is unclear:',
    '',
    json,
  )
  return out.join('\n') + '\n'
}
