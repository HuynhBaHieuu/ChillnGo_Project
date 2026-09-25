/**
 * Password policy for new accounts.
 *
 * Mirrors `passwordSchema` in server/src/routes/auth.ts, which is what actually
 * enforces it. This copy only drives the live checklist on the register form.
 *
 * "Special character" is anything that is not a letter, digit or space, so a
 * Vietnamese letter such as "ệ" does not count as one.
 */
export const PASSWORD_RULES = [
  { id: 'length', label: 'Ít nhất 6 ký tự', test: (value: string) => value.length >= 6 },
  { id: 'upper', label: 'Ít nhất 1 chữ viết hoa (A–Z)', test: (value: string) => /\p{Lu}/u.test(value) },
  {
    id: 'special',
    label: 'Ít nhất 1 ký tự đặc biệt (! @ # $ % …)',
    test: (value: string) => /[^\p{L}\p{N}\s]/u.test(value),
  },
] as const

export function passwordMeetsRules(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value))
}
