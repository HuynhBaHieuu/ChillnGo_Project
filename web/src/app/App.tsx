import { RouterProvider } from 'react-router-dom'

import { Providers } from '@/app/providers'
import { router } from '@/app/router'
import { SessionSync } from '@/features/auth/SessionSync'
import { useLocale } from '@/i18n'

export function App() {
  // Changing language remounts the pages, so every `t()` call re-runs in the
  // new language. The query cache sits above and survives it.
  const locale = useLocale()

  return (
    <Providers>
      <SessionSync />
      <RouterProvider key={locale} router={router} />
    </Providers>
  )
}
