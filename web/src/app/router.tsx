import { createBrowserRouter } from 'react-router-dom'

import { HomePage } from '@/app/landing/home/HomePage'
import { NotFoundPage } from '@/app/landing/NotFoundPage'
import { RootLayout } from '@/app/layout/RootLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { AdminPage } from '@/features/discovery-admin/AdminPage'
import { DiscoverPage } from '@/features/discovery-admin/DiscoverPage'
import { ItinerariesPage } from '@/features/itinerary-clone/ItinerariesPage'
import { ItineraryDetailPage } from '@/features/itinerary-clone/ItineraryDetailPage'
import { ProfilePage } from '@/features/social/ProfilePage'
import { FeedPage } from '@/features/trip-post/FeedPage'
import { PostDetailPage } from '@/features/trip-post/PostDetailPage'
import { PostEditorPage } from '@/features/trip-post/PostEditorPage'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },

      { path: '/feed', element: <FeedPage /> },
      { path: '/discover', element: <DiscoverPage /> },

      { path: '/posts/:id', element: <PostDetailPage /> },
      {
        path: '/posts/new',
        element: (
          <RequireAuth>
            <PostEditorPage />
          </RequireAuth>
        ),
      },
      {
        path: '/posts/:id/edit',
        element: (
          <RequireAuth>
            <PostEditorPage />
          </RequireAuth>
        ),
      },

      {
        path: '/itineraries',
        element: (
          <RequireAuth>
            <ItinerariesPage />
          </RequireAuth>
        ),
      },
      {
        path: '/itineraries/:id',
        element: (
          <RequireAuth>
            <ItineraryDetailPage />
          </RequireAuth>
        ),
      },

      { path: '/users/:id', element: <ProfilePage /> },

      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },

      {
        path: '/admin',
        element: (
          <RequireAuth adminOnly>
            <AdminPage />
          </RequireAuth>
        ),
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
