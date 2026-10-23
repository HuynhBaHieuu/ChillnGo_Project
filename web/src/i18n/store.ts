/**
 * The chosen language. Remembered per browser; on a first visit it follows the
 * browser's language when the site speaks it, else Vietnamese.
 */

import { create } from 'zustand'

import { DEFAULT_LOCALE, LOCALE_INFO, isLocale } from './locales'
import type { Locale } from './locales'

const STORAGE_KEY = 'chillngo.locale'

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    // Storage blocked: fall through to the browser's language.
  }
  if (typeof navigator !== 'undefined') {
    for (const language of navigator.languages ?? [navigator.language]) {
      const base = language.toLowerCase().split('-')[0]
      if (isLocale(base)) return base
    }
  }
  return DEFAULT_LOCALE
}

function applyToDocument(locale: Locale) {
  if (typeof document !== 'undefined') document.documentElement.lang = LOCALE_INFO[locale].tag
}

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLocaleStore = create<LocaleState>()((set) => ({
  locale: initialLocale(),
  setLocale: (locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // Not remembered across visits, but still applied now.
    }
    applyToDocument(locale)
    set({ locale })
  },
}))

applyToDocument(useLocaleStore.getState().locale)

/** The current language, outside React. */
export function currentLocale(): Locale {
  return useLocaleStore.getState().locale
}

/** The current language, re-rendering on change. */
export function useLocale(): Locale {
  return useLocaleStore((state) => state.locale)
}
