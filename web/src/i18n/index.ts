/**
 * Translation.
 *
 * Strings are written in Vietnamese in the code and wrapped in `t()`:
 *
 *     t('Đăng nhập')                     → "Log in"
 *     t('{n} chuyến đi', { n: 3 })       → "3 trips"
 *
 * The Vietnamese is the key into `catalog`, so `t()` only accepts strings the
 * catalog has: a new string fails the typecheck until it gets its translations.
 * Text that is only known at run time (a label from data) goes through `tx()`,
 * which falls back to the text itself.
 *
 * A Vietnamese word with two meanings gets a context after "#", as in
 * 'Người dùng#role': the context tells the entries apart and is never shown.
 *
 * Changing language remounts the app (see App.tsx), so plain `t()` calls made
 * while rendering always see the current language. Module-level label tables
 * use `translated()`, which translates on every read instead of once at load.
 */

import { enUS, ja, ko, vi, zhCN } from 'date-fns/locale'
import type { Locale as DateLocale } from 'date-fns'

import { catalog } from './catalog'
import { LOCALE_INFO } from './locales'
import type { Locale } from './locales'
import { currentLocale } from './store'
import type { Text } from './types'

export { LOCALES, LOCALE_INFO } from './locales'
export type { Locale } from './locales'
export { currentLocale, useLocale, useLocaleStore } from './store'

export type MessageKey = keyof typeof catalog

export type Params = Record<string, string | number>

function pick(text: Text, params?: Params): string {
  if (typeof text === 'string') return text
  return params?.n === 1 ? text[0] : text[1]
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

function lookup(key: string, locale: Locale): Text {
  const source = key.includes('#') ? key.slice(0, key.indexOf('#')) : key
  if (locale === 'vi') return source
  const entry = (catalog as Record<string, Record<string, Text> | undefined>)[key]
  return entry?.[locale] ?? source
}

/** Translate a catalog string into the current language. */
export function t(key: MessageKey, params?: Params): string {
  return interpolate(pick(lookup(key, currentLocale()), params), params)
}

/** Translate text that is only known at run time; unknown text comes back as is. */
export function tx(text: string, params?: Params): string {
  if (!Object.hasOwn(catalog, text)) return interpolate(text, params)
  return interpolate(pick(lookup(text, currentLocale()), params), params)
}

/**
 * A label table whose values translate on every read, for module-level
 * constants like `{ low: 'Tiết kiệm', ... }`.
 */
export function translated<K extends string>(source: Record<K, MessageKey>): Readonly<Record<K, string>> {
  const result = {} as Record<K, string>
  for (const key of Object.keys(source) as K[]) {
    Object.defineProperty(result, key, { enumerable: true, get: () => t(source[key]) })
  }
  return result
}

/**
 * Copies of `items` whose `fields` translate on every read, for module-level
 * lists of objects such as `[{ id, label: 'Biển' }]`.
 */
export function translatedList<T extends object, F extends keyof T>(items: readonly T[], fields: readonly F[]): T[] {
  return items.map((item) => {
    const copy = { ...item }
    for (const field of fields) {
      const source = item[field]
      if (typeof source !== 'string') continue
      Object.defineProperty(copy, field, { enumerable: true, get: () => tx(source) })
    }
    return copy
  })
}

/** BCP 47 tag of the current language, for `Intl` and `toLocaleString`. */
export function localeTag(): string {
  return LOCALE_INFO[currentLocale()].tag
}

/** Mapbox's code for the current language, for map labels. */
export function mapLanguage(): string {
  const locale = currentLocale()
  return locale === 'zh' ? 'zh-Hans' : locale
}

const DATE_LOCALES: Record<Locale, DateLocale> = { vi, en: enUS, zh: zhCN, ja, ko }

/** date-fns locale of the current language. */
export function dateLocale(): DateLocale {
  return DATE_LOCALES[currentLocale()]
}
