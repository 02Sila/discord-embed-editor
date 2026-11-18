import type { ReactNode } from 'react'

const RULES: { cls: string; re: RegExp }[] = [
  { cls: 'tk-comment', re: /^(\/\/[^\n]*|#[^\n]*)/ },
  { cls: 'tk-string', re: /^("""[\s\S]*?"""|`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/ },
  { cls: 'tk-number', re: /^(0x[0-9a-fA-F]+|-?\d+(?:\.\d+)?)/ },
  {
    cls: 'tk-keyword',
    re: /^(import|from|const|let|new|await|async|true|false|null|True|False|None|def|return|curl)\b/,
  },
  { cls: 'tk-prop', re: /^[A-Za-z_$][\w$]*(?=\s*[(:=])/ },
]

export function highlight(code: string, lang: 'json' | 'js' | 'py' | 'sh' | 'text'): ReactNode[] {
  if (lang === 'text') return [code]
  const out: ReactNode[] = []
  let buf = ''
  let i = 0
  let k = 0
  const flush = () => {
    if (buf) out.push(buf)
    buf = ''
  }
  while (i < code.length) {
    const rest = code.slice(i)
    const prev = code[i - 1]
    const boundary = !prev || !/[\w$]/.test(prev)
    let matched = false
    for (const r of RULES) {
      if (r.cls === 'tk-comment' && (lang === 'json' || (lang === 'js' && rest[0] === '#'))) continue
      if (r.cls === 'tk-comment' && lang === 'py' && rest[0] === '/') continue
      if (r.cls !== 'tk-string' && !boundary) continue
      const m = r.re.exec(rest)
      if (m && m[0]) {
        flush()
        let cls = r.cls
        if (lang === 'json' && cls === 'tk-string' && /^\s*:/.test(code.slice(i + m[0].length))) cls = 'tk-prop'
        out.push(
          <span key={k++} className={cls}>
            {m[0]}
          </span>,
        )
        i += m[0].length
        matched = true
        break
      }
    }
    if (!matched) {
      buf += code[i]
      i++
    }
  }
  flush()
  return out
}
