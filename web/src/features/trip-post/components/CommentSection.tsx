import { Loader2, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { GlassCard } from '@/components/GlassCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAddComment, useComments } from '@/features/trip-post/hooks'
import { formatCount, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CommentThread } from '@/services/types'
import { useAuthStore } from '@/store'

interface CommentSectionProps {
  postId: string
  commentCount: number
}

export function CommentSection({ postId, commentCount }: CommentSectionProps) {
  const { data: threads, isPending } = useComments(postId)
  const addComment = useAddComment(postId)
  const user = useAuthStore((s) => s.user)

  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')

  function submitRoot(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim()) return
    addComment.mutate(
      { content: draft, parentId: null },
      { onSuccess: () => setDraft('') },
    )
  }

  function submitReply(event: FormEvent, parentId: string) {
    event.preventDefault()
    if (!replyDraft.trim()) return
    addComment.mutate(
      { content: replyDraft, parentId },
      {
        onSuccess: () => {
          setReplyDraft('')
          setReplyTo(null)
        },
      },
    )
  }

  return (
    <section id="comments" className="scroll-mt-32">
      <h2 className="font-display text-3xl">
        Bình luận{' '}
        <span className="text-muted-foreground">{formatCount(commentCount)}</span>
      </h2>

      {/* New comment */}
      <GlassCard className="mt-6 p-5">
        {user ? (
          <form onSubmit={submitRoot} className="flex gap-3">
            <Avatar className="mt-1 size-9 shrink-0">
              <AvatarImage src={user.avatarUrl} alt="" />
              <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Viết bình luận"
                rows={3}
              />
              <div className="flex justify-end">
                <GlassButton
                  type="submit"
                  disabled={!draft.trim() || addComment.isPending}
                >
                  {addComment.isPending && <Loader2 className="animate-spin" />}
                  Gửi bình luận
                </GlassButton>
              </div>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link to="/login" className="text-foreground underline-offset-4 hover:underline">
              Đăng nhập
            </Link>{' '}
            để tham gia bình luận.
          </p>
        )}
      </GlassCard>

      {/* Threads */}
      <div className="mt-6 space-y-6">
        {isPending &&
          [0, 1].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}

        {threads?.length === 0 && (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <MessageCircle className="size-4" />
            Chưa có bình luận nào. Hãy là người đầu tiên.
          </p>
        )}

        {threads?.map((thread) => (
          <CommentItem
            key={thread._id}
            comment={thread}
            canReply={Boolean(user)}
            isReplying={replyTo === thread._id}
            replyDraft={replyDraft}
            onReplyDraftChange={setReplyDraft}
            onToggleReply={() => {
              setReplyTo((current) => (current === thread._id ? null : thread._id))
              setReplyDraft('')
            }}
            onSubmitReply={(event) => submitReply(event, thread._id)}
            isSubmitting={addComment.isPending}
          />
        ))}
      </div>
    </section>
  )
}

interface CommentItemProps {
  comment: CommentThread
  canReply: boolean
  isReplying: boolean
  replyDraft: string
  onReplyDraftChange: (value: string) => void
  onToggleReply: () => void
  onSubmitReply: (event: FormEvent) => void
  isSubmitting: boolean
  nested?: boolean
}

function CommentItem({
  comment,
  canReply,
  isReplying,
  replyDraft,
  onReplyDraftChange,
  onToggleReply,
  onSubmitReply,
  isSubmitting,
  nested = false,
}: CommentItemProps) {
  return (
    <article className={cn('flex gap-3', nested && 'pl-4 sm:pl-6')}>
      <Link to={`/users/${comment.author._id}`} className="shrink-0">
        <Avatar className={cn('mt-0.5', nested ? 'size-7' : 'size-9')}>
          <AvatarImage src={comment.author.avatarUrl} alt="" />
          <AvatarFallback>{comment.author.displayName.charAt(0)}</AvatarFallback>
        </Avatar>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link
            to={`/users/${comment.author._id}`}
            className="text-sm font-medium hover:underline"
          >
            {comment.author.displayName}
          </Link>
          <time dateTime={comment.createdAt} className="text-xs text-muted-foreground">
            {relativeTime(comment.createdAt)}
          </time>
        </div>

        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {comment.content}
        </p>

        {!nested && canReply && (
          <button
            type="button"
            onClick={onToggleReply}
            className="mt-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {isReplying ? 'Huỷ' : 'Trả lời'}
          </button>
        )}

        {isReplying && (
          <form onSubmit={onSubmitReply} className="mt-3 space-y-2">
            <Textarea
              value={replyDraft}
              onChange={(e) => onReplyDraftChange(e.target.value)}
              aria-label={`Trả lời ${comment.author.displayName}`}
              rows={2}
              autoFocus
            />
            <div className="flex justify-end">
              <GlassButton
                type="submit"
                size="sm"
                disabled={!replyDraft.trim() || isSubmitting}
              >
                {isSubmitting && <Loader2 className="animate-spin" />}
                Gửi
              </GlassButton>
            </div>
          </form>
        )}

        {comment.replies.length > 0 && (
          <div className="mt-5 space-y-5 border-l border-border">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply._id}
                comment={reply}
                nested
                canReply={false}
                isReplying={false}
                replyDraft=""
                onReplyDraftChange={() => {}}
                onToggleReply={() => {}}
                onSubmitReply={() => {}}
                isSubmitting={false}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
