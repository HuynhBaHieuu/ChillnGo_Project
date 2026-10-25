import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

import { GlassButton } from '@/components/Button'
import { GlassCard } from '@/components/GlassCard'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const BANNER_IMAGE =
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&h=900&q=75'

/**
 * Closing call to action: a photo on the left, and a centred pitch on the
 * right inviting the reader to post their own trip.
 */
export function ShareTripBanner({ className }: { className?: string }) {
  return (
    <GlassCard className={cn('np-surface p-4 sm:p-6 lg:p-9', className)}>
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="np-media aspect-[4/3] overflow-hidden">
          <img
            src={BANNER_IMAGE}
            alt=""
            loading="lazy"
            className="size-full rounded-[inherit] object-cover"
          />
        </div>

        <div className="mx-auto flex max-w-md flex-col items-center px-2 pb-4 text-center lg:pb-0">
          <p className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Compass className="size-5" />
            {t('Cộng đồng ChillnGo')}
          </p>
          <h2 className="font-display text-3xl leading-tight tracking-tight md:text-4xl">
            {t('Kể lại chuyến đi của bạn')}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
            {t('Chia sẻ lịch trình, chi phí và những điểm dừng bạn yêu thích. Hành trình của bạn có thể là cảm hứng cho chuyến đi tiếp theo của ai đó.')}
          </p>
          <GlassButton asChild tone="sunset" size="lg" className="mt-8">
            <Link to="/posts/new">{t('Đăng hành trình')}</Link>
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  )
}
