import { RouterProvider } from 'react-router-dom'

import { Providers } from '@/app/providers'
import { router } from '@/app/router'
import { SessionSync } from '@/features/auth/SessionSync'

export function App() {
  return (
    <Providers>
      <SessionSync />
      <RouterProvider router={router} />
    </Providers>
  )
}
