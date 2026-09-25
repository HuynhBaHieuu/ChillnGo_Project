import { z } from 'zod'

/** Field rules shared by registration and admin account creation. */

/**
 * Password policy. The same three rules are shown as a live checklist on the
 * register form (web/src/lib/password.ts); keep the two in step.
 *
 * "Special character" means anything that is not a letter, digit or space, so
 * Vietnamese letters such as "ệ" do not count as one.
 */
export const passwordSchema = z
  .string('Vui lòng nhập mật khẩu')
  .min(6, 'Mật khẩu cần ít nhất 6 ký tự')
  // bcrypt only looks at the first 72 bytes, so longer passwords would be
  // silently truncated.
  .max(72, 'Mật khẩu tối đa 72 ký tự')
  .regex(/\p{Lu}/u, 'Mật khẩu cần ít nhất 1 chữ viết hoa')
  .regex(/[^\p{L}\p{N}\s]/u, 'Mật khẩu cần ít nhất 1 ký tự đặc biệt, ví dụ ! @ # $ %')

export const emailSchema = z
  .string('Vui lòng nhập email')
  .trim()
  .toLowerCase()
  .pipe(z.email('Email không hợp lệ'))

export const displayNameSchema = z
  .string('Vui lòng nhập tên hiển thị')
  .trim()
  .min(1, 'Vui lòng nhập tên hiển thị')
  .max(60, 'Tên hiển thị tối đa 60 ký tự')

export const usernameSchema = z
  .string('Vui lòng nhập tên người dùng')
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9._]{3,30}$/,
    'Tên người dùng dài 3–30 ký tự, chỉ gồm chữ không dấu, số, dấu chấm hoặc gạch dưới',
  )
