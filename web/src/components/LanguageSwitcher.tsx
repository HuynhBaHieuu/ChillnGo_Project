import { Check, Globe } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LOCALES, LOCALE_INFO, t, useLocale, useLocaleStore } from '@/i18n'
import { cn } from '@/lib/utils'

/** Globe button in the navbar that switches the site's language. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale()
  const setLocale = useLocaleStore((s) => s.setLocale)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('Ngôn ngữ')}
          className={cn(
            'liquid-glass liquid-glass-interactive relative flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            className,
          )}
        >
          <Globe className="relative z-[1] size-4" />
          <span className="relative z-[1]">{LOCALE_INFO[locale].short}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            lang={LOCALE_INFO[code].tag}
            onSelect={() => setLocale(code)}
            className="justify-between"
          >
            {LOCALE_INFO[code].label}
            {code === locale && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
