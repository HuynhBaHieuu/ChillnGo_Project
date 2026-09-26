import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Lock, MoreHorizontal, ShieldCheck, ShieldMinus, Trash2, Unlock } from 'lucide-react'
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
import { isSuperAdmin } from '@/lib/roles'
import type { AdminModule } from '@/lib/roles'
import { adminService } from '@/services'
import type { AdminUser } from '@/services/admin.service'
import type { User } from '@/services/types'

import { PermissionsDialog } from './PermissionsDialog'
import { ConfirmDialog, canManage } from './shared'
import type { Notice } from './shared'

type DialogKind = 'lock' | 'unlock' | 'reset' | 'delete' | 'promote' | 'demote' | 'permissions'

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
          return `Đã khoá ${name}.`
        case 'unlock':
          await adminService.unlockUser(target._id)
          return `Đã mở khoá ${name}.`
        case 'reset':
          return (await adminService.resetPassword(target._id)).message
        case 'delete':
          await adminService.deleteUser(target._id)
          return `Đã xoá tài khoản ${name}.`
        case 'promote':
          await adminService.setRole(target._id, 'admin', input.permissions ?? [])
          return `${name} giờ là Admin.`
        case 'demote':
          await adminService.setRole(target._id, 'user')
          return `${name} đã trở về người dùng thường.`
        case 'permissions':
          await adminService.setPermissions(target._id, input.permissions ?? [])
          return `Đã cập nhật quyền của ${name}.`
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
          <Button variant="ghost" size="icon" aria-label={`Thao tác với ${name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {target.status === 'active' ? (
            <DropdownMenuItem onSelect={() => setDialog('lock')}>
              <Lock />
              Khoá tài khoản
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setDialog('unlock')}>
              <Unlock />
              Mở khoá
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setDialog('reset')}>
            <KeyRound />
            Đặt lại mật khẩu
          </DropdownMenuItem>

          {superadmin && (
            <>
              <DropdownMenuSeparator />
              {target.role === 'user' ? (
                <DropdownMenuItem onSelect={() => setDialog('promote')}>
                  <ShieldCheck />
                  Đặt làm Admin
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onSelect={() => setDialog('permissions')}>
                    <ShieldCheck />
                    Phân quyền
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDialog('demote')}>
                    <ShieldMinus />
                    Hạ xuống người dùng
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDialog('delete')} className="text-destructive">
                <Trash2 />
                Xoá tài khoản
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === 'lock'}
        onOpenChange={close}
        title="Khoá tài khoản"
        description={
          <>
            <strong className="text-foreground">{name}</strong> sẽ không đăng nhập được, và phiên đang
            mở sẽ bị đăng xuất ở lần tải trang tiếp theo.
          </>
        }
        confirmLabel="Khoá tài khoản"
        destructive
        pending={mutation.isPending}
        onConfirm={() => run('lock')}
      >
        <div className="space-y-2">
          <Label htmlFor={`lock-reason-${target._id}`}>Lý do (người dùng sẽ thấy khi đăng nhập)</Label>
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
        title="Mở khoá tài khoản"
        description={<>{name} sẽ đăng nhập lại được bình thường.</>}
        confirmLabel="Mở khoá"
        pending={mutation.isPending}
        onConfirm={() => run('unlock')}
      />

      <ConfirmDialog
        open={dialog === 'reset'}
        onOpenChange={close}
        title="Đặt lại mật khẩu"
        description={
          <>
            Hệ thống tạo một mật khẩu tạm thời ngẫu nhiên và gửi tới{' '}
            <strong className="text-foreground">{target.email}</strong>. Mật khẩu hiện tại sẽ không dùng
            được nữa. Bạn sẽ không nhìn thấy mật khẩu mới.
          </>
        }
        confirmLabel="Đặt lại và gửi email"
        pending={mutation.isPending}
        onConfirm={() => run('reset')}
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={close}
        title="Xoá tài khoản vĩnh viễn"
        description={
          <>
            Tài khoản <strong className="text-foreground">{name}</strong> sẽ bị xoá khỏi cơ sở dữ liệu. Việc
            này không hoàn tác được. Nếu chỉ muốn chặn đăng nhập, hãy khoá tài khoản.
          </>
        }
        confirmLabel="Xoá vĩnh viễn"
        destructive
        pending={mutation.isPending}
        onConfirm={() => run('delete')}
      />

      <ConfirmDialog
        open={dialog === 'demote'}
        onOpenChange={close}
        title="Hạ xuống người dùng thường"
        description={<>{name} sẽ mất toàn bộ quyền quản trị. Tài khoản vẫn giữ nguyên.</>}
        confirmLabel="Hạ quyền"
        destructive
        pending={mutation.isPending}
        onConfirm={() => run('demote')}
      />

      <PermissionsDialog
        open={dialog === 'promote' || dialog === 'permissions'}
        onOpenChange={close}
        title={dialog === 'promote' ? `Đặt ${target.displayName} làm Admin` : `Phân quyền cho ${target.displayName}`}
        confirmLabel={dialog === 'promote' ? 'Đặt làm Admin' : 'Lưu quyền'}
        initial={target.role === 'admin' ? target.permissions : []}
        pending={mutation.isPending}
        onConfirm={(permissions) => run(dialog === 'promote' ? 'promote' : 'permissions', permissions)}
      />
    </>
  )
}
