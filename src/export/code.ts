import type { Embed, Message } from '../model/embed'
import { exportableEmbeds, isoTimestamp, toWebhookPayload } from './json'

function hexLiteral(color: number): string {
  return '0x' + color.toString(16).padStart(6, '0').toUpperCase()
}

export function jsString(s: string): string {
  if (s.includes('\n')) {
    return '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${').replace(/\r/g, '\\r') + '`'
  }
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\t/g, '\\t') + "'"
}

export function pyString(s: string): string {
  if (s.includes('\n')) {
    return '"""' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r') + '"""'
  }
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"'
}

function jsObject(entries: [string, string][]): string {
  return '{ ' + entries.map(([k, v]) => `${k}: ${v}`).join(', ') + ' }'
}

function jsEmbed(e: Embed, name: string): string {
  const calls: string[] = []
  if (e.color !== null) calls.push(`.setColor(${hexLiteral(e.color)})`)
  if (e.author?.name) {
    const entries: [string, string][] = [['name', jsString(e.author.name)]]
    if (e.author.url) entries.push(['url', jsString(e.author.url)])
    if (e.author.iconUrl) entries.push(['iconURL', jsString(e.author.iconUrl)])
    calls.push(`.setAuthor(${jsObject(entries)})`)
  }
  if (e.title) calls.push(`.setTitle(${jsString(e.title)})`)
  if (e.title && e.url) calls.push(`.setURL(${jsString(e.url)})`)
  if (e.description) calls.push(`.setDescription(${jsString(e.description)})`)
  if (e.fields.length > 0) {
    const fields = e.fields.map((f) => {
      const entries: [string, string][] = [
        ['name', jsString(f.name)],
        ['value', jsString(f.value)],
      ]
      if (f.inline) entries.push(['inline', 'true'])
      return '    ' + jsObject(entries) + ','
    })
    calls.push(`.addFields(\n${fields.join('\n')}\n  )`)
  }
  if (e.thumbnail) calls.push(`.setThumbnail(${jsString(e.thumbnail)})`)
  if (e.image) calls.push(`.setImage(${jsString(e.image)})`)
  if (e.footer?.text) {
    const entries: [string, string][] = [['text', jsString(e.footer.text)]]
    if (e.footer.iconUrl) entries.push(['iconURL', jsString(e.footer.iconUrl)])
    calls.push(`.setFooter(${jsObject(entries)})`)
  }
  const ts = isoTimestamp(e.timestamp)
  if (ts) calls.push(`.setTimestamp(new Date(${jsString(ts)}))`)
  return `const ${name} = new EmbedBuilder()` + calls.map((c) => '\n  ' + c).join('')
}

function names(count: number): string[] {
  return count === 1 ? ['embed'] : Array.from({ length: count }, (_, i) => `embed${i + 1}`)
}

export function toDiscordJs(m: Message): string {
  const embeds = exportableEmbeds(m)
  const ids = names(embeds.length)
  const parts: string[] = []
  if (embeds.length > 0) parts.push("import { EmbedBuilder } from 'discord.js'")
  embeds.forEach((e, i) => parts.push(jsEmbed(e, ids[i] ?? `embed${i + 1}`)))
  const payload: [string, string][] = []
  if (m.content) payload.push(['content', jsString(m.content)])
  if (embeds.length > 0) payload.push(['embeds', `[${ids.join(', ')}]`])
  parts.push(`await channel.send(${payload.length > 0 ? jsObject(payload) : "{ content: '' }"})`)
  return parts.join('\n\n') + '\n'
}

function pyEmbed(e: Embed, name: string): string {
  const args: string[] = []
  if (e.title) args.push(`title=${pyString(e.title)}`)
  if (e.title && e.url) args.push(`url=${pyString(e.url)}`)
  if (e.description) args.push(`description=${pyString(e.description)}`)
  if (e.color !== null) args.push(`color=${hexLiteral(e.color)}`)
  const ts = isoTimestamp(e.timestamp)
  if (ts) args.push(`timestamp=datetime.datetime.fromisoformat(${pyString(ts.replace(/Z$/, '+00:00'))})`)
  const lines: string[] = [
    args.length > 0
      ? `${name} = discord.Embed(\n${args.map((a) => `    ${a},`).join('\n')}\n)`
      : `${name} = discord.Embed()`,
  ]
  if (e.author?.name) {
    const a = [`name=${pyString(e.author.name)}`]
    if (e.author.url) a.push(`url=${pyString(e.author.url)}`)
    if (e.author.iconUrl) a.push(`icon_url=${pyString(e.author.iconUrl)}`)
    lines.push(`${name}.set_author(${a.join(', ')})`)
  }
  for (const f of e.fields) {
    lines.push(
      `${name}.add_field(name=${pyString(f.name)}, value=${pyString(f.value)}, inline=${f.inline ? 'True' : 'False'})`,
    )
  }
  if (e.thumbnail) lines.push(`${name}.set_thumbnail(url=${pyString(e.thumbnail)})`)
  if (e.image) lines.push(`${name}.set_image(url=${pyString(e.image)})`)
  if (e.footer?.text) {
    const a = [`text=${pyString(e.footer.text)}`]
    if (e.footer.iconUrl) a.push(`icon_url=${pyString(e.footer.iconUrl)}`)
    lines.push(`${name}.set_footer(${a.join(', ')})`)
  }
  return lines.join('\n')
}

export function toDiscordPy(m: Message): string {
  const embeds = exportableEmbeds(m)
  const ids = names(embeds.length)
  const imports: string[] = []
  if (embeds.length > 0) imports.push('import discord')
  if (embeds.some((e) => isoTimestamp(e.timestamp))) imports.push('import datetime')
  const parts: string[] = []
  if (imports.length > 0) parts.push(imports.join('\n'))
  embeds.forEach((e, i) => parts.push(pyEmbed(e, ids[i] ?? `embed${i + 1}`)))
  const args: string[] = []
  if (m.content) args.push(`content=${pyString(m.content)}`)
  if (embeds.length > 0) args.push(`embeds=[${ids.join(', ')}]`)
  parts.push(`await channel.send(${args.join(', ')})`)
  return parts.join('\n\n') + '\n'
}

export function toCurl(m: Message): string {
  const body = JSON.stringify(toWebhookPayload(m)).replace(/'/g, "'\\''")
  return (
    [
      'WEBHOOK_URL="https://discord.com/api/webhooks/your/webhook"',
      '',
      'curl -X POST "$WEBHOOK_URL" \\',
      '  -H "Content-Type: application/json" \\',
      `  -d '${body}'`,
    ].join('\n') + '\n'
  )
}
