import { Globe, Landmark, Mountain, Plane, Sailboat, Search, TreePalm } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { GlassButton } from '@/components/Button'
import { REGION_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Region } from '@/services/types'

const TABS: { value: Region | 'all'; label: string; icon: LucideIcon }[] = [
  { value: 'all', label: 'Tất cả', icon: Globe },
  { value: 'north', label: REGION_LABELS.north, icon: Mountain },
  { value: 'central', label: REGION_LABELS.central, icon: Landmark },
  { value: 'south', label: REGION_LABELS.south, icon: TreePalm },
  { value: 'islands', label: REGION_LABELS.islands, icon: Sailboat },
  { value: 'overseas', label: REGION_LABELS.overseas, icon: Plane },
]

interface DiscoverHeroProps {
  query: string
  region: Region | 'all'
  onSearch: (query: string) => void
  onRegionChange: (region: Region | 'all') => void
}

/** "Bạn muốn đi đâu?" — the centred title, region tabs and the search pill. */
export function DiscoverHero({ query, region, onSearch, onRegionChange }: DiscoverHeroProps) {
  // The box edits a draft; the list only re-runs when the search is submitted.
  const [draft, setDraft] = useState(query)
  // Follow the submitted query when it changes from outside (e.g. "Xóa bộ lọc").
  const [syncedQuery, setSyncedQuery] = useState(query)
  if (query !== syncedQuery) {
    setSyncedQuery(query)
    setDraft(query)
  }

  return (
    <header className="animate-fade-rise mx-auto flex max-w-3xl flex-col items-center text-center">
      <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
        Bạn muốn đi đâu?
      </h1>

      <div
        role="tablist"
        aria-label="Khu vực"
        className="mt-10 flex max-w-full gap-6 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
      >
        {TABS.map(({ value, label, icon: Icon }) => {
          const active = region === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onRegionChange(value)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 border-b-2 pb-2 text-base transition-colors',
                active
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

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          onSearch(draft.trim())
        }}
        className="liquid-glass mt-6 flex w-full items-center gap-3 rounded-full py-2 pl-5 pr-2"
      >
        <Search className="relative z-[1] size-5 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 120))}
          placeholder="Điểm đến, hành trình, thẻ…"
          aria-label="Tìm hành trình"
          className="relative z-[1] min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground"
        />
        <GlassButton type="submit" tone="sunset" className="relative z-[1] rounded-full">
          Tìm kiếm
        </GlassButton>
      </form>
    </header>
  )
}
