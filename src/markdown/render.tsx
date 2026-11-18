import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { formatTimestamp, parseBlocks, parseInline, type Block, type Inline } from './parse'

function Spoiler({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className={open ? 'md-spoiler is-open' : 'md-spoiler'}
      onClick={(e) => {
        if (!open) {
          e.stopPropagation()
          setOpen(true)
        }
      }}
    >
      <span className="md-spoiler-inner">{children}</span>
    </span>
  )
}

const MENTION_LABEL: Record<string, string> = {
  user: '@user',
  role: '@role',
  channel: '#channel',
}

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text':
        return <Fragment key={i}>{n.v}</Fragment>
      case 'br':
        return <br key={i} />
      case 'bold':
        return <strong key={i}>{renderInline(n.c)}</strong>
      case 'italic':
        return <em key={i}>{renderInline(n.c)}</em>
      case 'underline':
        return <u key={i}>{renderInline(n.c)}</u>
      case 'strike':
        return <s key={i}>{renderInline(n.c)}</s>
      case 'spoiler':
        return <Spoiler key={i}>{renderInline(n.c)}</Spoiler>
      case 'code':
        return (
          <code key={i} className="md-code">
            {n.v}
          </code>
        )
      case 'link':
        return (
          <a key={i} className="md-link" href={n.href} target="_blank" rel="noreferrer noopener" onClick={(e) => e.preventDefault()}>
            {renderInline(n.c)}
          </a>
        )
      case 'mention': {
        const label = n.kind === 'everyone' ? '@everyone' : n.kind === 'here' ? '@here' : (MENTION_LABEL[n.kind] ?? '@')
        return (
          <span key={i} className="md-mention">
            {label}
          </span>
        )
      }
      case 'emoji':
        return (
          <img
            key={i}
            className="md-emoji"
            alt={`:${n.name}:`}
            src={`https://cdn.discordapp.com/emojis/${n.id}.${n.animated ? 'gif' : 'webp'}?size=48`}
          />
        )
      case 'timestamp':
        return (
          <span key={i} className="md-timestamp">
            {formatTimestamp(n.unix, n.style)}
          </span>
        )
      default:
        return null
    }
  })
}

function renderBlocks(blocks: Block[]): ReactNode[] {
  return blocks.map((b, i) => {
    switch (b.t) {
      case 'p':
        return (
          <div key={i} className="md-p">
            {renderInline(b.c)}
          </div>
        )
      case 'h': {
        const Tag = (`h${b.level}` as 'h1' | 'h2' | 'h3')
        return (
          <Tag key={i} className="md-h">
            {renderInline(b.c)}
          </Tag>
        )
      }
      case 'subtext':
        return (
          <div key={i} className="md-subtext">
            {renderInline(b.c)}
          </div>
        )
      case 'quote':
        return (
          <blockquote key={i} className="md-quote">
            {renderBlocks(b.c)}
          </blockquote>
        )
      case 'list': {
        const items = b.items.map((item, j) => <li key={j}>{renderBlocks(item)}</li>)
        return b.ordered ? (
          <ol key={i} className="md-list" start={b.start}>
            {items}
          </ol>
        ) : (
          <ul key={i} className="md-list">
            {items}
          </ul>
        )
      }
      case 'codeblock':
        return (
          <pre key={i} className="md-pre">
            <code>{b.v}</code>
          </pre>
        )
      default:
        return null
    }
  })
}

export function Markdown({ text, inline = false }: { text: string; inline?: boolean }) {
  const nodes = useMemo(
    () => (inline ? renderInline(parseInline(text)) : renderBlocks(parseBlocks(text))),
    [text, inline],
  )
  return <>{nodes}</>
}
