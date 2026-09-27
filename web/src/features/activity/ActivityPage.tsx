import { Bookmark, ChevronLeft, ChevronRight, Clock, Heart, Images, Map as MapIcon, Search, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { AccountHistorySection } from '@/features/activity/sections/AccountHistorySection'
import { InteractionsSection } from '@/features/activity/sections/InteractionsSection'
import { JourneysSection } from '@/features/activity/sections/JourneysSection'
import { MediaSection } from '@/features/activity/sections/MediaSection'
import { RecentlyDeletedSection } from '@/features/activity/sections/RecentlyDeletedSection'
import { SavedSection } from '@/features/activity/sections/SavedSection'
import { SearchHistorySection } from '@/features/activity/sections/SearchHistorySection'
import { cn } from '@/lib/utils'

interface Section {
  slug: string
  label: string
  hint: string
  icon: LucideIcon
  render: () => React.ReactNode
}

/** The page's own navigation. Not part of the site's main navigation. */
const SECTIONS: Section[] = [
  { slug: 'interactions', label: 'Lượt tương tác', hint: 'Lượt thích, bình luận, chia sẻ lại, phản hồi tin và đánh giá', icon: Heart, render: () => <InteractionsSection /> },
  { slug: 'media', label: 'Ảnh và video', hint: 'Bài viết, video, tin và phát trực tiếp', icon: Images, render: () => <MediaSection /> },
  { slug: 'journeys', label: 'Hành trình', hint: 'Hành trình nháp chưa đăng', icon: MapIcon, render: () => <JourneysSection /> },
  { slug: 'search-history', label: 'Lịch sử tìm kiếm', hint: 'Những gì bạn đã tìm', icon: Search, render: () => <SearchHistorySection /> },
  { slug: 'account-history', label: 'Lịch sử tài khoản', hint: 'Các thay đổi trên tài khoản', icon: Clock, render: () => <AccountHistorySection /> },
  { slug: 'recently-deleted', label: 'Đã xoá gần đây', hint: 'Khôi phục trong 30 ngày', icon: Trash2, render: () => <RecentlyDeletedSection /> },
  { slug: 'saved', label: 'Đã lưu', hint: 'Hành trình bạn đã lưu', icon: Bookmark, render: () => <SavedSection /> },
]

/**
 * /activity/:section — Hoạt động của bạn, mở từ menu avatar.
 *
 * Desktop (lg+): the section list on the left, the open section on the right;
 * /activity shows Lượt tương tác. Phones and tablets: /activity is the section
 * list on its own, and a section opens as its own screen with a way back,
 * the way a settings app works, rather than a squeezed two-column layout.
 */
export function ActivityPage() {
  const { section: slug } = useParams<{ section?: string }>()
  const section = slug ? SECTIONS.find((s) => s.slug === slug) : undefined

  if (slug && !section) return <Navigate to="/activity" replace />

  const shown = section ?? SECTIONS[0]

  return (
    <PageContainer>
      {/* minmax(0, …): long hints truncate instead of widening the page on phones. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
        {/* Section list: always on desktop; on smaller screens only at /activity. */}
        <aside className={cn('min-w-0 lg:block', section && 'hidden')}>
          <div className="lg:sticky lg:top-28">
            <div className="animate-fade-rise mb-6 lg:mb-5 lg:px-2">
              <h1 className="font-display text-4xl leading-[1.05] tracking-tight lg:text-3xl">Hoạt động của bạn</h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground lg:text-[13px]">
                Xem lại và quản lý mọi hoạt động của bạn trên ChillnGo.
              </p>
            </div>
            <nav aria-label="Các mục trong Hoạt động của bạn" className="liquid-glass np-surface rounded-2xl p-2">
              <ul className="space-y-0.5">
                {SECTIONS.map((s) => (
                  <li key={s.slug}>
                    <SectionLink section={s} active={s.slug === shown.slug} />
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        {/* The open section: always on desktop; on smaller screens only at /activity/:section. */}
        <section aria-label={shown.label} className={cn('min-w-0', !section && 'hidden lg:block')}>
          <Link
            to="/activity"
            className="mb-5 inline-flex items-center gap-1 rounded-full py-1 pr-3 text-sm font-medium text-muted-foreground transition-colors hover:text-np-cream lg:hidden"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Hoạt động của bạn
          </Link>
          <div key={shown.slug} className="animate-fade-rise">
            {shown.render()}
          </div>
        </section>
      </div>
    </PageContainer>
  )
}

function SectionLink({ section, active }: { section: Section; active: boolean }) {
  const Icon = section.icon
  return (
    <Link
      to={`/activity/${section.slug}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-200',
        'hover:bg-np-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        // Only the desktop list marks where you are; on phones the list is a menu.
        active && 'lg:bg-np-raised lg:shadow-[inset_0_1px_0_hsl(var(--np-beige)/0.08)]',
      )}
    >
      {active && <span aria-hidden className="absolute inset-y-2.5 left-0 hidden w-[3px] rounded-r bg-primary lg:block" />}
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full bg-np-well text-np-sage transition-colors',
          active && 'lg:text-primary',
        )}
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[15px] font-semibold text-np-body', active && 'lg:text-np-cream')}>{section.label}</span>
        <span className="block truncate text-xs text-np-meta">{section.hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-np-meta lg:hidden" aria-hidden />
    </Link>
  )
}
