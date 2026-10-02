import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'

export interface Gallery4Item {
  id: string
  title: string
  description: string
  /** In-app route (e.g. `/posts/:id`). */
  href: string
  image: string
  /** Short label pinned to the top-left corner, e.g. the trip length. */
  badge?: string
}

export interface Gallery4Props {
  title?: string
  description?: string
  items: Gallery4Item[]
  /** Call to action under each slide's text. */
  ctaLabel?: string
  className?: string
}

/** A horizontal, swipeable row of large image cards with prev/next and dots. */
function Gallery4({
  title,
  description,
  items,
  ctaLabel = 'Xem hành trình',
  className,
}: Gallery4Props) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    if (!carouselApi) return
    const updateSelection = () => {
      setCanScrollPrev(carouselApi.canScrollPrev())
      setCanScrollNext(carouselApi.canScrollNext())
      setCurrentSlide(carouselApi.selectedScrollSnap())
    }
    updateSelection()
    carouselApi.on('select', updateSelection)
    carouselApi.on('reInit', updateSelection)
    return () => {
      carouselApi.off('select', updateSelection)
      carouselApi.off('reInit', updateSelection)
    }
  }, [carouselApi])

  // Embla snaps fewer times than there are slides once the last ones fit on screen.
  const snapCount = carouselApi?.scrollSnapList().length ?? items.length

  return (
    <section className={className}>
      <div className="mb-8 flex items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          {title && (
            <h2 className="font-display text-2xl leading-tight tracking-tight md:text-3xl">
              {title}
            </h2>
          )}
          {description && (
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <div className="hidden shrink-0 gap-2 md:flex">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => carouselApi?.scrollPrev()}
            disabled={!canScrollPrev}
            className="rounded-full disabled:pointer-events-auto"
            aria-label="Trước"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => carouselApi?.scrollNext()}
            disabled={!canScrollNext}
            className="rounded-full disabled:pointer-events-auto"
            aria-label="Sau"
          >
            <ArrowRight className="size-5" />
          </Button>
        </div>
      </div>

      <Carousel
        setApi={setCarouselApi}
        opts={{
          align: 'start',
          breakpoints: {
            '(max-width: 768px)': { dragFree: true },
          },
        }}
      >
        <CarouselContent className="-ml-5">
          {items.map((item) => (
            <CarouselItem key={item.id} className="max-w-[320px] pl-5 lg:max-w-[360px]">
              <Link to={item.href} className="group block rounded-xl">
                <div className="relative h-full min-h-[27rem] max-w-full overflow-hidden rounded-xl bg-white/5">
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    className="absolute size-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/30 to-black/85" />
                  {item.badge && (
                    <span className="absolute left-4 top-4 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                      {item.badge}
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-start p-6 text-white md:p-8">
                    <div className="mb-2 font-display text-xl leading-tight md:mb-3">
                      {item.title}
                    </div>
                    <div className="mb-8 line-clamp-2 text-sm leading-relaxed text-white/80 md:mb-10">
                      {item.description}
                    </div>
                    <div className="flex items-center text-sm">
                      {ctaLabel}
                      <ArrowRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {snapCount > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: snapCount }, (_, index) => (
            <button
              key={index}
              type="button"
              className={cn(
                'h-2 w-2 rounded-full transition-colors',
                currentSlide === index ? 'bg-primary' : 'bg-primary/20',
              )}
              onClick={() => carouselApi?.scrollTo(index)}
              aria-label={`Đến slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export { Gallery4 }
