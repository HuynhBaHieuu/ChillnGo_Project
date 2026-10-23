/**
 * The languages the site speaks. Vietnamese is the source language: every
 * string in the code is written in Vietnamese and doubles as its own key, so a
 * missing translation simply shows the Vietnamese.
 */

export const LOCALES = ['vi', 'en', 'zh', 'ja', 'ko'] as const
export type Locale = (typeof LOCALES)[number]

/** Every language except the source one: these need a translation per string. */
export type TargetLocale = Exclude<Locale, 'vi'>

export const DEFAULT_LOCALE: Locale = 'vi'

export interface LocaleInfo {
  /** Name in its own language, for the switcher. */
  label: string
  /** Short tag for tight spots. */
  short: string
  /** BCP 47 tag for `Intl` and `<html lang>`. */
  tag: string
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  vi: { label: 'Tiếng Việt', short: 'VI', tag: 'vi-VN' },
  en: { label: 'English', short: 'EN', tag: 'en-US' },
  zh: { label: '中文', short: '中', tag: 'zh-CN' },
  ja: { label: '日本語', short: '日', tag: 'ja-JP' },
  ko: { label: '한국어', short: '한', tag: 'ko-KR' },
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}
