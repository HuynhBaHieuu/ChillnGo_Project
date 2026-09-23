import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { dayCostOf } from '@/lib/itinerary'
import { formatLongDate, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TripDay } from '@/services/types'

interface SortableDayProps {
  day: TripDay
  canRemove: boolean
  onRemove: () => void
}

/** One draggable day card in the itinerary detail view. */
export function SortableDay({ day, canRemove, onRemove }: SortableDayProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: day._id })

  return (
    // Uses the glass classes directly rather than <GlassCard> because dnd-kit
    // needs a real DOM ref on this node.
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'list-none border border-border bg-card p-5 transition-colors',
        isDragging && 'z-20 opacity-90',
      )}
    >
      <header className="relative z-[1] flex items-start gap-3">
        <button
          type="button"
          aria-label={`Kéo để đổi thứ tự ngày ${day.dayNumber}`}
          className="mt-0.5 cursor-grab touch-none rounded-2xl p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            Ngày {day.dayNumber}
          </p>
          <h3 className="mt-1 font-display text-xl">
            {day.title || 'Chưa đặt tên'}
          </h3>
          <time dateTime={day.date} className="text-sm text-muted-foreground">
            {formatLongDate(day.date)}
          </time>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span className="text-sm text-muted-foreground">
            {formatVnd(dayCostOf(day))}
          </span>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              aria-label={`Xoá ngày ${day.dayNumber}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </header>

      <ul className="relative z-[1] mt-4 space-y-2 pl-10">
        {day.locations.map((location) => (
          <li
            key={location._id}
            className="flex items-baseline justify-between gap-4 text-sm"
          >
            <span className="min-w-0">
              <span className="block truncate">{location.name}</span>
              {location.note && (
                <span className="block truncate text-xs text-muted-foreground">
                  {location.note}
                </span>
              )}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {location.estCost > 0 ? formatVnd(location.estCost) : 'Miễn phí'}
            </span>
          </li>
        ))}
      </ul>
    </li>
  )
}
