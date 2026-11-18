import { useMemo, useState } from 'react'
import { AlertTriangle, CircleCheck, Copy, Download } from 'lucide-react'
import { forExport, useEditor } from '../model/store'
import { toEmbedsJson, toWebhookJson } from '../export/json'
import { buildPrompt, type PromptTarget } from '../export/prompt'
import { toCurl, toDiscordJs, toDiscordPy } from '../export/code'
import { shareUrl } from '../export/share'
import { validate } from '../export/validate'
import { Button, Segmented, Switch } from '../ui/controls'
import { copyText } from '../ui/Toast'
import { highlight } from './highlight'

type Format = 'json' | 'webhook' | 'prompt' | 'djs' | 'dpy' | 'curl' | 'link'

const FORMATS: { value: Format; label: string; what: string; file: string; lang: 'json' | 'js' | 'py' | 'sh' | 'text' }[] = [
  { value: 'json', label: 'JSON', what: 'embed JSON', file: 'embed.json', lang: 'json' },
  { value: 'webhook', label: 'Webhook', what: 'webhook payload', file: 'webhook.json', lang: 'json' },
  { value: 'prompt', label: 'LLM prompt', what: 'prompt', file: 'embed-prompt.txt', lang: 'text' },
  { value: 'djs', label: 'discord.js', what: 'discord.js code', file: 'embed.js', lang: 'js' },
  { value: 'dpy', label: 'discord.py', what: 'discord.py code', file: 'embed.py', lang: 'py' },
  { value: 'curl', label: 'cURL', what: 'cURL command', file: 'send-embed.sh', lang: 'sh' },
  { value: 'link', label: 'Share link', what: 'share link', file: 'embed-link.txt', lang: 'text' },
]

const TARGETS: { value: PromptTarget; label: string }[] = [
  { value: 'discord.js', label: 'discord.js' },
  { value: 'discord.py', label: 'discord.py' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'any', label: 'Any' },
]

function download(text: string, file: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = file
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ExportPanel() {
  const message = useEditor((s) => s.message)
  const [format, setFormat] = useState<Format>(() => {
    try {
      return (localStorage.getItem('embed-editor:format') as Format) || 'json'
    } catch {
      return 'json'
    }
  })
  const [target, setTarget] = useState<PromptTarget>('discord.js')
  const [jsonOnly, setJsonOnly] = useState(false)

  const clean = useMemo(() => forExport(message), [message])
  const issues = useMemo(() => validate(clean), [clean])
  const meta = FORMATS.find((f) => f.value === format) ?? FORMATS[0]!

  const output = useMemo(() => {
    switch (format) {
      case 'json':
        return toEmbedsJson(clean)
      case 'webhook':
        return toWebhookJson(clean)
      case 'prompt':
        return buildPrompt(clean, { target, jsonOnly })
      case 'djs':
        return toDiscordJs(clean)
      case 'dpy':
        return toDiscordPy(clean)
      case 'curl':
        return toCurl(clean)
      case 'link':
        return shareUrl(clean, location.origin + location.pathname)
    }
  }, [format, clean, target, jsonOnly])

  const code = useMemo(() => highlight(output, meta.lang), [output, meta.lang])

  const pick = (f: Format) => {
    setFormat(f)
    try {
      localStorage.setItem('embed-editor:format', f)
    } catch {
      /* storage unavailable */
    }
  }

  return (
    <div className="export">
      <div className="format-tabs" role="tablist" aria-label="Export format">
        {FORMATS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={f.value === format}
            className="format-tab"
            onClick={() => pick(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {format === 'prompt' && (
        <div className="prompt-opts">
          <Segmented size="sm" label="Prompt target" value={target} onChange={setTarget} options={TARGETS} />
          <Switch label="JSON only" checked={jsonOnly} onChange={setJsonOnly} />
        </div>
      )}

      <div className="code-wrap">
        <pre className={`code lang-${meta.lang}`} tabIndex={0} aria-label={`${meta.label} output`}>
          <code>{code}</code>
        </pre>
      </div>

      <div className="export-actions">
        <Button variant="primary" icon={<Copy size={16} />} onClick={() => copyText(output, meta.what)}>
          Copy {meta.label}
        </Button>
        <Button icon={<Download size={16} />} onClick={() => download(output, meta.file)}>
          Download
        </Button>
      </div>

      <div className={issues.length ? 'issues has-issues' : 'issues'}>
        {issues.length === 0 ? (
          <div className="issue is-ok">
            <CircleCheck size={16} />
            <span>Ready to send</span>
          </div>
        ) : (
          <>
            <div className="issues-title">
              <AlertTriangle size={16} />
              <span>
                {issues.length} {issues.length === 1 ? 'problem' : 'problems'} Discord will reject
              </span>
            </div>
            <ul>
              {issues.map((i, n) => (
                <li key={n}>
                  {i.embedIndex != null && <span className="issue-where">Embed {i.embedIndex + 1}</span>}
                  {i.message}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
