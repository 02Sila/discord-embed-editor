import { useRef, useState } from 'react'
import { ChevronDown, FileInput, LayoutTemplate, Moon, Redo2, Sun, Undo2 } from 'lucide-react'
import { useEditor } from '../model/store'
import { TEMPLATES } from '../model/templates'
import { parseImport } from '../export/json'
import { Button, IconButton } from '../ui/controls'
import { Modal } from '../ui/Modal'
import { Popover } from '../ui/Popover'
import { useToast } from '../ui/Toast'

export const REPO_URL = 'https://github.com/02Sila/discord-embed-editor'

export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" width="28" height="28" aria-hidden>
      <rect x="9" y="4" width="19" height="16" rx="3.5" fill="currentColor" opacity="0.28" />
      <rect x="4" y="10" width="21" height="18" rx="3.5" fill="currentColor" opacity="0.9" />
      <rect x="4" y="10" width="4" height="18" rx="2" fill="var(--accent)" />
      <rect x="11" y="15" width="10" height="2.4" rx="1.2" fill="var(--bg)" />
      <rect x="11" y="20" width="7" height="2.4" rx="1.2" fill="var(--bg)" opacity="0.7" />
    </svg>
  )
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  )
}

function TemplatesMenu() {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const replace = useEditor((s) => s.replace)
  return (
    <>
      <Button
        ref={anchor}
        variant="ghost"
        icon={<LayoutTemplate size={16} />}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="hide-sm-label"
      >
        Templates
        <ChevronDown size={14} className="chev" />
      </Button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} label="Templates" role="menu">
        <div className="menu">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                replace(t.build())
                setOpen(false)
                useToast.getState().show(`Loaded ${t.name.toLowerCase()}`)
              }}
              onKeyDown={(e) => {
                const items = [...(e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
                const i = items.indexOf(e.currentTarget)
                if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus()
                if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length]?.focus()
              }}
              ref={(el) => {
                if (el && t.id === TEMPLATES[0]?.id && open) requestAnimationFrame(() => el.focus())
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </Popover>
    </>
  )
}

function ImportButton() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const replace = useEditor((s) => s.replace)
  const submit = () => {
    const r = parseImport(text)
    if (!r.ok) {
      setError(r.error)
      return
    }
    replace(r.message)
    setOpen(false)
    setText('')
    setError(null)
    useToast.getState().show('Imported')
  }
  return (
    <>
      <Button variant="ghost" icon={<FileInput size={16} />} onClick={() => setOpen(true)} className="hide-sm-label">
        Import
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Import JSON"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={!text.trim()}>
              Load embed
            </Button>
          </>
        }
      >
        <textarea
          className="input textarea import-text"
          aria-label="JSON to import"
          placeholder='{ "embeds": [ ... ] }'
          spellCheck={false}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
          }}
        />
        {error && <div className="field-error">{error}</div>}
      </Modal>
    </>
  )
}

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'dark')
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#111214' : '#e9ebee')
    try {
      localStorage.setItem('embed-editor:theme', next)
    } catch {
      /* storage unavailable */
    }
    setTheme(next)
  }
  return { theme, toggle }
}

export function TopBar() {
  const canUndo = useEditor((s) => s.history.past.length > 0)
  const canRedo = useEditor((s) => s.history.future.length > 0)
  const { undo, redo } = useEditor.getState()
  const { theme, toggle } = useTheme()
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <h1>Embed Editor</h1>
      </div>
      <div className="topbar-actions">
        <IconButton label="Undo" disabled={!canUndo} onClick={undo}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="Redo" disabled={!canRedo} onClick={redo}>
          <Redo2 size={18} />
        </IconButton>
        <span className="topbar-sep" />
        <TemplatesMenu />
        <ImportButton />
        <span className="topbar-sep" />
        <IconButton label={theme === 'dark' ? 'Light theme' : 'Dark theme'} onClick={toggle}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
        <a className="icon-btn" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Source on GitHub" data-tip="GitHub">
          <GitHubMark />
        </a>
      </div>
    </header>
  )
}
