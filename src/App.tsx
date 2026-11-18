import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Blocks, Code2, PenLine, Rows3 } from 'lucide-react'
import { useEditor, type BlockKind } from './model/store'
import { decodeShare } from './export/share'
import { Stage } from './stage/Stage'
import { useView } from './stage/view'
import { BlockChip, Palette } from './panels/Palette'
import { Inspector } from './panels/Inspector'
import { ExportPanel } from './panels/ExportPanel'
import { TopBar } from './panels/TopBar'
import { Toaster, useToast } from './ui/Toast'

type Pane = 'edit' | 'export'
type MobileTab = 'canvas' | 'blocks' | 'edit' | 'export'

const PRIORITY: Record<string, number> = { field: 0, 'new-embed': 1, 'embed-body': 2, embed: 3 }

const collision: CollisionDetection = (args) => {
  const type = args.active.data.current?.type as string | undefined
  const hits = pointerWithin(args)
  const pool = hits.length ? hits : closestCenter(args)
  const allowed = pool.filter((c) => {
    const t = args.droppableContainers.find((d) => d.id === c.id)?.data.current?.type as string | undefined
    if (type === 'field') return t === 'field'
    if (type === 'embed') return t === 'embed'
    return t !== undefined
  })
  return allowed.sort((a, b) => {
    const ta = args.droppableContainers.find((d) => d.id === a.id)?.data.current?.type as string
    const tb = args.droppableContainers.find((d) => d.id === b.id)?.data.current?.type as string
    return (PRIORITY[ta] ?? 9) - (PRIORITY[tb] ?? 9)
  })
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.closest('input, textarea, [contenteditable="true"]')
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        if (e.shiftKey) useEditor.getState().redo()
        else useEditor.getState().undo()
      } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault()
        useEditor.getState().redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
        const sel = useEditor.getState().selection
        if (sel && t.closest('.stage')) {
          e.preventDefault()
          useEditor.getState().removePart(sel)
        }
      } else if (e.key === 'Escape' && !typing) {
        useEditor.getState().select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function useShareHash() {
  useEffect(() => {
    if (!location.hash.startsWith('#m=')) return
    const m = decodeShare(location.hash)
    history.replaceState(null, '', location.pathname + location.search)
    if (m) {
      useEditor.getState().replace(m)
      useToast.getState().show('Opened shared embed')
    }
  }, [])
}

export function App() {
  const [pane, setPane] = useState<Pane>('edit')
  const [tab, setTab] = useState<MobileTab>('canvas')
  const [activeBlock, setActiveBlock] = useState<BlockKind | null>(null)
  const setDragging = useView((s) => s.setDragging)
  const selection = useEditor((s) => s.selection)
  useShortcuts()
  useShareHash()

  useEffect(() => {
    if (selection) setPane((p) => (p === 'export' ? 'edit' : p))
  }, [selection])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onStart = (e: DragStartEvent) => {
    const data = e.active.data.current
    useEditor.getState().setEditing(false)
    if (data?.type === 'block') {
      setActiveBlock(data.kind as BlockKind)
      if (tab === 'blocks') setTab('canvas')
    }
    setDragging(true)
  }

  const onEnd = (e: DragEndEvent) => {
    setDragging(false)
    setActiveBlock(null)
    const a = e.active.data.current
    const o = e.over?.data.current
    if (!a || !o) return
    const s = useEditor.getState()
    if (a.type === 'block') {
      const kind = a.kind as BlockKind
      if (o.type === 'new-embed') {
        const last = s.message.embeds[s.message.embeds.length - 1]?.id ?? null
        s.addBlock(last, 'embed')
        const created = useEditor.getState().selection?.embedId ?? null
        if (kind !== 'embed') {
          useEditor.getState().updateEmbed(created!, { description: '' })
          useEditor.getState().addBlock(created, kind)
        }
        return
      }
      const embedId = o.embedId as string
      const before = o.type === 'field' && (kind === 'field' || kind === 'inline-field') ? (o.fieldId as string) : undefined
      s.addBlock(embedId, kind, before)
      return
    }
    if (a.type === 'field' && o.type === 'field' && a.embedId === o.embedId) {
      s.moveField(a.embedId as string, a.fieldId as string, o.fieldId as string)
      return
    }
    if (a.type === 'embed' && o.type === 'embed') {
      s.moveEmbed(a.embedId as string, o.embedId as string)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onStart}
      onDragEnd={onEnd}
      onDragCancel={() => {
        setDragging(false)
        setActiveBlock(null)
      }}
    >
      <div className={`app tab-${tab}`}>
        <TopBar />
        <main className="workspace">
          <div className="col-palette">
            <Palette onAdded={() => setTab('canvas')} />
          </div>
          <div className="col-stage">
            <Stage />
          </div>
          <div className="col-side">
            <div className="side-tabs" role="tablist" aria-label="Panel">
              <button type="button" role="tab" aria-selected={pane === 'edit'} className="side-tab" onClick={() => setPane('edit')}>
                <PenLine size={16} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={pane === 'export'}
                className="side-tab"
                onClick={() => setPane('export')}
              >
                <Code2 size={16} />
                <span>Export</span>
              </button>
            </div>
            <div className={`side-body pane-${pane}`}>
              <div className="side-edit">
                <Inspector />
              </div>
              <div className="side-export">
                <ExportPanel />
              </div>
            </div>
          </div>
        </main>
        <nav className="tabbar" aria-label="Sections">
          {(
            [
              ['canvas', 'Canvas', Rows3],
              ['blocks', 'Blocks', Blocks],
              ['edit', 'Edit', PenLine],
              ['export', 'Export', Code2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              className="tabbar-item"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                setTab(id)
                if (id === 'edit' || id === 'export') setPane(id)
              }}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
      <DragOverlay dropAnimation={null}>{activeBlock ? <BlockChip kind={activeBlock} /> : null}</DragOverlay>
      <Toaster />
    </DndContext>
  )
}
