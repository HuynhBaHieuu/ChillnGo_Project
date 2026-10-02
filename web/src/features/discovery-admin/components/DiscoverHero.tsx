import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Clock,
  Globe,
  Hash,
  Landmark,
  MapPin,
  Mountain,
  Plane,
  Sailboat,
  Search,
  TreePalm,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { GlassCard } from '@/components/GlassCard'
import {
  type Suggestion,
  buildSuggestions,
} from '@/features/discovery-admin/searchSuggestions'
import { REGION_LABELS, tripLengthLabel } from '@/lib/format'
import { qk } from '@/lib/queryKeys'
import { cn } from '@/lib/utils'
import { activityService } from '@/services'
import type { Region, TripPostWithAuthor } from '@/services/types'
import { useAuthStore, useViewerId } from '@/store'

/** Each tab re-titles the hero and re-words the search box. */
const TABS: {
  value: Region | 'all'
  label: string
  icon: LucideIcon
  heading: string
  placeholder: string
}[] = [
  {
    value: 'all',
    label: 'Tất cả',
    icon: Globe,
    heading: 'Bạn muốn đi đâu?',
    placeholder: 'Điểm đến, hành trình, thẻ…',
  },
  {
    value: 'north',
    label: REGION_LABELS.north,
    icon: Mountain,
    heading: 'Lên núi săn mây',
    placeholder: 'Hà Giang, Sa Pa, Ninh Bình…',
  },
  {
    value: 'central',
    label: REGION_LABELS.central,
    icon: Landmark,
    heading: 'Về miền di sản',
    placeholder: 'Huế, Hội An, Đà Lạt…',
  },
  {
    value: 'south',
    label: REGION_LABELS.south,
    icon: TreePalm,
    heading: 'Xuôi về phương Nam',
    placeholder: 'Sài Gòn, Cần Thơ, Vũng Tàu…',
  },
  {
    value: 'islands',
    label: REGION_LABELS.islands,
    icon: Sailboat,
    heading: 'Ra đảo thôi',
    placeholder: 'Phú Quốc, Côn Đảo, Cát Bà…',
  },
  {
    value: 'overseas',
    label: REGION_LABELS.overseas,
    icon: Plane,
    heading: 'Đi xa hơn một chút',
    placeholder: 'Bangkok, Seoul, Tokyo…',
  },
]

interface DiscoverHeroProps {
  /** Every published trip, most saved first — the suggestions are drawn from it. */
  posts: TripPostWithAuthor[]
  query: string
  region: Region | 'all'
  onSearch: (query: string) => void
  onRegionChange: (region: Region | 'all') => void
  onPickTag: (tag: string) => void
}

/**
 * "Bạn muốn đi đâu?" — the centred title, region tabs and the search box.
 *
 * Focusing the box dims the page and opens a dropdown: recent searches and
 * popular trips at first, then live matches as the reader types. Arrow keys
 * move through it, Enter opens the highlighted row, Escape closes it.
 */
