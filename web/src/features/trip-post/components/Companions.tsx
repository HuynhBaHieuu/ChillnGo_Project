import { Loader2, Search, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  useFriends,
  useInviteCompanions,
  useRemoveCompanion,
  useRespondToInvite,
} from '@/features/trip-post/hooks'
import { cn } from '@/lib/utils'
import type { TripPostWithAuthor } from '@/services/types'

/** As server/src/lib/companions.ts allows. */
const MAX_COMPANIONS = 10

/**
 * "Đi cùng": the friends who came along. The author also sees pending invites
 * and can take anyone off; a companion can leave.
 */
export function CompanionsRow({ post, viewerId }: { post: TripPostWithAuthor; viewerId: string | undefined }) {
  const remove = useRemoveCompanion(post._id)
  const isAuthor = viewerId === post.authorId
  // An invitee's own pending invite is the banner's to show.
  const shown = (post.companions ?? []).filter((c) => c.status === 'accepted' || isAuthor)
  if (shown.length === 0) return null

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Đi cùng</span>
      {shown.map(({ user, status }) => {
        const canRemove = isAuthor || user._id === viewerId
        return (
          <span
            key={user._id}
            className={cn(
              'flex items-center gap-1.5 rounded-full border border-border py-1 pl-1 pr-2 text-xs',
              status === 'pending' && 'opacity-60',
            )}
          >
            <Link to={`/users/${user._id}`} className="flex items-center gap-1.5 hover:underline">
              <Avatar className="size-6">
                <AvatarImage src={user.avatarUrl} alt="" />
                <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
              </Avatar>
              {user.displayName}
            </Link>
            {status === 'pending' && <span className="text-muted-foreground">· đang chờ</span>}
            {canRemove && (
              <button
                type="button"
                aria-label={user._id === viewerId ? 'Rời hành trình' : `Gỡ ${user.displayName}`}
                title={user._id === viewerId ? 'Rời hành trình' : 'Gỡ khỏi hành trình'}
                disabled={remove.isPending}
                onClick={() => remove.mutate(user._id)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        )
      })}
      {remove.isError && <p className="w-full text-xs text-destructive">{(remove.error as Error).message}</p>}
    </div>
  )
}

/** Shown to someone the author invited, until they answer. */
export function InviteBanner({ post, viewerId }: { post: TripPostWithAuthor; viewerId: string | undefined }) {
  const respond = useRespondToInvite(post._id)
  const navigate = useNavigate()
  const pending = post.companions?.some((c) => c.userId === viewerId && c.status === 'pending')
  if (!pending) return null

  function answer(accept: boolean) {
    respond.mutate(accept, {
      // Declining a draft takes it out of your sight.
      onSuccess: () => {
        if (!accept && post.status !== 'published') void navigate('/feed')
      },
    })
  }

  return (
    <div className="animate-fade-rise mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-border p-4">
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{post.author.displayName}</span>{' '}
        <span className="text-muted-foreground">mời bạn đi cùng hành trình này.</span>
      </p>
      <Button variant="ghost" size="sm" disabled={respond.isPending} onClick={() => answer(false)}>
        Từ chối
      </Button>
      <GlassButton size="sm" disabled={respond.isPending} onClick={() => answer(true)}>
        {respond.isPending && <Loader2 className="animate-spin" />}
        Đi cùng
      </GlassButton>
      {respond.isError && <p className="w-full text-xs text-destructive">{(respond.error as Error).message}</p>}
    </div>
  )
}

interface InviteFriendsDialogProps {
  post: TripPostWithAuthor
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Pick friends to invite along. Those already on the journey are left out. */
export function InviteFriendsDialog({ post, open, onOpenChange }: InviteFriendsDialogProps) {
  const friends = useFriends(open)
  const invite = useInviteCompanions(post._id)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string[]>([])

  // Fresh each time it opens (see CloneDialog).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQuery('')
      setPicked([])
      invite.reset()
    }
  }

  const taken = new Set((post.companions ?? []).map((c) => c.userId))
  const left = MAX_COMPANIONS - taken.size
  const needle = query.trim().toLowerCase()
  const candidates = (friends.data ?? [])
    .filter((f) => !taken.has(f._id))
    .filter((f) => !needle || f.displayName.toLowerCase().includes(needle) || f.username.toLowerCase().includes(needle))

  function toggle(id: string) {
    setPicked((now) => (now.includes(id) ? now.filter((p) => p !== id) : [...now, id]))
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Mời bạn đi cùng"
      description={`Bạn bè là những người bạn theo dõi và cũng theo dõi bạn. Còn mời được ${left} người.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <GlassButton
            disabled={picked.length === 0 || picked.length > left || invite.isPending}
            onClick={() => invite.mutate(picked, { onSuccess: () => onOpenChange(false) })}
          >
            {invite.isPending && <Loader2 className="animate-spin" />}
            Gửi lời mời{picked.length > 0 && ` (${picked.length})`}
          </GlassButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm bạn bè"
            aria-label="Tìm bạn bè"
            className="pl-9"
          />
        </div>

        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {friends.isPending && (
            <li className="flex justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </li>
          )}
          {friends.isError && <li className="text-sm text-destructive">{(friends.error as Error).message}</li>}
          {friends.isSuccess && candidates.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              {needle ? 'Không tìm thấy ai.' : 'Chưa có bạn bè nào để mời.'}
            </li>
          )}
          {candidates.map((friend) => (
            <li key={friend._id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
                <Checkbox checked={picked.includes(friend._id)} onCheckedChange={() => toggle(friend._id)} />
                <Avatar className="size-8">
                  <AvatarImage src={friend.avatarUrl} alt="" />
                  <AvatarFallback>{friend.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm">{friend.displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{friend.username}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {picked.length > left && <p className="text-sm text-destructive">Chỉ còn mời được {left} người.</p>}
        {invite.isError && <p className="text-sm text-destructive">{(invite.error as Error).message}</p>}
      </div>
    </Modal>
  )
}
