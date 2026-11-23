// Liste réordonnable par glisser-déposer (@dnd-kit). On attrape la poignée uniquement : le défilement de la feuille n'est jamais gêné.
import { closestCenter, DndContext, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { Icon } from './kit'

export type HandleProps = HTMLAttributes<HTMLButtonElement> & { style?: CSSProperties }

function Item({ id, children }: { id: string; children: (h: { handle: HandleProps; dragging: boolean }) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} data-sortable={id} style={{ transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 5 : undefined, opacity: isDragging ? 0.92 : 1 }}>
      {children({ handle: { ...attributes, ...listeners, style: { touchAction: 'none' } } as HandleProps, dragging: isDragging })}
    </div>
  )
}

export function SortableList<T extends { id: string }>({ items, onChange, children }: {
  items: T[]
  onChange: (next: T[]) => void
  children: (item: T, ctx: { handle: HandleProps; dragging: boolean; index: number }) => ReactNode
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const end = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const from = items.findIndex((x) => x.id === e.active.id)
    const to = items.findIndex((x) => x.id === e.over!.id)
    if (from >= 0 && to >= 0) onChange(arrayMove(items, from, to))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}>
      <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {items.map((it, index) => <Item key={it.id} id={it.id}>{(c) => children(it, { ...c, index })}</Item>)}
        </div>
      </SortableContext>
    </DndContext>
  )
}

/** Poignée de glisser-déposer (zone tactile 44 px). */
export function GripHandle({ handle, label = 'Réordonner' }: { handle: HandleProps; label?: string }) {
  return (
    <button {...handle} aria-label={label} className="w-11 h-11 shrink-0 flex items-center justify-center text-faint cursor-grab active:cursor-grabbing" style={{ touchAction: 'none', ...handle.style }}>
      <Icon name="grip" size={22} strokeWidth={3} />
    </button>
  )
}
