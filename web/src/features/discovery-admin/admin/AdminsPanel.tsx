import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordChecklist } from '@/features/auth/PasswordChecklist'
import { passwordMeetsRules } from '@/lib/password'
import type { AdminModule } from '@/lib/roles'
import { adminService } from '@/services'
import type { User } from '@/services/types'

import { PermissionChecklist } from './PermissionsDialog'
import { UsersTable } from './UsersTable'
import type { Notice } from './shared'

/** Quản trị viên: superadmin only. Create, re-permission, lock, demote, delete admins. */
export function AdminsPanel({ actor, onNotice }: { actor: User; onNotice: (notice: Notice) => void }) {
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Muốn nâng một người dùng có sẵn lên Admin? Vào mục Người dùng, mở menu của tài khoản đó và chọn
          “Đặt làm Admin”.
        </p>
        <Button onClick={() => setCreating(true)} className="shrink-0">
          <UserPlus className="size-4" aria-hidden />
          Tạo Admin mới
        </Button>
      </div>

      <UsersTable actor={actor} fixedRole="admin" showPermissions onNotice={onNotice} />

      <CreateAdminDialog open={creating} onOpenChange={setCreating} onNotice={onNotice} />
    </div>
  )
}

function CreateAdminDialog({
  open,
  onOpenChange,
  onNotice,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNotice: (notice: Notice) => void
}) {
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [permissions, setPermissions] = useState<AdminModule[]>(['users', 'stats'])
  const [formError, setFormError] = useState<string | null>(null)

  const reset = () => {
    setDisplayName('')
    setUsername('')
    setEmail('')
    setPassword('')
    setPermissions(['users', 'stats'])
    setFormError(null)
  }

  const mutation = useMutation({
    mutationFn: () => adminService.createAdmin({ displayName, username, email, password, permissions }),
    onSuccess: ({ user }) => {
      onNotice({
        kind: 'success',
        text: `Đã tạo Admin ${user.displayName} (@${user.username}). Hãy gửi email và mật khẩu cho họ qua kênh an toàn.`,
      })
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
      reset()
      onOpenChange(false)
    },
    onError: (error) => setFormError((error as Error).message),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!passwordMeetsRules(password)) {
      setFormError('Mật khẩu chưa đạt đủ yêu cầu.')
      return
    }
    setFormError(null)
    mutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle>Tạo Admin mới</DialogTitle>
          <DialogDescription>
            Tài khoản được kích hoạt ngay, không cần xác nhận email. Admin nên đổi mật khẩu sau lần đăng nhập
            đầu tiên.
          </DialogDescription>
        </DialogHeader>

        <form id="create-admin" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ca-name">Tên hiển thị</Label>
            <Input id="ca-name" required maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ca-username">Tên người dùng</Label>
            <Input
              id="ca-username"
              required
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9._]+"
              title="Chữ không dấu, số, dấu chấm hoặc gạch dưới"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ca-email">Email</Label>
            <Input id="ca-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ca-password">Mật khẩu ban đầu</Label>
            <PasswordInput
              id="ca-password"
              required
              minLength={6}
              maxLength={72}
              autoComplete="new-password"
              aria-describedby="ca-password-rules"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordChecklist id="ca-password-rules" password={password} />
          </div>
          <PermissionChecklist value={permissions} onChange={setPermissions} idPrefix="create-admin" />
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Huỷ
          </Button>
          <Button type="submit" form="create-admin" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Tạo Admin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
