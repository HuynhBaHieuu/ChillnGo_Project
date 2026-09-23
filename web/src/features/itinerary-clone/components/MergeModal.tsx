import { ChevronDown, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { GlassButton } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useMergeIntoItinerary } from '@/features/itinerary-clone/hooks'
import { usePublishedPosts } from '@/features/trip-post/hooks'
import { dayCostOf } from '@/lib/itinerary'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'

interface MergeModalProps {
  itineraryId: string
  /** Posts already merged in — shown as context, not excluded. */
  sourcePostIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Multi-select picker for merging days from other posts into this itinerary.
 *
 * Selection is tracked as a flat `Set` of day ids and regrouped by post on
 * submit, which is the shape `mergeIntoItinerary` expects.
 */
export function MergeModal({
  itineraryId,
  sourcePostIds,
  open,
  onOpenChange,
}: MergeModalProps) {
  const { data: posts, isPending } = usePublishedPosts(open)
  const merge = useMergeIntoItinerary(itineraryId)

  const [query, setQuery] = useState('')
  const [selectedDayIds, setSelectedDayIds] = useState<Set<string>>(new Set())
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!posts) return []
    if (!q) return posts
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [posts, query])

  function toggleDay(dayId: string) {
    setSelectedDayIds((current) => {
      const next = new Set(current)
      if (next.has(dayId)) next.delete(dayId)
      else next.add(dayId)
      return next
    })
  }

  const selectedCost = useMemo(() => {
    if (!posts) return 0
    return posts
      .flatMap((p) => p.days)
      .filter((d) => selectedDayIds.has(d._id))
      .reduce((sum, d) => sum + dayCostOf(d), 0)
  }, [posts, selectedDayIds])

  function handleMerge() {
    if (!posts) return

    const selections = posts
      .map((post) => ({
        postId: post._id,
        dayIds: post.days.filter((d) => selectedDayIds.has(d._id)).map((d) => d._id),
      }))
      .filter((selection) => selection.dayIds.length > 0)

    if (selections.length === 0) return

    merge.mutate(selections, {
      onSuccess: () => {
        setSelectedDayIds(new Set())
        onOpenChange(false)
      },
    })
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Ghép ngày từ bài viết khác"
      description="Chọn những ngày bạn muốn thêm vào lịch trình này. Ngày được ghép sẽ nối vào cuối và đánh số lại."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <GlassButton
            onClick={handleMerge}
            disabled={selectedDayIds.size === 0 || merge.isPending}
          >
            {merge.isPending && <Loader2 className="animate-spin" />}
            Ghép {selectedDayIds.size > 0 ? `${selectedDayIds.size} ngày` : ''}
          </GlassButton>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên hành trình hoặc thẻ…"
        />

        {selectedDayIds.size > 0 && (
          <p className="text-sm text-muted-foreground">
            Đã chọn {selectedDayIds.size} ngày · thêm khoảng{' '}
            <span className="text-foreground">{formatVnd(selectedCost)}</span>
          </p>
        )}

        <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
          {isPending &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}

          {filtered.length === 0 && !isPending && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Không tìm thấy hành trình nào khớp.
            </p>
          )}

          {filtered.map((post) => {
            const isExpanded = expandedPostId === post._id
            const selectedInPost = post.days.filter((d) =>
              selectedDayIds.has(d._id),
            ).length

            return (
              <div key={post._id} className="rounded-2xl border border-border">
                <button
                  type="button"
                  onClick={() => setExpandedPostId(isExpanded ? null : post._id)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-white/5"
                >
                  <img
                    src={post.coverUrl}
                    alt=""
                    className="size-11 shrink-0 rounded-2xl object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{post.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {post.days.length} ngày · {post.author.displayName}
                      {sourcePostIds.includes(post._id) && ' · đã ghép trước đó'}
                    </span>
                  </span>
                  {selectedInPost > 0 && (
                    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      {selectedInPost}
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform',
                      isExpanded && 'rotate-180',
                    )}
                  />
                </button>

                {isExpanded && (
                  <ul className="space-y-1 border-t border-border p-2">
                    {post.days.map((day) => (
                      <li key={day._id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-white/5">
                          <Checkbox
                            checked={selectedDayIds.has(day._id)}
                            onCheckedChange={() => toggleDay(day._id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              Ngày {day.dayNumber}: {day.title}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {day.locations.length} điểm dừng
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatVnd(dayCostOf(day))}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>

        {merge.isError && (
          <p className="text-sm text-destructive">{(merge.error as Error).message}</p>
        )}
      </div>
    </Modal>
  )
}
