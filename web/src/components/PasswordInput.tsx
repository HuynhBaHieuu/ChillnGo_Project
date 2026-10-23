import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import type * as React from 'react'

import { Input } from '@/components/ui/input'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/** A password field with an eye button that shows or hides what was typed. */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-12', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('Ẩn mật khẩu') : t('Hiện mật khẩu')}
        aria-pressed={visible}
        aria-controls={props.id}
        className={cn(
          'absolute inset-y-0 right-1 my-auto grid size-9 place-items-center rounded-full',
          'text-muted-foreground transition-colors hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <Icon aria-hidden className="size-4" />
      </button>
    </div>
  )
}
