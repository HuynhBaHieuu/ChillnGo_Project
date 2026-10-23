import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useClonePost } from '@/features/itinerary-clone/hooks'
import { t } from '@/i18n'
import { formatVnd, tripLengthLabel } from '@/lib/format'
import type { TripPostWithAuthor } from '@/services/types'

interface CloneDialogProps {
  post: TripPostWithAuthor
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Start of the clone flow.
 *
 * Lets the user name the copy and pick a start date, then hands off to
 * `clonePost` and navigates to the new itinerary. The re-dating and the copy
 * itself are stubbed in the service — see `itinerary.service.ts`.
 */
export function CloneDialog({ post, open, onOpenChange }: CloneDialogProps) {
  const [title, setTitle] = useState(t('{title} (bản của tôi)', { title: post.title }))
  const [startDate, setStartDate] = useState(post.startDate)
  const clonePost = useClonePost()
  const navigate = useNavigate()

  // Reset the form each time the dialog opens so a previous edit never leaks in.
  // Adjusting state during render (rather than in an effect) is React's own
  // pattern for this: it re-renders before painting, with no extra frame.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTitle(t('{title} (bản của tôi)', { title: post.title }))
      setStartDate(post.startDate)
    }
  }

  function handleClone() {
    clonePost.mutate(
      { postId: post._id, title, startDate },
      {
        onSuccess: (itinerary) => {
          onOpenChange(false)
          void navigate(`/itineraries/${itinerary._id}`)
        },
      },
    )
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('Dùng làm lịch trình của tôi')}
      description={t('Sao chép {n} ngày từ hành trình này thành lịch trình của riêng bạn. Bạn có thể sửa, đổi thứ tự và ghép thêm ngày từ bài khác sau.', { n: post.days.length })}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('Huỷ')}
          </Button>
          <GlassButton onClick={handleClone} disabled={clonePost.isPending}>
            {clonePost.isPending && <Loader2 className="animate-spin" />}
            {t('Clone hành trình')}
          </GlassButton>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-2xl border border-border p-3">
          <img
            src={post.coverUrl}
            alt=""
            className="size-14 shrink-0 rounded-2xl object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{post.title}</p>
            <p className="text-xs text-muted-foreground">
              {tripLengthLabel(post.days.length)} · {formatVnd(post.totalEstCost)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="clone-title">{t('Tên lịch trình')}</Label>
          <Input
            id="clone-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clone-start">{t('Ngày khởi hành')}</Label>
          <Input
            id="clone-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t('Các ngày trong lịch trình sẽ được đánh lại từ ngày này.')}
          </p>
        </div>

        {clonePost.isError && (
          <p className="text-sm text-destructive">
            {(clonePost.error as Error).message}
          </p>
        )}
      </div>
    </Modal>
  )
}
