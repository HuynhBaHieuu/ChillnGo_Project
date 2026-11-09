import { Flag, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ReportDialog } from '@/features/report/ReportDialog'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { reportService } from '@/services'
import type { ReportTargetType } from '@/services/types'
import { useAuthStore } from '@/store'

interface ReportMenuProps {
  targetType: ReportTargetType
  targetId: string
  /** Whose content it is: nothing is shown on your own. */
  ownerId: string
  /** "Thêm thao tác cho …", for screen readers. */
  label: string
  className?: string
  size?: 'sm' | 'md'
}

/**
 * The ⋯ menu with "Báo cáo" on someone else's journey, comment, check-in or
 * profile. Shown only to signed-in people, on content the API stores.
 */
export function ReportMenu({ targetType, targetId, ownerId, label, className, size = 'md' }: ReportMenuProps) {
  const viewerId = useAuthStore((s) => s.user?._id)
  const [open, setOpen] = useState(false)

  if (!viewerId || viewerId === ownerId || !reportService.canReport(targetId)) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            className={cn('rounded-full text-muted-foreground', size === 'sm' && 'size-7', className)}
          >
            <MoreHorizontal className={size === 'sm' ? 'size-4' : undefined} aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setOpen(true)} className="text-destructive">
            <Flag />
            {t('Báo cáo')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportDialog open={open} onOpenChange={setOpen} targetType={targetType} targetId={targetId} />
    </>
  )
}

/** The note an author sees on their own content that moderation hid. */
export function ModeratedNotice({ removed = false, className }: { removed?: boolean; className?: string }) {
  return (
    <p
      role="note"
      className={cn(
        'rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive',
        className,
      )}
    >
      {removed
        ? t('Đã bị gỡ do vi phạm quy định cộng đồng. Chỉ bạn còn thấy nội dung này.')
        : t('Đã bị ẩn do vi phạm. Chỉ bạn còn thấy nội dung này.')}
    </p>
  )
}
