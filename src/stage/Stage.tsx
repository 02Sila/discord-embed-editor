import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { Box, Minus, Plus, RotateCcw, Square } from 'lucide-react'
import { useEditor } from '../model/store'
import { Markdown } from '../markdown/render'
import { IconButton, Segmented } from '../ui/controls'
import { EmbedCard } from './EmbedCard'
import { InlineText } from './InlineText'
import { Part } from './Part'
import { useView } from './view'

function Avatar({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (url && failed !== url) {
    return <img className="dc-avatar" src={url} alt="" draggable={false} onError={() => setFailed(url)} />
  }
  return (
    <div className="dc-avatar is-default" aria-hidden>
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          fill="currentColor"
          d="M12 3.5a4.25 4.25 0 1 1 0 8.5 4.25 4.25 0 0 1 0-8.5Zm0 10.25c4.1 0 7.5 2.15 7.5 4.8 0 .8-.65 1.45-1.45 1.45H5.95c-.8 0-1.45-.65-1.45-1.45 0-2.65 3.4-4.8 7.5-4.8Z"
        />
      </svg>
      <span className="sr-only">{name}</span>
    </div>
  )
}

function MessageContent() {
  const content = useEditor((s) => s.message.content)
  const editing = useEditor((s) => s.editing && s.selection?.part === 'content')
  const { set, setEditing, select } = useEditor.getState()
  return (
    <Part sel={{ embedId: null, part: 'content' }} z={0.5} label="Message content" className={content ? 'dc-content' : 'dc-content is-empty'}>
      <span
        className="editable"
        onClick={(e) => {
          e.stopPropagation()
          select({ embedId: null, part: 'content' }, true)
        }}
      >
        <InlineText
          value={content}
          editing={editing}
          multiline
          placeholder="Add message content"
          onChange={(v) => set((m) => ({ ...m, content: v }), 'content')}
          onDone={() => setEditing(false)}
        >
          <Markdown text={content} />
        </InlineText>
      </span>
    </Part>
  )
}

function NewEmbedZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'new-embed', data: { type: 'new-embed' } })
  const dragging = useView((s) => s.dragging)
  const count = useEditor((s) => s.message.embeds.length)
  if (!dragging || count >= 10) return null
  return (
    <div ref={setNodeRef} className={isOver ? 'new-embed-zone is-over' : 'new-embed-zone'}>
      Drop to start a new embed
    </div>
  )
}

export function Stage() {
  const message = useEditor((s) => s.message)
  const select = useEditor((s) => s.select)
  const { mode, rx, ry, zoom, dragging, orbit, setZoom, setMode, reset } = useView()
  const stageRef = useRef<HTMLDivElement>(null)
  const orbitRef = useRef<{ x: number; y: number; rx: number; ry: number; moved: boolean; id: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; zoom: number } | null>(null)
  const [orbiting, setOrbiting] = useState(false)
  const [entered, setEntered] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 30)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom(useView.getState().zoom * Math.exp(-e.deltaY * 0.004))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setZoom])

  const isBackground = (t: EventTarget | null) => !(t as HTMLElement)?.closest?.('.dc-message, .stage-controls')

  const flat = mode === 'flat' || dragging
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (mode !== 'flat' || dragging) {
      setSettled(false)
      return
    }
    const t = setTimeout(() => setSettled(true), 650)
    return () => clearTimeout(t)
  }, [mode, dragging])
  const rotX = flat ? 0 : rx + tilt.y
  const rotY = flat ? 0 : ry + tilt.x
  const scale = entered ? zoom : zoom * 0.94

  return (
    <div
      ref={stageRef}
      className={`stage ${orbiting ? 'is-orbiting' : ''} ${flat ? 'is-flat' : ''} ${settled ? 'is-settled' : ''} ${entered ? 'is-entered' : ''}`}
      style={{ '--depth': flat ? '0px' : '16px' } as CSSProperties}
      onPointerDown={(e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()]
          pinch.current = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom }
          orbitRef.current = null
          return
        }
        if (!isBackground(e.target) || e.button !== 0) return
        orbitRef.current = { x: e.clientX, y: e.clientY, rx, ry, moved: false, id: e.pointerId }
      }}
      onPointerMove={(e) => {
        if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pinch.current && pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()]
          setZoom((pinch.current.zoom * Math.hypot(a!.x - b!.x, a!.y - b!.y)) / pinch.current.d)
          return
        }
        const o = orbitRef.current
        if (o && o.id === e.pointerId) {
          const dx = e.clientX - o.x
          const dy = e.clientY - o.y
          if (!o.moved && Math.hypot(dx, dy) > 4) {
            o.moved = true
            if (mode === '3d') {
              setOrbiting(true)
              setTilt({ x: 0, y: 0 })
              stageRef.current?.setPointerCapture(e.pointerId)
            }
          }
          if (o.moved && mode === '3d') orbit(o.rx - dy * 0.25, o.ry + dx * 0.3)
          return
        }
        if (e.pointerType === 'mouse' && !flat && !orbiting) {
          const r = stageRef.current!.getBoundingClientRect()
          setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 4, y: -((e.clientY - r.top) / r.height - 0.5) * 3 })
        }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId)
        if (pointers.current.size < 2) pinch.current = null
        const o = orbitRef.current
        if (o && o.id === e.pointerId) {
          if (!o.moved && isBackground(e.target)) select(null)
          orbitRef.current = null
          setOrbiting(false)
        }
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId)
        pinch.current = null
        orbitRef.current = null
        setOrbiting(false)
      }}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div className="stage-scroll">
        <div
          className="stage-world"
          style={{ transform: `scale(${scale}) rotateX(${rotX}deg) rotateY(${rotY}deg)` }}
        >
          <div className="stage-shadow" aria-hidden />
          <div className="dc-message">
            <Part sel={{ embedId: null, part: 'sender' }} z={0.5} label="Sender" className="dc-header-row">
              <Avatar url={message.avatarUrl} name={message.username} />
              <div className="dc-header">
                <span className="dc-username">{message.username || 'Webhook'}</span>
                <span className="dc-tag">APP</span>
                <span className="dc-time">Today at {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            </Part>
            <div className="dc-body">
              <MessageContent />
              <SortableContext items={message.embeds.map((e) => `embed:${e.id}`)} strategy={verticalListSortingStrategy}>
                <div className="dc-embeds">
                  {message.embeds.map((e, i) => (
                    <EmbedCard key={e.id} embed={e} index={i} />
                  ))}
                </div>
              </SortableContext>
              <NewEmbedZone />
            </div>
          </div>
        </div>
      </div>
      <div className="stage-controls" onPointerDown={(e) => e.stopPropagation()}>
        <Segmented
          size="sm"
          label="View"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'flat', label: 'Flat', icon: <Square size={14} /> },
            { value: '3d', label: '3D', icon: <Box size={14} /> },
          ]}
        />
        <div className="stage-zoom">
          <IconButton label="Zoom out" onClick={() => setZoom(zoom - 0.1)}>
            <Minus size={16} />
          </IconButton>
          <button type="button" className="zoom-value" aria-label="Reset zoom" onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <IconButton label="Zoom in" onClick={() => setZoom(zoom + 0.1)}>
            <Plus size={16} />
          </IconButton>
        </div>
        <IconButton label="Reset view" onClick={reset}>
          <RotateCcw size={16} />
        </IconButton>
      </div>
    </div>
  )
}
