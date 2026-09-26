import { useQuery } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'

import { TagChip } from '@/components/TagChip'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  BUDGET_LABELS,
  BUDGET_LEVELS,
  REGIONS,
  REGION_LABELS,
  SEASONS,
  SEASON_LABELS,
  formatVndShort,
} from '@/lib/format'
import { qk } from '@/lib/queryKeys'
import { cn } from '@/lib/utils'
import { discoveryService } from '@/services'
import type { BudgetLevel, DiscoverFilters, Region, Season } from '@/services/types'

interface FilterPanelProps {
  filters: DiscoverFilters
  onChange: (filters: DiscoverFilters) => void
  onReset: () => void
  costCeiling: number
  className?: string
}

/**
 * The Discover filter panel.
 *
 * Rendered inline in the left column on desktop and inside a paper
 * sheet on mobile — same component, the parent decides the container.
 */
export function FilterPanel({
  filters,
  onChange,
  onReset,
  costCeiling,
  className,
}: FilterPanelProps) {
  const { data: tags } = useQuery({
    queryKey: qk.discover.tags,
    queryFn: () => discoveryService.getAllTags(),
  })

  function patch(update: Partial<DiscoverFilters>) {
    onChange({ ...filters, ...update })
  }

  function toggleTag(tag: string) {
    patch({
      tags: filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag],
    })
  }

  function toggleBudget(level: BudgetLevel) {
    patch({
      budgetLevels: filters.budgetLevels.includes(level)
        ? filters.budgetLevels.filter((l) => l !== level)
        : [...filters.budgetLevels, level],
    })
  }

  return (
    <div className={cn('space-y-7', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Bộ lọc</h2>
        <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
          <RotateCcw />
          Đặt lại
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="discover-search">Tìm kiếm</Label>
        <Input
          id="discover-search"
          value={filters.query}
          onChange={(e) => patch({ query: e.target.value })}
        />
      </div>

      {/* Region */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-muted-foreground">Khu vực</legend>
        <div className="flex flex-wrap gap-1.5">
          <TagChip
            tag="Tất cả"
            active={filters.region === 'all'}
            onClick={() => patch({ region: 'all' })}
          />
          {REGIONS.map((region) => (
            <TagChip
              key={region}
              tag={REGION_LABELS[region]}
              active={filters.region === region}
              onClick={() => patch({ region: region as Region })}
            />
          ))}
        </div>
      </fieldset>

      {/* Season */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-muted-foreground">Mùa</legend>
        <div className="flex flex-wrap gap-1.5">
          <TagChip
            tag="Tất cả"
            active={filters.season === 'all'}
            onClick={() => patch({ season: 'all' })}
          />
          {SEASONS.map((season) => (
            <TagChip
              key={season}
              tag={SEASON_LABELS[season]}
              active={filters.season === season}
              onClick={() => patch({ season: season as Season })}
            />
          ))}
        </div>
      </fieldset>

      {/* Trip type / tags */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-muted-foreground">
          Kiểu chuyến đi
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {(tags ?? []).map(({ tag }) => (
            <TagChip
              key={tag}
              tag={tag}
              active={filters.tags.includes(tag)}
              onClick={() => toggleTag(tag)}
            />
          ))}
        </div>
      </fieldset>

      {/* Budget level */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-muted-foreground">
          Mức chi tiêu
        </legend>
        <div className="space-y-2.5">
          {BUDGET_LEVELS.map((level) => (
            <label
              key={level}
              className="flex cursor-pointer items-center gap-3 text-sm"
            >
              <Checkbox
                checked={filters.budgetLevels.includes(level)}
                onCheckedChange={() => toggleBudget(level)}
              />
              {BUDGET_LABELS[level]}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Cost range */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-muted-foreground">
          Ngân sách ước tính
        </legend>
        <Slider
          min={0}
          max={costCeiling}
          step={100_000}
          value={[filters.minCost, Math.min(filters.maxCost, costCeiling)]}
          onValueChange={([minCost, maxCost]) => patch({ minCost, maxCost })}
          aria-label="Khoảng ngân sách"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatVndShort(filters.minCost)}₫</span>
          <span>{formatVndShort(Math.min(filters.maxCost, costCeiling))}₫</span>
        </div>
      </fieldset>
    </div>
  )
}
