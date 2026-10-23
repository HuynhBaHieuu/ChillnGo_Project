import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { t } from '@/i18n'
import { MODULE_LABELS, ROLE_LABELS } from '@/lib/roles'
import type { Role } from '@/lib/roles'
import { adminService } from '@/services'
import type { User } from '@/services/types'

import { UserActions } from './UserActions'
import { Avatar, Pagination, RoleBadge, StatusBadge, formatDateTime } from './shared'
import type { Notice } from './shared'

interface UsersTableProps {
  actor: User
  /** Lock the list to one role (the Admins tab). Otherwise superadmins get a role filter. */
  fixedRole?: Role
  /** Show each admin's modules instead of email-verification details. */
  showPermissions?: boolean
  onNotice: (notice: Notice) => void
}

const ALL = 'all'

export function UsersTable({ actor, fixedRole, showPermissions = false, onNotice }: UsersTableProps) {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>(ALL)
  const [role, setRole] = useState<string>(ALL)
  const [page, setPage] = useState(1)

  // Wait for a pause in typing before querying.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const params = {
    q: q || undefined,
    status: status === ALL ? undefined : (status as 'active' | 'locked'),
    role: fixedRole ?? (role === ALL ? undefined : (role as Role)),
    page,
  }
  const list = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminService.listUsers(params),
    placeholderData: keepPreviousData,
  })

  const showRoleFilter = !fixedRole && actor.role === 'superadmin'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('Tìm tài khoản')}
            className="pl-9"
          />
        </div>
        {showRoleFilter && (
          <Select
            value={role}
            onValueChange={(v) => {
              setRole(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="sm:w-44" aria-label={t('Lọc theo vai trò')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('Mọi vai trò')}</SelectItem>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="sm:w-44" aria-label={t('Lọc theo trạng thái')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('Mọi trạng thái')}</SelectItem>
            <SelectItem value="active">{t('Hoạt động')}</SelectItem>
            <SelectItem value="locked">{t('Đã khoá')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {list.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('Đang tải danh sách…')}
        </p>
      ) : list.isError ? (
        <p className="text-sm text-destructive">{(list.error as Error).message}</p>
      ) : list.data.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-foreground/20 px-4 py-10 text-center text-sm text-muted-foreground">
          {t('Không có tài khoản nào khớp bộ lọc.')}
        </p>
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-2xl border border-foreground/15 bg-card">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-foreground/10 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('Tài khoản')}</th>
                  <th className="px-4 py-3 font-medium">{t('Vai trò')}</th>
                  <th className="px-4 py-3 font-medium">{t('Trạng thái')}</th>
                  <th className="px-4 py-3 font-medium">{showPermissions ? t('Quyền') : t('Đăng nhập gần nhất')}</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">{t('Thao tác')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((u) => (
                  <tr key={u._id} className="border-b border-foreground/5 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={u} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {u.displayName}
                            {u._id === actor._id && <span className="ml-2 text-xs text-muted-foreground">{t('(bạn)')}</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            @{u.username} · {u.email}
                          </p>
                          {!u.emailVerified && <p className="text-xs text-muted-foreground">{t('Chưa xác nhận email')}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.status} />
                      {u.status === 'locked' && u.lockedReason && (
                        <p className="mt-1 max-w-48 truncate text-xs text-muted-foreground" title={u.lockedReason}>
                          {u.lockedReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {showPermissions ? (
                        u.role === 'superadmin' ? (
                          t('Toàn quyền')
                        ) : u.permissions.length === 0 ? (
                          t('Chưa được cấp quyền nào')
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {u.permissions.map((p) => (
                              <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-foreground">
                                {MODULE_LABELS[p].title}
                              </span>
                            ))}
                          </span>
                        )
                      ) : (
                        formatDateTime(u.lastLoginAt)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <UserActions actor={actor} target={u} onNotice={onNotice} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">{t('{n} tài khoản', { n: list.data.total })}</p>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
