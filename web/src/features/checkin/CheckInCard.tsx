import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, MapPin, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/features/discovery-admin/admin/shared'
import { feelingOption, feelingSentence } from '@/lib/feelings'
import { relativeTime } from '@/lib/format'
import { googleMapsUrl, staticMapUrl } from '@/lib/geo'
import { cn } from '@/lib/utils'
import { checkinService } from '@/services'
import type { CheckIn } from '@/services/checkin.service'

/** A photo check-in in the Newsfeed. */
export function CheckInCard({ checkin, viewerId }: { checkin: CheckIn; viewerId: string | null }) {
  const { author, location, photos } = checkin
  const feeling = feelingOption(checkin.feeling)
  const isMine = viewerId === author._id

  return (
    <GlassCard as="article" className="np-checkin p-4 sm:p-5">
      <div className="space-y-4">
        <header className="flex items-start gap-3">
          <Link to={`/users/${author._id}`} className="shrink-0">
            <Avatar className="size-11 ring-2 ring-np-moss/40">
              <AvatarImage src={author.avatarUrl} alt="" />
              <AvatarFallback>{author.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0 flex-1 text-sm leading-snug">
            <p>
              <Link to={`/users/${author._id}`} className="font-semibold text-np-cream hover:underline">
                {author.displayName}
              </Link>
              {/* "Minh đang cảm thấy 😌 thư giãn tại 📍 Phố Cổ Hội An" */}
              {feeling && (
                <>
                  {' '}
                  <span className="text-muted-foreground">{feelingSentence(feeling).lead}</span>{' '}
                  <span className="font-semibold">
                    <span aria-hidden>{feeling.emoji} </span>
                    {feelingSentence(feeling).what}
                  </span>
                </>
              )}
              {location && (
                <>
                  {' '}
                  <span className="text-muted-foreground">{feeling ? 'tại' : 'đã check-in tại'}</span>{' '}
                  <span className="font-semibold">
                    <span aria-hidden>📍 </span>
                    {location.name}
                  </span>
                </>
              )}
              {!feeling && !location && (
                <span className="text-muted-foreground"> {photos.length > 0 ? 'đã chia sẻ ảnh' : 'đã chia sẻ'}</span>
              )}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
              <time dateTime={checkin.createdAt}>{relativeTime(checkin.createdAt)}</time>
            </p>
          </div>
          {isMine && <DeleteCheckIn id={checkin._id} />}
        </header>

        {checkin.caption && <p className="whitespace-pre-line text-[15px] leading-relaxed">{checkin.caption}</p>}

        <PhotoGrid photos={photos} />

        {location && <LocationStrip location={location} />}
      </div>
    </GlassCard>
  )
}

/**
 * 1 photo: one wide frame. 2: side by side. 3: one tall plus two stacked.
 * 4: a 2×2 grid. The grid has a fixed height, so photos never grow into
 * giant squares on wide screens. Clicking a photo opens it full size.
 */
function PhotoGrid({ photos }: { photos: CheckIn['photos'] }) {
  if (photos.length === 0) return null
  const count = photos.length

  return (
    <div
      className={cn(
        'np-media grid gap-1.5 overflow-hidden',
        count === 1 ? 'aspect-[16/10] max-h-[30rem] grid-cols-1' : 'h-72 grid-cols-2 sm:h-96',
        count >= 3 && 'grid-rows-2',
      )}
    >
      {photos.map((photo, i) => (
        <a
          key={photo.url}
          href={photo.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Xem ảnh ${i + 1} cỡ lớn`}
          className={cn('block min-h-0 overflow-hidden bg-np-canopy', count === 3 && i === 0 && 'row-span-2')}
        >
          <img
            src={photo.url}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 hover:scale-[1.02] motion-reduce:transition-none"
          />
        </a>
      ))}
    </div>
  )
}

function LocationStrip({ location }: { location: NonNullable<CheckIn['location']> }) {
  // 1200×200 matches the card width on desktop; phones crop it to 3:1 around the pin.
  const map = staticMapUrl(location.lat, location.lng, 1200, 200)

  return (
    <a
      href={googleMapsUrl(location.lat, location.lng)}
      target="_blank"
      rel="noreferrer"
      className="np-well group block overflow-hidden rounded-[12px] transition-colors hover:border-np-beige/15"
    >
      {map && <img src={map} alt="" loading="lazy" className="aspect-[3/1] w-full object-cover sm:aspect-[6/1]" />}
      <div className="flex items-center gap-3 px-3 py-2.5 text-sm">
        <MapPin className="size-4 shrink-0 text-[hsl(var(--np-ochre))]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-np-cream">{location.name}</p>
          {location.address && <p className="truncate text-xs text-muted-foreground">{location.address}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
          Chỉ đường
          <ExternalLink className="size-3.5" aria-hidden />
        </span>
      </div>
    </a>
  )
}

function DeleteCheckIn({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const remove = useMutation({
    mutationFn: () => checkinService.deleteCheckIn(id),
    onSuccess: () => {
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['checkins'] })
    },
  })

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Xoá check-in" onClick={() => setOpen(true)} className="shrink-0 rounded-full">
        <Trash2 className="size-4" aria-hidden />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Xoá check-in"
        description={
          <>
            Check-in sẽ được chuyển vào mục Đã xoá gần đây (Hoạt động của bạn) và có thể khôi phục trong 30 ngày.
            {remove.isError && <span className="mt-2 block text-destructive">{(remove.error as Error).message}</span>}
          </>
        }
        confirmLabel="Xoá"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  )
}
