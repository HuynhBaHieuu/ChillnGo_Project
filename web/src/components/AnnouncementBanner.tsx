import { useQuery } from '@tanstack/react-query'
import { Megaphone, X } from 'lucide-react'
import { useState } from 'react'

import { adminService } from '@/services'

const DISMISSED_KEY = 'chillngo.announcement.dismissed'

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

/**
 * The superadmin's site-wide announcement (Quản trị > Cấu hình).
 *
 * A floating card, because the navbar and the mobile nav are both fixed and a
 * full-width strip would sit underneath one of them. It floats above the AI
 * assistant button in the bottom-right corner. Closing it hides this text
 * only: a new announcement shows again.
 */
export function AnnouncementBanner() {
  const settings = useQuery({
    queryKey: ['public-settings'],
    queryFn: adminService.getPublicSettings,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const [dismissed, setDismissed] = useState(readDismissed)

  const text = settings.data?.settings.announcement.trim()
  if (!text || dismissed === text) return null

  function dismiss() {
    setDismissed(text ?? null)
    try {
      localStorage.setItem(DISMISSED_KEY, text ?? '')
    } catch {
      // Private mode: it just comes back on the next visit.
    }
  }

  return (
    <aside
      role="status"
      aria-label="Thông báo từ ChillnGo"
      className="fixed inset-x-4 bottom-44 z-40 mx-auto max-w-md rounded-2xl border-2 border-foreground bg-card p-4 shadow-[4px_4px_0_hsl(var(--foreground))] md:inset-x-auto md:bottom-24 md:right-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-foreground bg-sunset text-sunset-foreground">
          <Megaphone aria-hidden className="size-4" />
        </span>
        <p className="flex-1 pt-1.5 text-sm leading-relaxed">{text}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Đóng thông báo"
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </aside>
  )
}
