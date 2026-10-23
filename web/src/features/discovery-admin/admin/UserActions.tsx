import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Lock, MoreHorizontal, ShieldCheck, ShieldMinus, Unlock } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { t } from '@/i18n'
import { tr } from '@/i18n/rich'
import { translateServerMessage } from '@/i18n/server'
import { isSuperAdmin } from '@/lib/roles'
import type { AdminModule } from '@/lib/roles'
import { adminService } from '@/services'
import type { AdminUser } from '@/services/admin.service'
import type { User } from '@/services/types'

import { PermissionsDialog } from './PermissionsDialog'
import { ConfirmDialog, canManage } from './shared'
import type { Notice } from './shared'

type DialogKind = 'lock' | 'unlock' | 'reset' | 'promote' | 'demote' | 'permissions'

interface UserActionsProps {
  actor: User
  target: AdminUser
  onNotice: (notice: Notice) => void
}

/** The "…" menu on a user row, plus the dialog each action opens. */
export function UserActions({ actor, target, onNotice }: UserActionsProps) {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [reason, setReason] = useState('')

  const superadmin = isSuperAdmin(actor)
  const name = `${target.displayName} (@${target.username})`

  const mutation = useMutation({
    mutationFn: async (input: { kind: DialogKind; permissions?: AdminModule[] }): Promise<string> => {
      switch (input.kind) {
        case 'lock':
          await adminService.lockUser(target._id, reason)
          return t('Đã khoá {name}.', { name })
        case 'unlock':
          await adminService.unlockUser(target._id)
          return t('Đã mở khoá {name}.', { name })
        case 'reset':
          return translateServerMessage((await adminService.resetPassword(target._id)).message)
        case 'promote':
          await adminService.setRole(target._id, 'admin', input.permissions ?? [])
          return t('{name} giờ là Admin.', { name })
        case 'demote':
          await adminService.setRole(target._id, 'user')
          return t('{name} đã trở về người dùng thường.', { name })
        case 'permissions':
          await adminService.setPermissions(target._id, input.permissions ?? [])
          return t('Đã cập nhật quyền của {name}.', { name })
      }
    },
    onSuccess: (text) => {
      onNotice({ kind: 'success', text })
      setDialog(null)
      setReason('')
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (error) => {
      onNotice({ kind: 'error', text: (error as Error).message })
      setDialog(null)
    },
  })

  if (!canManage(actor, target)) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const run = (kind: DialogKind, permissions?: AdminModule[]) => mutation.mutate({ kind, permissions })
  const close = (open: boolean) => {
    if (!open) setDialog(null)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('Thao tác với {name}', { name })}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {target.status === 'active' ? (
            <DropdownMenuItem onSelect={() => setDialog('lock')}>
              <Lock />
              {t('Khoá tài khoản')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setDialog('unlock')}>
              <Unlock />
              {t('Mở khoá')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setDialog('reset')}>
            <KeyRound />
            {t('Đặt lại mật khẩu')}
          </DropdownMenuItem>

          {superadmin && (
            <>
              <DropdownMenuSeparator />
              {target.role === 'user' ? (
                <DropdownMenuItem onSelect={() => setDialog('promote')}>
                  <ShieldCheck />
                  {t('Đặt làm Admin')}
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onSelect={() => setDialog('permissions')}>
                    <ShieldCheck />
                    {t('Phân quyền')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDialog('demote')}>
                    <ShieldMinus />
                    {t('Hạ xuống người dùng')}
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === 'lock'}
        onOpenChange={close}
        title={t('Khoá tài khoản')}
        description={tr('{name} sẽ không đăng nhập được, và phiên đang mở sẽ bị đăng xuất ở lần tải trang tiếp theo. Buổi livestream đang phát (nếu có) sẽ kết thúc, và tài khoản không còn được tính vào số người theo dõi / đang theo dõi của người khác cho tới khi được mở khoá.', {
          name: <strong className="text-foreground">{name}</strong>,
        })}
        confirmLabel={t('Khoá tài khoản')}
        destructive
        pending={mutation.isPending}
        onConfirm={() => run('lock')}
      >
        <div className="space-y-2">
          <Label htmlFor={`lock-reason-${target._id}`}>{t('Lý do (người dùng sẽ thấy khi đăng nhập)')}</Label>
          <Textarea
            id={`lock-reason-${target._id}`}
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'unlock'}
        onOpenChange={close}
        title={t('Mở khoá tài khoản')}
        description={t('{name} sẽ đăng nhập lại được bình thường, và các lượt theo dõi được tính lại như cũ.', { name })}
        confirmLabel={t('Mở khoá')}
        pending={mutation.isPending}
        onConfirm={() => run('unlock')}
      />

      <ConfirmDialog
        open={dialog === 'reset'}
        onOpenChange={close}
        title={t('Đặt lại mật khẩu')}
        description={tr('Hệ thống tạo một mật khẩu tạm thời ngẫu nhiên và gửi tới {email}. Mật khẩu hiện tại sẽ không dùng được nữa. Bạn sẽ không nhìn thấy mật khẩu mới.', {
          email: <strong className="text-foreground">{target.email}</strong>,
        })}
        confirmLabel={t('Đặt lại và gửi email')}
        pending={mutation.isPending}
        onConfirm={() => run('reset')}
      />

      <ConfirmDialog
        open={dialog === 'demote'}
        onOpenChange={close}
        title={t('Hạ xuống người dùng thường')}
        description={t('{name} sẽ mất toàn bộ quyền quản trị. Tài khoản vẫn giữ nguyên.', { name })}
        confirmLabel={t('Hạ quyền')}
        destructive
        pending={mutation.isPending}
        onConfirm={() => run('demote')}
      />

      <PermissionsDialog
        open={dialog === 'promote' || dialog === 'permissions'}
        onOpenChange={close}
        title={dialog === 'promote' ? t('Đặt {name} làm Admin', { name: target.displayName }) : t('Phân quyền cho {name}', { name: target.displayName })}
        confirmLabel={dialog === 'promote' ? t('Đặt làm Admin') : t('Lưu quyền')}
        initial={target.role === 'admin' ? target.permissions : []}
        pending={mutation.isPending}
        onConfirm={(permissions) => run(dialog === 'promote' ? 'promote' : 'permissions', permissions)}
      />
    </>
  )
}
