/**
 * Roles and admin modules, as the UI sees them.
 *
 * Mirrors server/src/lib/permissions.ts, which is what actually enforces
 * access. This copy only decides which tabs and buttons to show.
 */

import { t, translated } from '@/i18n'
import type { MessageKey } from '@/i18n'
import type { User } from '@/services/types'

export type Role = 'user' | 'admin' | 'superadmin'

export const ADMIN_MODULES = ['users', 'content', 'reports', 'categories', 'stats'] as const
export type AdminModule = (typeof ADMIN_MODULES)[number]

export const ROLE_LABELS = translated<Role>({
  user: 'Người dùng#role',
  admin: 'Admin',
  superadmin: 'Super Admin',
})

/** A module's name and blurb, translated on every read. */
function moduleLabel(title: MessageKey, description: MessageKey): { readonly title: string; readonly description: string } {
  return {
    get title() {
      return t(title)
    },
    get description() {
      return t(description)
    },
  }
}

export const MODULE_LABELS: Record<AdminModule, { readonly title: string; readonly description: string }> = {
  users: moduleLabel('Người dùng', 'Khoá, mở khoá và đặt lại mật khẩu cho người dùng thường'),
  content: moduleLabel('Kiểm duyệt nội dung', 'Duyệt, ẩn, xoá bài đăng, lịch trình và bình luận'),
  reports: moduleLabel('Báo cáo vi phạm', 'Xử lý báo cáo spam và nội dung không phù hợp'),
  categories: moduleLabel('Danh mục', 'Quản lý địa điểm và tag'),
  stats: moduleLabel('Thống kê', 'Xem số liệu người dùng trong phạm vi được cấp'),
}

export function isStaff(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'superadmin'
}

export function isSuperAdmin(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'superadmin'
}

/** Where to go after signing in, when no page asked for it. */
export function homePathFor(user: Pick<User, 'role'>): string {
  return isStaff(user) ? '/admin' : '/feed'
}

export function hasModule(user: Pick<User, 'role' | 'permissions'> | null | undefined, module: AdminModule): boolean {
  if (user?.role === 'superadmin') return true
  return user?.role === 'admin' && (user.permissions ?? []).includes(module)
}
