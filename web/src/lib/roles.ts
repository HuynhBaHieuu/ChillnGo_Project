/**
 * Roles and admin modules, as the UI sees them.
 *
 * Mirrors server/src/lib/permissions.ts, which is what actually enforces
 * access. This copy only decides which tabs and buttons to show.
 */

import type { User } from '@/services/types'

export type Role = 'user' | 'admin' | 'superadmin'

export const ADMIN_MODULES = ['users', 'content', 'reports', 'categories', 'stats'] as const
export type AdminModule = (typeof ADMIN_MODULES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  user: 'Người dùng',
  admin: 'Admin',
  superadmin: 'Super Admin',
}

export const MODULE_LABELS: Record<AdminModule, { title: string; description: string }> = {
  users: { title: 'Người dùng', description: 'Khoá, mở khoá và đặt lại mật khẩu cho người dùng thường' },
  content: { title: 'Kiểm duyệt nội dung', description: 'Duyệt, ẩn, xoá bài đăng, lịch trình và bình luận' },
  reports: { title: 'Báo cáo vi phạm', description: 'Xử lý báo cáo spam và nội dung không phù hợp' },
  categories: { title: 'Danh mục', description: 'Quản lý địa điểm và tag' },
  stats: { title: 'Thống kê', description: 'Xem số liệu người dùng trong phạm vi được cấp' },
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
