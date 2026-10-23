import { Link } from 'react-router-dom'

import { PageContainer } from '@/app/layout/PageContainer'
import { GlassButton } from '@/components/Button'
import { t } from '@/i18n'

export function NotFoundPage() {
  return (
    <PageContainer>
      <div className="animate-fade-rise flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">404</p>
        <h1 className="mt-4 font-display text-5xl leading-tight tracking-tight sm:text-6xl">
          {t('Lạc đường rồi')}
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          {t('Trang bạn tìm không tồn tại. Nhưng lạc đường đôi khi cũng là một phần của chuyến đi.')}
        </p>
        <GlassButton asChild size="lg" className="mt-10">
          <Link to="/discover">{t('Về trang Khám phá')}</Link>
        </GlassButton>
      </div>
    </PageContainer>
  )
}
