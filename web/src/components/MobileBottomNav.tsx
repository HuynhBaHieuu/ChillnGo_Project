import { Bookmark, Compass, Home, Plus, User as UserIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store'

/**
 * Fixed glass pill bar, mobile only.
 *
 * Bookmarks and Profile need a signed-in user, so they fall back to /login
 * rather than rendering a dead tab.
 */
export function MobileBottomNav() {
  const user = useAuthStore((s) => s.user)

  const profilePath = user ? `/users/${user._id}` : '/login'
  const bookmarksPath = user ? `/users/${user._id}?tab=saved` : '/login'

  const items = [
    { to: '/feed', label: 'Home', icon: Home },
    { to: '/discover', label: 'Discover', icon: Compass },
    { to: '/posts/new', label: 'Create', icon: Plus, primary: true },
    { to: bookmarksPath, label: 'Bookmarks', icon: Bookmark },
    { to: profilePath, label: 'Profile', icon: UserIcon },
  ]

  return (
    <nav
      aria-label="Điều hướng chính"
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div data-nav="dock" className="liquid-glass w-full max-w-sm rounded-full">
        <ul className="relative z-[1] flex items-center justify-between px-3 py-2">
          {items.map((item) => (
            <li key={item.label}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 transition-colors',
                    item.primary
                      ? 'bg-primary text-primary-foreground'
                      : isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <item.icon className="size-5" strokeWidth={item.primary ? 2.5 : 1.75} />
                <span className="sr-only">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
