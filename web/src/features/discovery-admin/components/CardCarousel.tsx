import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type * as React from 'react'

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface CardCarouselProps<T> {
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T) => React.ReactNode
  /** Slide width per breakpoint, as Tailwind `basis-*` classes. */
  itemClassName?: string
  /**
   * Vertical position of the arrows, so they sit on the middle of the photos
   * rather than the whole card. Written against the track's width in `cqw`.
   */
  arrowClassName?: string
  className?: string
}

/**
 * A row of cards that scrolls sideways, with round prev/next buttons hanging
 * off the edges of the photos. Arrows only show on desktop; touch swipes.
 */
export function CardCarousel<T>({
  items,
  getKey,
  renderItem,
  itemClassName = 'basis-[46%] sm:basis-1/3 lg:basis-1/4',
  arrowClassName = 'top-[calc(12.5cqw-8px)]',
  className,
}: CardCarouselProps<T>) {
  const [api, setApi] = useState<CarouselApi>()
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  useEffect(() => {
    if (!api) return
    const update = () => {
      setCanPrev(api.canScrollPrev())
      setCanNext(api.canScrollNext())
    }
    update()
    api.on('select', update)
    api.on('reInit', update)
    return () => {
      api.off('select', update)
      api.off('reInit', update)
    }
  }, [api])

  const arrow =
    'absolute z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-background lg:grid'

  return (
    <div className={cn('relative [container-type:inline-size]', className)}>
      <Carousel setApi={setApi} opts={{ align: 'start' }}>
        <CarouselContent className="-ml-4">
          {items.map((item) => (
            <CarouselItem key={getKey(item)} className={cn('pl-4', itemClassName)}>
              {renderItem(item)}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {canPrev && (
        <button
          type="button"
          onClick={() => api?.scrollPrev()}
          aria-label={t('Trước')}
          className={cn(arrow, '-left-5', arrowClassName)}
        >
          <ArrowLeft className="size-5" />
        </button>
      )}
      {canNext && (
        <button
          type="button"
          onClick={() => api?.scrollNext()}
          aria-label={t('Sau')}
          className={cn(arrow, '-right-5', arrowClassName)}
        >
          <ArrowRight className="size-5" />
        </button>
      )}
    </div>
  )
}
