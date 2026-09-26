import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { GlassCard } from '@/components/GlassCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useLiveNow } from '@/features/livestream/useLiveNow'

/**
 * A row of everyone live right now, at the top of the Newsfeed. Unlike the
 * feed cards it is not limited to the people you follow. Hidden when nobody is live.
 */
export function LiveNowStrip() {
  const { data } = useLiveNow()
  if (!data?.length) return null

  return (
    <GlassCard as="section" aria-label="Đang phát trực tiếp" className="animate-fade-rise mb-6 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="relative flex size-2.5" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-500/70 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-rose-600" />
          </span>
          Đang live · {data.length}
        </h2>
        <Link to="/live" className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
          Xem tất cả
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
        {data.map((stream) => (
          <li key={stream._id} className="shrink-0">
            <Link
              to={`/live/${stream._id}`}
              title={stream.title}
              className="group flex w-[4.5rem] flex-col items-center gap-1.5 text-center"
            >
              <span className="relative">
                <Avatar className="size-14 ring-2 ring-rose-600 ring-offset-2 ring-offset-card transition-transform group-hover:scale-105">
                  <AvatarImage src={stream.host.avatarUrl} alt="" />
                  <AvatarFallback>{stream.host.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-rose-600 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-white">
                  Live
                </span>
              </span>
              <span className="mt-1 w-full truncate text-xs">{stream.host.displayName}</span>
            </Link>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
