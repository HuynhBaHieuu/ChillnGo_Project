import { translated } from '@/i18n'
import type { NewsSource, NewsSourceInput, NewsSourceType } from '@/services/types'

export const SOURCE_TYPE_LABELS = translated<NewsSourceType>({
  rss: 'Báo / trang tin (RSS)',
  google_news: 'Google News theo từ khoá',
  youtube_channel: 'Kênh YouTube',
  social: 'Mạng xã hội (máy cào)',
})

/** The editable fields of a source, as the API takes them. */
export function sourceInput(source: NewsSource): NewsSourceInput {
  const { name, type, url, query, platform, includeKeywords, excludeKeywords, defaultRegion, enabled, autoPublish, intervalMinutes } = source
  return { name, type, url, query, platform, includeKeywords, excludeKeywords, defaultRegion, enabled, autoPublish, intervalMinutes }
}
