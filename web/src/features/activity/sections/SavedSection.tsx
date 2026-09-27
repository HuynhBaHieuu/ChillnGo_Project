import { Bookmark, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ActivityTabs, Empty, ErrorPanel, ListSkeleton, NotAvailable, SectionHeader } from '@/features/activity/components'
import { journeyStats } from '@/features/activity/format'
import { useSavedJourneys, useUnsave } from '@/features/activity/hooks'

export function SavedSection() {
  return (
    <>
      <SectionHeader title="Đã lưu" description="Những hành trình bạn đã lưu để xem lại. Chỉ mình bạn thấy được mục này." />
      <ActivityTabs
        label="Loại đã lưu"
        tabs={[
          { value: 'journeys', label: 'Hành trình', content: <SavedJourneys /> },
          {
            value: 'places',
            label: 'Địa điểm',
            content: (
              <NotAvailable
                icon={MapPin}
                feature="tính năng lưu địa điểm"
                description="Tính năng lưu từng địa điểm sắp có. Hiện tại, hãy lưu hành trình có địa điểm đó."
              />
            ),
          },
        ]}
      />
    </>
  )
}

function SavedJourneys() {
  const saved = useSavedJourneys()
  const unsave = useUnsave()

  if (saved.isPending) return <ListSkeleton rows={6} media />
  if (saved.isError) return <ErrorPanel error={saved.error} onRetry={() => void saved.refetch()} />
  if (saved.data.length === 0) {
    return (
      <Empty
        icon={Bookmark}
        title="Chưa lưu gì"
        description="Bấm biểu tượng lưu ở một hành trình để giữ nó ở đây xem sau."
        action={
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/discover">Khám phá hành trình</Link>
          </Button>
        }
      />
    )
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {saved.data.map((post) => (
        <li key={post._id} className="liquid-glass group relative flex flex-col overflow-hidden rounded-2xl">
          <Link to={`/posts/${post._id}`} className="block">
            <div className="aspect-[16/10] overflow-hidden bg-np-well">
              <img
                src={post.coverUrl}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
              />
            </div>
            <div className="p-4">
              <p className="line-clamp-2 font-display text-lg leading-snug text-np-cream group-hover:underline">{post.title}</p>
              <p className="mt-1 truncate text-[13px] text-muted-foreground">
                của {post.author.displayName} · {journeyStats(post)}
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => unsave.mutate(post._id)}
            disabled={unsave.isPending && unsave.variables === post._id}
            aria-label={`Bỏ lưu ${post.title}`}
            title="Bỏ lưu"
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-np-canopy/75 text-np-cream transition-colors hover:bg-np-canopy disabled:opacity-50"
          >
            <Bookmark className="size-4 fill-current" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}
