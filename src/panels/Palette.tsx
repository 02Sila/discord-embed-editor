import { useDraggable } from '@dnd-kit/core'
import {
  AlignLeft,
  Clock,
  Columns3,
  Frame,
  Heading,
  ImageIcon,
  PanelBottom,
  Rows3,
  SquarePlus,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useEditor, type BlockKind } from '../model/store'

export const BLOCKS: { kind: BlockKind; label: string; icon: LucideIcon }[] = [
  { kind: 'author', label: 'Author', icon: UserRound },
  { kind: 'title', label: 'Title', icon: Heading },
  { kind: 'description', label: 'Description', icon: AlignLeft },
  { kind: 'field', label: 'Field', icon: Rows3 },
  { kind: 'inline-field', label: 'Inline field', icon: Columns3 },
  { kind: 'image', label: 'Image', icon: ImageIcon },
  { kind: 'thumbnail', label: 'Thumbnail', icon: Frame },
  { kind: 'footer', label: 'Footer', icon: PanelBottom },
  { kind: 'timestamp', label: 'Timestamp', icon: Clock },
  { kind: 'embed', label: 'New embed', icon: SquarePlus },
]

export function addToCurrent(kind: BlockKind) {
  const { selection, message, addBlock } = useEditor.getState()
  const embedId = selection?.embedId ?? message.embeds[message.embeds.length - 1]?.id ?? null
  addBlock(embedId, kind)
}

function Block({ kind, label, icon: Icon, onAdded }: (typeof BLOCKS)[number] & { onAdded?: () => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `block:${kind}`,
    data: { type: 'block', kind },
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={isDragging ? 'block is-dragging' : 'block'}
      {...attributes}
      {...listeners}
      onClick={() => {
        addToCurrent(kind)
        onAdded?.()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          addToCurrent(kind)
          onAdded?.()
        } else {
          listeners?.onKeyDown?.(e)
        }
      }}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  )
}

export function BlockChip({ kind }: { kind: BlockKind }) {
  const b = BLOCKS.find((x) => x.kind === kind)
  if (!b) return null
  const Icon = b.icon
  return (
    <div className="block block-overlay">
      <Icon size={18} />
      <span>{b.label}</span>
    </div>
  )
}

export function Palette({ onAdded }: { onAdded?: () => void }) {
  return (
    <aside className="palette" aria-label="Blocks">
      <h2 className="panel-title">Blocks</h2>
      <div className="block-list">
        {BLOCKS.map((b) => (
          <Block key={b.kind} {...b} onAdded={onAdded} />
        ))}
      </div>
    </aside>
  )
}
