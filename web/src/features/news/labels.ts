import type { NewsItem, SocialPlatform } from '@/services/types'

export const PLATFORM_NAMES: Record<SocialPlatform, string> = {
  twitter: 'X',
  reddit: 'Reddit',
  youtube: 'YouTube',
  facebook: 'Facebook',
  instagram: 'Instagram',
  xiaohongshu: 'Xiaohongshu',
  bilibili: 'Bilibili',
}

/** Where the news came from, e.g. "VnExpress" or "Reddit · r/VietNam". */
export function newsOrigin(item: Pick<NewsItem, 'sourceName' | 'platform' | 'author'>): string {
  if (item.platform) return [PLATFORM_NAMES[item.platform], item.author].filter(Boolean).join(' · ')
  return item.sourceName
}
