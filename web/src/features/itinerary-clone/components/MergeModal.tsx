import { ChevronDown, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { GlassButton } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useMergeIntoItinerary } from '@/features/itinerary-clone/hooks'
import { usePublishedPosts } from '@/features/trip-post/hooks'
import { dayCostOf } from '@/lib/itinerary'
import { t } from '@/i18n'
import { tr } from '@/i18n/rich'
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
 * A selected day: post and day together, because a duplicated journey keeps
 * its days' ids, so a day id alone can match a day in two posts.
 */
function dayKey(postId: string, dayId: string): string {
  return `${postId}::${dayId}`
}

/**
 * Multi-select picker for merging days from other posts into this itinerary.
 *
 * Selection is tracked as a flat `Set` of day keys and regrouped by post on
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

  function toggleDay(key: string) {
    setSelectedDayIds((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectedCost = useMemo(() => {
    if (!posts) return 0
    return posts
      .flatMap((p) => p.days.filter((d) => selectedDayIds.has(dayKey(p._id, d._id))))
      .reduce((sum, d) => sum + dayCostOf(d), 0)
  }, [posts, selectedDayIds])

  function handleMerge() {
    if (!posts) return

    const selections = posts
      .map((post) => ({
        postId: post._id,
        dayIds: post.days.filter((d) => selectedDayIds.has(dayKey(post._id, d._id))).map((d) => d._id),
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
      title={t('Ghép ngày từ bài viết khác')}
      description={t('Chọn những ngày bạn muốn thêm vào lịch trình này. Ngày được ghép sẽ nối vào cuối và đánh số lại.')}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('Huỷ')}
          </Button>
          <GlassButton
            onClick={handleMerge}
            disabled={selectedDayIds.size === 0 || merge.isPending}
          >
            {merge.isPending && <Loader2 className="animate-spin" />}
            {selectedDayIds.size > 0 ? t('Ghép {n} ngày', { n: selectedDayIds.size }) : t('Ghép')}
          </GlassButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="merge-search" className="text-xs">
            {t('Tìm hành trình theo tên hoặc thẻ')}
          </Label>
          <Input id="merge-search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {selectedDayIds.size > 0 && (
          <p className="text-sm text-muted-foreground">
            {tr('Đã chọn {n} ngày · thêm khoảng {cost}', {
              n: selectedDayIds.size,
              cost: <span className="text-foreground">{formatVnd(selectedCost)}</span>,
            })}
          </p>
        )}

        <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
          {isPending &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}

          {filtered.length === 0 && !isPending && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('Không tìm thấy hành trình nào khớp.')}
            </p>
          )}

          {filtered.map((post) => {
            const isExpanded = expandedPostId === post._id
            const selectedInPost = post.days.filter((d) =>
              selectedDayIds.has(dayKey(post._id, d._id)),
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
                      {t('{n} ngày', { n: post.days.length })} · {post.author.displayName}
                      {sourcePostIds.includes(post._id) && ` · ${t('đã ghép trước đó')}`}
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
                            checked={selectedDayIds.has(dayKey(post._id, day._id))}
                            onCheckedChange={() => toggleDay(dayKey(post._id, day._id))}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              {t('Ngày {n}', { n: day.dayNumber })}: {day.title}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {t('{n} điểm dừng', { n: day.locations.length })}
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
