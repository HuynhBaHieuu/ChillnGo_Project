import { Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const SLIDE_MS = 5000

interface InterestHeroProps {
  title: string
  subtitle?: string
  /** Cover photos to cycle through; the first shows on load. */
  images: string[]
}

/**
 * The interest page's banner: a slow cross-fading slideshow of trip covers
 * with the title on a dark band at the bottom and a pause button in the
 * corner. Starts paused for readers who ask for reduced motion.
 */
export function InterestHero({ title, subtitle, images }: InterestHeroProps) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const canPlay = images.length > 1

  useEffect(() => {
    if (!playing || !canPlay) return
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % images.length),
      SLIDE_MS,
    )
    return () => window.clearInterval(timer)
  }, [playing, canPlay, images.length])

  return (
    <section className="animate-fade-rise np-media relative h-[22rem] overflow-hidden rounded-xl sm:h-[28rem] lg:h-[31.25rem]">
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden={i !== index}
          className={cn(
            'absolute inset-0 size-full rounded-[inherit] object-cover',
            'transition-[opacity,transform] ease-out',
            // A slow push-in on the showing slide; the others rest at 100% to start over.
            i === index
              ? cn('opacity-100 duration-[1000ms,6000ms]', playing && 'scale-105')
              : 'scale-100 opacity-0 duration-1000',
          )}
        />
      ))}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-[linear-gradient(0deg,rgba(0,0,0,0.6)_70%,rgba(0,0,0,0)_100%)] px-6 pb-6 pt-16 md:px-8 md:pb-8">
        <div className="min-w-0">
          <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-white md:text-5xl">
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-sm text-white/80">{subtitle}</p>}
        </div>

        {canPlay && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? t('Tạm dừng trình chiếu') : t('Phát trình chiếu')}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/70 text-white transition-colors hover:bg-white/15"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
        )}
      </div>
    </section>
  )
}
