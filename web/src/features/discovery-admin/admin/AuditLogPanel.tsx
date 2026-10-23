import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { t } from '@/i18n'
import type { MessageKey } from '@/i18n'
import { MODULE_LABELS, ROLE_LABELS } from '@/lib/roles'
import type { AdminModule, Role } from '@/lib/roles'
import { adminService } from '@/services'
import type { AuditEntry } from '@/services/admin.service'

import { Pagination, formatDateTime } from './shared'

const ACTION_LABELS: Record<string, MessageKey> = {
  'user.lock': 'Khoá tài khoản#log',
  'user.unlock': 'Mở khoá tài khoản#log',
  'user.reset_password': 'Đặt lại mật khẩu#log',
  'user.delete': 'Xoá tài khoản',
  'user.role': 'Đổi vai trò',
  'admin.create': 'Tạo Admin#log',
  'admin.permissions': 'Phân quyền Admin',
  'settings.update': 'Đổi cấu hình hệ thống',
  'system.reset_users': 'Reset toàn bộ tài khoản',
  'system.seed_superadmin': 'Tạo Super Admin (script)',
}

const ALL = 'all'

function modules(list: unknown): string {
  const items = Array.isArray(list) ? (list as AdminModule[]) : []
  return items.length ? items.map((m) => MODULE_LABELS[m]?.title ?? m).join(', ') : t('không có quyền nào')
}

function roleLabel(role: unknown): string {
  return ROLE_LABELS[role as Role] ?? String(role)
}

/** One readable line describing what changed. */
function describe(entry: AuditEntry): string {
  const d = entry.details as Record<string, any>
  switch (entry.action) {
    case 'user.lock':
      return d.reason ? t('Lý do: {reason}', { reason: d.reason }) : t('Không ghi lý do')
    case 'user.delete':
      return `${d.email ?? ''} · ${roleLabel(d.role)}`
    case 'user.role':
      return `${roleLabel(d.before?.role)} → ${roleLabel(d.after?.role)}`
    case 'admin.create':
      return t('Quyền: {modules}', { modules: modules(d.permissions) })
    case 'admin.permissions':
      return `${modules(d.before)} → ${modules(d.after)}`
    case 'settings.update': {
      const changes: string[] = []
      if (d.before?.registrationOpen !== d.after?.registrationOpen) {
        changes.push(d.after?.registrationOpen ? t('Mở đăng ký') : t('Đóng đăng ký'))
      }
      if (d.before?.announcement !== d.after?.announcement) {
        changes.push(d.after?.announcement ? t('Thông báo: “{text}”', { text: d.after.announcement }) : t('Gỡ thông báo'))
      }
      return changes.join(' · ') || t('Không đổi gì')
    }
    case 'system.reset_users':
      return t('Đã xoá {n} tài khoản', { n: d.deletedUsers ?? 0 })
    case 'system.seed_superadmin':
      return d.created ? t('Tạo mới') : t('Khôi phục quyền Super Admin cho tài khoản có sẵn')
    default:
      return ''
  }
}

/** Nhật ký hoạt động: superadmin only. */
export function AuditLogPanel() {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [action, setAction] = useState(ALL)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const params = { q: q || undefined, action: action === ALL ? undefined : action, page }
  const logs = useQuery({
    queryKey: ['admin', 'audit', params],
    queryFn: () => adminService.listAuditLogs(params),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('Mọi thao tác của Admin và Super Admin đều được ghi lại ở đây. Nhật ký không sửa hay xoá được từ giao diện.')}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('Tìm trong nhật ký')}
            className="pl-9"
          />
        </div>
        <Select
          value={action}
          onValueChange={(v) => {
            setAction(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="sm:w-56" aria-label={t('Lọc theo hành động')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('Mọi hành động')}</SelectItem>
            {Object.entries(ACTION_LABELS).map(([value, labelText]) => (
              <SelectItem key={value} value={value}>
                {t(labelText)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {logs.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('Đang tải nhật ký…')}
        </p>
      ) : logs.isError ? (
        <p className="text-sm text-destructive">{(logs.error as Error).message}</p>
      ) : logs.data.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-foreground/20 px-4 py-10 text-center text-sm text-muted-foreground">
          {t('Chưa có hoạt động nào khớp bộ lọc.')}
        </p>
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-2xl border border-foreground/15 bg-card">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-foreground/10 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('Thời gian')}</th>
                  <th className="px-4 py-3 font-medium">{t('Người thực hiện')}</th>
                  <th className="px-4 py-3 font-medium">{t('Hành động')}</th>
                  <th className="px-4 py-3 font-medium">{t('Đối tượng')}</th>
                  <th className="px-4 py-3 font-medium">{t('Chi tiết')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.items.map((entry) => (
                  <tr key={entry._id} className="border-b border-foreground/5 align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{entry.actorName}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.actorRole === 'system' ? t('Hệ thống') : roleLabel(entry.actorRole)}
                        {entry.ip && ` · ${entry.ip}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-medium">{entry.action in ACTION_LABELS ? t(ACTION_LABELS[entry.action]) : entry.action}</td>
                    <td className="px-4 py-3">{entry.targetLabel || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{describe(entry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">{t('{n} mục', { n: logs.data.total })}</p>
            <Pagination page={logs.data.page} pageSize={logs.data.pageSize} total={logs.data.total} onPage={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
