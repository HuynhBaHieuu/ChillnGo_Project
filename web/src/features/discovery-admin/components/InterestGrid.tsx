import { DiscoverSection } from '@/features/discovery-admin/components/DiscoverSection'
import { PhotoTile } from '@/features/discovery-admin/components/PhotoTile'
import { type InterestTile, interestPath } from '@/features/discovery-admin/interests'

interface InterestGridProps {
  tiles: InterestTile[]
  title?: string
  description?: string
  className?: string
}

/**
 * "Khám phá theo sở thích" — square photo tiles, one per interest, each
 * leading to that interest's page. Four across on desktop; on a phone the row
 * scrolls sideways and snaps tile by tile.
 */
export function InterestGrid({
  tiles,
  title = 'Khám phá theo sở thích',
  description = 'Bạn mê gì, cộng đồng đều đã đi qua.',
  className,
}: InterestGridProps) {
  return (
    <DiscoverSection title={title} description={description} className={className}>
      <div className="-mx-6 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-6 px-6 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-0">
        {tiles.map((tile) => (
          <PhotoTile
            key={tile.tag}
            to={interestPath(tile.tag)}
            label={tile.tag}
            image={tile.image}
            className="w-[215px] shrink-0 snap-start lg:w-full"
          />
        ))}
      </div>
    </DiscoverSection>
  )
}
