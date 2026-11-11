import {
  BarChart3,
  Banknote,
  Building2,
  ClipboardList,
  Flag,
  MapPinned,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { t, translatedList } from '@/i18n'
import { hasModule, isSuperAdmin } from '@/lib/roles'
import type { AdminModule } from '@/lib/roles'
import type { User } from '@/services/types'

import { AdminsPanel } from './AdminsPanel'
import { AuditLogPanel } from './AuditLogPanel'
import { BusinessesPanel } from './BusinessesPanel'
import { HiddenContentPanel } from './HiddenContentPanel'
import { LiveStreamsPanel } from './LiveStreamsPanel'
import { ReportsPanel } from './ReportsPanel'
import { RevenuePanel } from './RevenuePanel'
import { SettingsPanel } from './SettingsPanel'
import { StatsPanel } from './StatsPanel'
import { UsersTable } from './UsersTable'
import { CatalogPanel } from './catalog/CatalogPanel'
import type { Notice } from './shared'

/** The modules the Nội dung screen serves. */
const CONTENT_MODULES: AdminModule[] = ['reports', 'content']

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
        ? t('Tất cả tài khoản. Khoá, mở khoá, đặt lại mật khẩu và phân quyền mọi tài khoản trừ Super Admin. Tài khoản chỉ bị khoá, không bị xoá.')
        : t('Người dùng thường. Khoá, mở khoá và đặt lại mật khẩu.'),
    icon: Users,
    allowed: (user) => hasModule(user, 'users'),
    render: ({ user, onNotice }) => <UsersTable actor={user} onNotice={onNotice} />,
  },
  {
    path: 'admins',
    label: 'Quản trị viên',
    title: 'Quản trị viên',
    description: () => t('Tạo, khoá, hạ quyền và phân quyền từng mục cho Admin. Chỉ Super Admin.'),
    icon: ShieldCheck,
    allowed: (user) => isSuperAdmin(user),
    render: ({ user, onNotice }) => <AdminsPanel actor={user} onNotice={onNotice} />,
  },
  {
    path: 'content',
    label: 'Nội dung',
    title: 'Kiểm duyệt nội dung',
    description: () => t('Báo cáo vi phạm từ người dùng: xem xét, ẩn, gỡ nội dung hoặc khoá tài khoản vi phạm. Xem và hiện lại những gì đang bị ẩn, dừng livestream vi phạm.'),
    icon: Flag,
    allowed: (user) => CONTENT_MODULES.some((module) => hasModule(user, module)),
    render: ({ user, onNotice }) => {
      // Reports need [reports]; unhiding and stopping a stream need [content].
      const tabs = [
        hasModule(user, 'reports') && { value: 'reports', label: t('Hàng chờ báo cáo'), panel: <ReportsPanel actor={user} onNotice={onNotice} /> },
        hasModule(user, 'content') && { value: 'hidden', label: t('Đang bị ẩn'), panel: <HiddenContentPanel onNotice={onNotice} /> },
        hasModule(user, 'content') && { value: 'live', label: t('Đang phát'), panel: <LiveStreamsPanel onNotice={onNotice} /> },
      ].filter((tab) => tab !== false)
      if (tabs.length === 1) return tabs[0].panel
      return (
        <Tabs defaultValue={tabs[0].value} className="space-y-5">
          <TabsList className="flex w-full flex-wrap sm:w-auto">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.panel}
            </TabsContent>
          ))}
        </Tabs>
      )
    },
  },
  {
    path: 'catalog',
    label: 'Danh mục',
    title: 'Danh mục địa điểm',
    description: () => t('Điểm đến, địa điểm và checklist chuẩn bị mà AI dùng để lên lịch trình. AI chỉ gợi ý những gì có ở đây.'),
    icon: MapPinned,
    allowed: (user) => hasModule(user, 'categories'),
    render: ({ onNotice }) => <CatalogPanel onNotice={onNotice} />,
  },
  {
    path: 'businesses',
    label: 'Doanh nghiệp',
    title: 'Duyệt doanh nghiệp',
    description: () => t('Hồ sơ homestay, khách sạn, quán ăn, cà phê và tour: duyệt, từ chối kèm lý do, ẩn hoặc hiển thị lại.'),
    icon: Building2,
    allowed: (user) => hasModule(user, 'businesses'),
    render: ({ onNotice }) => <BusinessesPanel onNotice={onNotice} />,
  },
  {
    path: 'revenue',
    label: 'Doanh thu',
    title: 'Doanh thu',
    description: () => t('Đơn hàng thanh toán qua PayOS: gói Premium và gói Đề xuất của doanh nghiệp.'),
    icon: Banknote,
    allowed: (user) => hasModule(user, 'revenue'),
    render: () => <RevenuePanel />,
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
