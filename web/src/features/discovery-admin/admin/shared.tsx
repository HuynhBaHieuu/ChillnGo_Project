import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Loader2 } from 'lucide-react'
import type * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ROLE_LABELS } from '@/lib/roles'
import type { Role } from '@/lib/roles'
import { cn } from '@/lib/utils'
import type { AdminUser } from '@/services/admin.service'
import type { User } from '@/services/types'

/** Mirrors canManageAccount on the server: what the UI offers, not what it enforces. */
export function canManage(actor: Pick<User, '_id' | 'role'>, target: Pick<AdminUser, '_id' | 'role'>): boolean {
  if (target.role === 'superadmin' || actor._id === target._id) return false
  if (actor.role === 'superadmin') return true
  return actor.role === 'admin' && target.role === 'user'
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        role === 'superadmin' && 'border-foreground bg-foreground text-background',
        role === 'admin' && 'border-foreground bg-sunset text-sunset-foreground',
        role === 'user' && 'border-foreground/20 text-muted-foreground',
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  )
}

export function StatusBadge({ status }: { status: AdminUser['status'] }) {
  return status === 'locked' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
      <CircleAlert aria-hidden className="size-3" />
      Đã khoá
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
      <CircleCheck aria-hidden className="size-3" />
      Hoạt động
    </span>
  )
}

/** Result line shown above a panel after an action. */
export interface Notice {
  kind: 'success' | 'error'
  text: string
}

export function NoticeBar({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  if (!notice) return null
  return (
    <div
      role={notice.kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-sm',
        notice.kind === 'success'
          ? 'border-foreground/15 bg-muted text-foreground'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      <span>{notice.text}</span>
      <button type="button" onClick={onClose} className="text-xs font-semibold underline">
        Đóng
      </button>
    </div>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <nav aria-label="Phân trang" className="flex items-center justify-end gap-2 text-sm">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="size-4" aria-hidden />
        Trước
      </Button>
      <span className="px-2 text-muted-foreground">
        Trang {page} / {pages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Sau
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  )
}

/** A yes/no dialog for actions that deserve a second look. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  onConfirm,
  onOpenChange,
  children,
}: {
  open: boolean
  title: string
  description: React.ReactNode
  confirmLabel: string
  destructive?: boolean
  pending?: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
          </DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Huỷ
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDateTime(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : 'Chưa từng'
}

export function Avatar({ user }: { user: Pick<AdminUser, 'avatarUrl' | 'displayName'> }) {
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className="size-9 shrink-0 rounded-full border border-foreground/10 object-cover" />
  ) : (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold">
      {user.displayName.charAt(0).toUpperCase()}
    </span>
  )
}
