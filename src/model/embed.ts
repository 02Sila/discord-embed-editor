export interface EmbedField {
  id: string
  name: string
  value: string
  inline: boolean
}

export interface EmbedAuthor {
  name: string
  url: string
  iconUrl: string
}

export interface EmbedFooter {
  text: string
  iconUrl: string
}

export interface Embed {
  id: string
  color: number | null
  author: EmbedAuthor | null
  title: string
  url: string
  description: string
  fields: EmbedField[]
  image: string
  thumbnail: string
  footer: EmbedFooter | null
  timestamp: string | null
}

export interface Message {
  content: string
  username: string
  avatarUrl: string
  embeds: Embed[]
}

export const LIMITS = {
  title: 256,
  description: 4096,
  fields: 25,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  author: 256,
  total: 6000,
  embeds: 10,
  content: 2000,
  username: 80,
} as const

export const DISCORD_COLORS: { name: string; value: number }[] = [
  { name: 'Blurple', value: 0x5865f2 },
  { name: 'Green', value: 0x57f287 },
  { name: 'Yellow', value: 0xfee75c },
  { name: 'Fuchsia', value: 0xeb459e },
  { name: 'Red', value: 0xed4245 },
  { name: 'White', value: 0xffffff },
  { name: 'Greyple', value: 0x99aab5 },
  { name: 'Dark', value: 0x2c2f33 },
  { name: 'Aqua', value: 0x1abc9c },
  { name: 'Blue', value: 0x3498db },
  { name: 'Orange', value: 0xe67e22 },
  { name: 'Gold', value: 0xf1c40f },
]

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function createField(partial: Partial<EmbedField> = {}): EmbedField {
  return { id: uid(), name: 'Field name', value: 'Field value', inline: false, ...partial }
}

export function createEmbed(partial: Partial<Embed> = {}): Embed {
  return {
    id: uid(),
    color: null,
    author: null,
    title: '',
    url: '',
    description: '',
    fields: [],
    image: '',
    thumbnail: '',
    footer: null,
    timestamp: null,
    ...partial,
  }
}

export function createMessage(partial: Partial<Message> = {}): Message {
  return { content: '', username: '', avatarUrl: '', embeds: [createEmbed()], ...partial }
}

export function embedLength(embed: Embed): number {
  return (
    embed.title.length +
    embed.description.length +
    (embed.author?.name.length ?? 0) +
    (embed.footer?.text.length ?? 0) +
    embed.fields.reduce((sum, f) => sum + f.name.length + f.value.length, 0)
  )
}

export function totalLength(message: Message): number {
  return message.embeds.reduce((sum, e) => sum + embedLength(e), 0)
}

export function isEmbedEmpty(embed: Embed): boolean {
  return (
    !embed.title &&
    !embed.description &&
    !embed.author?.name &&
    !embed.footer?.text &&
    !embed.image &&
    !embed.thumbnail &&
    embed.fields.length === 0
  )
}

export function hex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0').toUpperCase()
}

export function parseHex(input: string): number | null {
  const m = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(m)) {
    return parseInt(m.split('').map((c) => c + c).join(''), 16)
  }
  if (/^[0-9a-f]{6}$/i.test(m)) return parseInt(m, 16)
  return null
}