export function DiscoverHero({
  posts,
  query,
  region,
  onSearch,
  onRegionChange,
  onPickTag,
}: DiscoverHeroProps) {
  const navigate = useNavigate()
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  // The box edits a draft; the results only re-run when the search is submitted.
  const [draft, setDraft] = useState(query)
  // Follow the submitted query when it changes from outside (e.g. "Xóa bộ lọc").
  const [syncedQuery, setSyncedQuery] = useState(query)
  if (query !== syncedQuery) {
    setSyncedQuery(query)
    setDraft(query)
  }

  const [open, setOpen] = useState(false)
  /** Highlighted row; -1 means the text box itself. */
  const [active, setActive] = useState(-1)

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const viewerId = useViewerId()
  const { data: history } = useQuery({
    queryKey: qk.activity.searches(viewerId ?? ''),
    queryFn: activityService.listSearchHistory,
    enabled: isAuthenticated && open,
  })
  const recent = useMemo(
    () => [
      ...new Set(
        (history ?? []).filter((entry) => entry.type === 'journey').map((entry) => entry.query),
      ),
    ],
    [history],
  )

  const groups = useMemo(
    () => buildSuggestions(posts, draft, region, recent),
    [posts, draft, region, recent],
  )
  const options = useMemo(() => groups.flatMap((group) => group.items), [groups])

  const expanded = open && options.length > 0

  // Keep the highlighted row on screen while arrowing through a long list.
  const activeId = expanded && options[active] ? `${listboxId}-${options[active].id}` : undefined
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  const tab = TABS.find((t) => t.value === region) ?? TABS[0]

  function close() {
    setOpen(false)
    setActive(-1)
  }

  function submit(text: string) {
    setDraft(text)
    onSearch(text)
    close()
    inputRef.current?.blur()
  }

  function choose(option: Suggestion) {
    switch (option.kind) {
      case 'recent':
      case 'all':
        submit(option.query)
        break
      case 'trip':
      case 'stop':
        close()
        void navigate(`/posts/${option.post._id}`)
        break
      case 'tag':
        setDraft('')
        close()
        inputRef.current?.blur()
        onPickTag(option.tag)
        break
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      if (options.length === 0) return
      // Cycle through the rows and back to the text box (-1) at either end.
      setActive((i) => {
        const next = i + (e.key === 'ArrowDown' ? 1 : -1)
        if (next >= options.length) return -1
        if (next < -1) return options.length - 1
        return next
      })
      return
    }
    if (e.key === 'Escape') {
      close()
      inputRef.current?.blur()
      return
    }
    if (e.key === 'Enter' && expanded && options[active]) {
      e.preventDefault()
      choose(options[active])
    }
  }

  return (
    <>
      {/* Dims the page under the open dropdown; a click on it closes the dropdown. */}
      <div
        aria-hidden
        className={cn(
          'fixed inset-0 z-20 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200',
          expanded ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <header className="animate-fade-rise relative z-30 mx-auto flex max-w-3xl flex-col items-center text-center">
        <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          {tab.heading}
        </h1>

        <div
          role="tablist"
          aria-label="Khu vực"
          className="mt-10 flex max-w-full gap-6 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
        >
          {TABS.map(({ value, label, icon: Icon }) => {
            const selected = region === value
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onRegionChange(value)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 border-b-2 pb-2 text-base transition-colors',
                  selected
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-5" />
                {label}
              </button>
            )
          })}
        </div>

        <div className="relative mt-6 w-full">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              submit(draft.trim())
            }}
            className="liquid-glass flex w-full items-center gap-3 rounded-full py-2 pl-5 pr-2"
          >
            <Search className="relative z-[1] size-5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-label="Tìm hành trình"
              aria-autocomplete="list"
              aria-expanded={expanded}
              aria-controls={listboxId}
              aria-activedescendant={activeId}
              autoComplete="off"
              value={draft}
              placeholder={tab.placeholder}
              onChange={(e) => {
                setDraft(e.target.value.slice(0, 120))
                setActive(-1)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              // Clicking anywhere outside (including the dimmed page) blurs the box.
              onBlur={close}
              onKeyDown={onKeyDown}
              className="relative z-[1] min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground"
            />
            <GlassButton type="submit" tone="sunset" className="relative z-[1] rounded-full">
              Tìm kiếm
            </GlassButton>
          </form>

          {expanded && (
            <GlassCard className="np-featured absolute inset-x-0 top-full mt-2 max-h-[min(70vh,36rem)] overflow-y-auto p-2 text-left">
              <ul id={listboxId} role="listbox" aria-label="Gợi ý tìm kiếm">
                {groups.map((group) => (
                  <li key={group.label ?? 'footer'} role="presentation">
                    {group.label && (
                      <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
                        {group.label}
                      </p>
                    )}
                    <ul role="presentation">
                      {group.items.map((option) => {
                        const index = options.indexOf(option)
                        return (
                          <SuggestionRow
                            key={option.id}
                            id={`${listboxId}-${option.id}`}
                            option={option}
                            active={index === active}
                            // Keep focus in the box, or blur would close the list before the click lands.
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => choose(option)}
                          />
                        )
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}
        </div>
      </header>
    </>
  )
}

interface SuggestionRowProps extends React.ComponentProps<'li'> {
  option: Suggestion
  active: boolean
}

function SuggestionRow({ option, active, ...props }: SuggestionRowProps) {
  let media: React.ReactNode
  let title: React.ReactNode
  let subtitle: string | null = null

  switch (option.kind) {
    case 'recent':
      media = <RowIcon icon={Clock} />
      title = option.query
      break
    case 'trip':
      media = <RowThumb src={option.post.coverUrl} />
      title = option.post.title
      subtitle = `${REGION_LABELS[option.post.region]} · ${tripLengthLabel(option.post.days.length)}`
      break
    case 'stop':
      media = <RowIcon icon={MapPin} />
      title = option.name
      subtitle = `Trong hành trình: ${option.post.title}`
      break
    case 'tag':
      media = <RowIcon icon={Hash} />
      title = option.tag
      subtitle = `${option.count} hành trình`
      break
    case 'all':
      media = <RowIcon icon={Search} />
      title = (
        <>
          Xem tất cả kết quả cho “<span className="font-semibold">{option.query}</span>”
        </>
      )
      break
  }

  return (
    <li
      role="option"
      aria-selected={active}
      className={cn(
        'flex cursor-pointer items-center gap-4 rounded-xl px-3 py-2.5 transition-colors',
        active && 'bg-white/[0.07]',
      )}
      {...props}
    >
      {media}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {subtitle && (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        )}
      </span>
      {option.kind === 'all' && <ArrowRight className="size-4 shrink-0 text-muted-foreground" />}
    </li>
  )
}

function RowThumb({ src }: { src: string }) {
  return (
    <span className="np-media size-12 shrink-0 overflow-hidden rounded-lg">
      <img src={src} alt="" loading="lazy" className="size-full rounded-[inherit] object-cover" />
    </span>
  )
}

function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="np-well grid size-12 shrink-0 place-items-center rounded-lg">
      <Icon className="size-5 text-muted-foreground" />
    </span>
  )
}
