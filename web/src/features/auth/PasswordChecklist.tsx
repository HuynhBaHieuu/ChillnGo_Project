import { Circle, CircleCheck } from 'lucide-react'

import { t } from '@/i18n'
import { PASSWORD_RULES } from '@/lib/password'
import { cn } from '@/lib/utils'

interface PasswordChecklistProps {
  id: string
  password: string
}

/** Live list of the password rules, each ticked off as it is met. */
export function PasswordChecklist({ id, password }: PasswordChecklistProps) {
  return (
    <ul id={id} aria-live="polite" className="space-y-1.5 pt-1 text-xs">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password)
        const Icon = met ? CircleCheck : Circle
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-2 transition-colors',
              met ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <Icon
              aria-hidden
              className={cn('size-3.5 shrink-0', met && 'text-[hsl(var(--tertiary-ink))]')}
            />
            <span>
              {rule.label}
              <span className="sr-only">{met ? t(': đã đạt') : t(': chưa đạt')}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
