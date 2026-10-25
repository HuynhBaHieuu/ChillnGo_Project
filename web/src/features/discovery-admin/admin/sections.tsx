import {
  BarChart3,
  ClipboardList,
  Construction,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'

import { EmptyState } from '@/components/EmptyState'
import { t, translatedList } from '@/i18n'
import type { MessageKey } from '@/i18n'
import { MODULE_LABELS, hasModule, isSuperAdmin } from '@/lib/roles'
import type { AdminModule } from '@/lib/roles'
import type { User } from '@/services/types'

import { AdminsPanel } from './AdminsPanel'
import { AuditLogPanel } from './AuditLogPanel'
import { SettingsPanel } from './SettingsPanel'
import { StatsPanel } from './StatsPanel'
import { UsersTable } from './UsersTable'
import type { Notice } from './shared'

/** Modules the permission model already has, but whose data is not on the server yet. */
const NOT_READY: { module: AdminModule; needs: MessageKey }[] = [
  { module: 'content', needs: 'bài đăng, lịch trình và bình luận' },
  { module: 'reports', needs: 'báo cáo vi phạm từ người dùng' },
  { module: 'categories', needs: 'danh mục địa điểm và tag' },
]

export interface AdminSection {
  /** URL segment: /admin/<path>. */
  path: string
  label: string
  title: string
  description: (user: User) => string
  icon: LucideIcon
  allowed: (user: User) => boolean
  render: (ctx: { user: User; onNotice: (notice: Notice) => void }) => React.ReactNode
}

/**
 * Every screen of the admin console, in sidebar order. `allowed` only decides
 * what is shown; the API enforces the same rules on every request.
 */
export const ADMIN_SECTIONS: AdminSection[] = translatedList<AdminSection, 'label' | 'title'>([
  {
    path: 'overview',
    label: 'Tổng quan',
    title: 'Tổng quan hệ thống',
    description: (user) =>
      isSuperAdmin(user)
        ? t('Số liệu toàn bộ tài khoản và hoạt động quản trị.')
        : t('Số liệu tài khoản người dùng thường, trong phạm vi bạn được cấp.'),
    icon: BarChart3,
    allowed: (user) => hasModule(user, 'stats'),
    render: () => <StatsPanel />,
  },
  {
    path: 'users',
    label: 'Người dùng',
    title: 'Quản lý người dùng',
    description: (user) =>
      isSuperAdmin(user)
        ? t('Tất cả tài khoản. Khoá, mở khoá, đặt lại mật khẩu, phân quyền và xoá mọi tài khoản trừ Super Admin.')
        : t('Người dùng thường. Khoá, mở khoá và đặt lại mật khẩu.'),
    icon: Users,
    allowed: (user) => hasModule(user, 'users'),
    render: ({ user, onNotice }) => <UsersTable actor={user} onNotice={onNotice} />,
  },
  {
    path: 'admins',
    label: 'Quản trị viên',
    title: 'Quản trị viên',
    description: () => t('Tạo, khoá, xoá, hạ quyền và phân quyền từng mục cho Admin. Chỉ Super Admin.'),
    icon: ShieldCheck,
    allowed: (user) => isSuperAdmin(user),
    render: ({ user, onNotice }) => <AdminsPanel actor={user} onNotice={onNotice} />,
  },
  {
    path: 'content',
    label: 'Nội dung',
    title: 'Kiểm duyệt nội dung',
    description: () => t('Bài đăng, lịch trình, bình luận, báo cáo vi phạm và danh mục.'),
    icon: Construction,
    allowed: (user) => NOT_READY.some(({ module }) => hasModule(user, module)),
    render: ({ user }) => (
      <div className="grid gap-4 md:grid-cols-3">
        {NOT_READY.filter(({ module }) => hasModule(user, module)).map(({ module, needs }) => (
          <EmptyState
            key={module}
            icon={Construction}
            title={MODULE_LABELS[module].title}
            description={t('Chưa dùng được: {needs} vẫn là dữ liệu mẫu trên trình duyệt, chưa lưu trên máy chủ. Mục này sẽ hoạt động khi phần API đó được làm.', { needs: t(needs) })}
          />
        ))}
      </div>
    ),
  },
  {
    path: 'audit',
    label: 'Nhật ký',
    title: 'Nhật ký hoạt động',
    description: () => t('Mọi thao tác của Admin và Super Admin. Không sửa hay xoá được.'),
    icon: ClipboardList,
    allowed: (user) => isSuperAdmin(user),
    render: () => <AuditLogPanel />,
  },
  {
    path: 'settings',
    label: 'Cấu hình',
    title: 'Cấu hình hệ thống',
    description: () => t('Đóng hoặc mở đăng ký và thông báo toàn trang. Có hiệu lực ngay.'),
    icon: Settings,
    allowed: (user) => isSuperAdmin(user),
    render: ({ onNotice }) => <SettingsPanel onNotice={onNotice} />,
  },
], ['label', 'title'])

export function sectionsFor(user: User): AdminSection[] {
  return ADMIN_SECTIONS.filter((section) => section.allowed(user))
}
