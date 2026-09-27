import { AlertTriangle, RotateCcw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/features/discovery-admin/admin/shared'
import { cn } from '@/lib/utils'

/** The title block at the top of each section. */
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">{title}</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

export interface TabDef {
  value: string
  label: string
  /** Rendered when the tab is open. */
  content: React.ReactNode
}

/**
 * Tabs whose open tab lives in `?tab=`, so a tab can be linked to and survives
 * a reload, the same way the profile page's tabs work.
 */
export function ActivityTabs({ tabs, label }: { tabs: TabDef[]; label: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const param = searchParams.get('tab')
  const active = tabs.some((t) => t.value === param) ? (param as string) : tabs[0].value

  return (
    <Tabs
      value={active}
      onValueChange={(value) => {
        const next = new URLSearchParams(searchParams)
        next.set('tab', value)
        setSearchParams(next, { replace: true })
      }}
    >
      {/* Scrolls sideways on phones instead of wrapping into a second row. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList aria-label={label} className="np-well border-transparent">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="animate-fade-rise">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}

/** Placeholder rows while a list loads. `media`: square tiles instead of rows. */
export function ListSkeleton({ rows = 4, media = false }: { rows?: number; media?: boolean }) {
  if (media) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-[14px]" />
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-[14px] bg-np-card/60 p-3">
          <Skeleton className="size-16 shrink-0 rounded-[10px]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** A list that failed to load, with a way to try again. */
export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
      <AlertTriangle className="mb-3 size-6 text-destructive" aria-hidden />
      <p className="font-display text-xl">Không tải được nội dung</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {error instanceof Error ? error.message : 'Đã có lỗi xảy ra. Vui lòng thử lại.'}
      </p>
      <Button variant="outline" size="sm" className="mt-5 rounded-full" onClick={onRetry}>
        <RotateCcw aria-hidden />
        Thử lại
      </Button>
    </div>
  )
}

/** Nothing here yet. */
export function Empty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-np-beige/15 px-6 py-14 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-np-well text-np-sage shadow-[inset_0_1px_2px_hsl(var(--np-shadow)/0.5)]">
        <Icon className="size-6" strokeWidth={1.6} aria-hidden />
      </span>
      <p className="font-display text-xl">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/**
 * A part of Your Activity whose feature ChillnGo does not have yet (stories,
 * reposts, reviews). Says so plainly instead of showing an empty list that
 * suggests there is simply no activity.
 */
export function NotAvailable({ icon, feature, description }: { icon: LucideIcon; feature: string; description: string }) {
  return <Empty icon={icon} title={`ChillnGo chưa có ${feature}`} description={description} />
}

/** A thumbnail that falls back to a quiet tile when there is no image. */
export function Thumb({
  src,
  className,
  children,
}: {
  src?: string | null
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn('np-media relative shrink-0 overflow-hidden rounded-[10px] bg-np-well', className)}>
      {src && <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />}
      {children}
    </div>
  )
}

/** One row in an activity list. */
export function Row({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <li
      className={cn(
        'group flex items-center gap-4 rounded-[14px] border border-transparent p-3 transition-colors duration-200',
        'hover:border-np-beige/10 hover:bg-np-card/70',
        className,
      )}
    >
      {children}
    </li>
  )
}

/** Hộp xác nhận cho các thao tác xoá ở đây. */
export function Confirm(props: React.ComponentProps<typeof ConfirmDialog>) {
  return <ConfirmDialog {...props} />
}
