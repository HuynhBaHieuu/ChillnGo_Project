import { DiscoverSection } from '@/features/discovery-admin/components/DiscoverSection'
import { PhotoTile } from '@/features/discovery-admin/components/PhotoTile'

export interface InterestTile {
  tag: string
  image: string
}

interface InterestGridProps {
  tiles: InterestTile[]
  /** Tags currently in the filter, so a picked tile shows as selected. */
  activeTags: string[]
  onSelect: (tag: string) => void
  className?: string
}

/**
 * "Khám phá theo sở thích" — a row of square photo tiles, one per popular tag.
 * Picking a tile narrows the results to that tag.
 */
export function InterestGrid({ tiles, activeTags, onSelect, className }: InterestGridProps) {
  return (
    <DiscoverSection
      title="Khám phá theo sở thích"
      description="Bạn mê gì, cộng đồng đều đã đi qua."
      className={className}
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <PhotoTile
            key={tile.tag}
            label={tile.tag}
            image={tile.image}
            active={activeTags.includes(tile.tag)}
            onClick={() => onSelect(tile.tag)}
          />
        ))}
      </div>
    </DiscoverSection>
  )
}
