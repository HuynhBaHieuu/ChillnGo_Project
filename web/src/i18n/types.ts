import type { TargetLocale } from './locales'

/**
 * One translation. A pair is [singular, plural], chosen by the `n` parameter;
 * only languages that inflect for number (English) need it.
 */
export type Text = string | readonly [one: string, other: string]

/** A string in every target language. The Vietnamese is the key it sits under. */
export type Translations = Record<TargetLocale, Text>

/** A catalog file: Vietnamese source text → its translations. */
export type Messages = Record<string, Translations>
