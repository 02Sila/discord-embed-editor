import { isEmbedEmpty, LIMITS, totalLength, type Message } from '../model/embed'

export interface Issue {
  embedIndex: number | null
  path: string
  message: string
}

const URL_RE = /^https?:\/\/[^\s]+$/i
const MEDIA_RE = /^(?:https?|attachment):\/\/[^\s]+$/i

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function over(label: string, length: number, limit: number): string | null {
  return length > limit ? `${label} is ${plural(length - limit, 'character')} over the ${limit} limit` : null
}

export function validate(m: Message): Issue[] {
  const issues: Issue[] = []
  const add = (embedIndex: number | null, path: string, message: string | null) => {
    if (message) issues.push({ embedIndex, path, message })
  }
  const url = (embedIndex: number | null, path: string, label: string, value: string, media: boolean) => {
    if (value && !(media ? MEDIA_RE : URL_RE).test(value.trim())) {
      add(embedIndex, path, `${label} must start with http:// or https://`)
    }
  }

  add(null, 'content', over('Message content', m.content.length, LIMITS.content))
  add(null, 'username', over('Username', m.username.length, LIMITS.username))
  url(null, 'avatarUrl', 'Avatar URL', m.avatarUrl, false)

  if (m.embeds.length > LIMITS.embeds) {
    add(null, 'embeds', `There are ${m.embeds.length} embeds, Discord allows ${LIMITS.embeds}`)
  }

  m.embeds.forEach((e, i) => {
    const p = `embeds[${i}]`
    add(i, `${p}.title`, over('Title', e.title.length, LIMITS.title))
    add(i, `${p}.description`, over('Description', e.description.length, LIMITS.description))
    if (e.author) {
      add(i, `${p}.author.name`, over('Author name', e.author.name.length, LIMITS.author))
      url(i, `${p}.author.url`, 'Author link', e.author.url, false)
      url(i, `${p}.author.iconUrl`, 'Author icon', e.author.iconUrl, true)
    }
    if (e.footer) {
      add(i, `${p}.footer.text`, over('Footer', e.footer.text.length, LIMITS.footer))
      url(i, `${p}.footer.iconUrl`, 'Footer icon', e.footer.iconUrl, true)
    }
    url(i, `${p}.url`, 'Title link', e.url, false)
    url(i, `${p}.image`, 'Image URL', e.image, true)
    url(i, `${p}.thumbnail`, 'Thumbnail URL', e.thumbnail, true)

    if (e.fields.length > LIMITS.fields) {
      add(i, `${p}.fields`, `There are ${e.fields.length} fields, Discord allows ${LIMITS.fields}`)
    }
    e.fields.forEach((f, j) => {
      const fp = `${p}.fields[${j}]`
      const n = j + 1
      if (!f.name.trim()) add(i, `${fp}.name`, `Field ${n} needs a name`)
      if (!f.value.trim()) add(i, `${fp}.value`, `Field ${n} needs a value`)
      add(i, `${fp}.name`, over(`Field ${n} name`, f.name.length, LIMITS.fieldName))
      add(i, `${fp}.value`, over(`Field ${n} value`, f.value.length, LIMITS.fieldValue))
    })
  })

  const total = totalLength(m)
  if (total > LIMITS.total) {
    add(null, 'embeds', `All embeds together are ${plural(total - LIMITS.total, 'character')} over the ${LIMITS.total} limit`)
  }

  if (!m.content.trim() && m.embeds.every(isEmbedEmpty)) {
    add(null, 'content', 'The message is empty: add some content or fill in an embed')
  }

  return issues
}
