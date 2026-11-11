import { useMutation } from '@tanstack/react-query'
import { FlaskConical, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PLATFORM_NAMES } from '@/features/news/labels'
import { t, translated } from '@/i18n'
import { REGION_LABELS, relativeTime } from '@/lib/format'
import { newsService } from '@/services'
import type { NewsSource, NewsSourceInput, NewsSourceType, Region, SocialPlatform } from '@/services/types'

import { SOURCE_TYPE_LABELS, sourceInput } from './sourceForm'

const SOURCE_TYPE_HINTS = translated<NewsSourceType>({
  rss: 'Dán link RSS của chuyên mục, ví dụ https://vnexpress.net/rss/du-lich.rss.',
  google_news: 'Gõ từ khoá, ví dụ "du lịch Đà Lạt". Google News gom tin từ nhiều báo.',
  youtube_channel: 'Dán link kênh (https://www.youtube.com/@ten-kenh hoặc /channel/UC…).',
  social: 'X, Reddit, Facebook, Instagram, YouTube, Xiaohongshu, Bilibili. Cần máy cào chạy Agent Reach (tab Máy cào).',
})

const TYPES: NewsSourceType[] = ['rss', 'google_news', 'youtube_channel', 'social']
const PLATFORMS = Object.keys(PLATFORM_NAMES) as SocialPlatform[]
const REGIONS: Region[] = ['north', 'central', 'south', 'islands', 'overseas']

const EMPTY: NewsSourceInput = {
  name: '',
  type: 'rss',
  url: '',
  query: '',
  platform: null,
  includeKeywords: [],
  excludeKeywords: [],
  defaultRegion: null,
  enabled: true,
  autoPublish: false,
  intervalMinutes: 60,
}

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm'

const toList = (text: string) =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

/** Thêm or Sửa a news source, with "Thử nguồn" to see what it would bring in. */
export function SourceDialog({
  source,
  open,
  onOpenChange,
  onSaved,
}: {
  /** null: a new source. */
  source: NewsSource | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (source: NewsSource, created: boolean) => void
}) {
  const [form, setForm] = useState<NewsSourceInput>(() => (source ? sourceInput(source) : EMPTY))
  const [include, setInclude] = useState(source?.includeKeywords.join(', ') ?? '')
  const [exclude, setExclude] = useState(source?.excludeKeywords.join(', ') ?? '')
  const set = <K extends keyof NewsSourceInput>(key: K, value: NewsSourceInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  const input = (): NewsSourceInput => ({
    ...form,
    platform: form.type === 'social' ? form.platform : null,
    includeKeywords: toList(include),
    excludeKeywords: toList(exclude),
  })

  const save = useMutation({
    mutationFn: () => (source ? newsService.updateSource(source._id, input()) : newsService.createSource(input())),
    onSuccess: (saved) => onSaved(saved, !source),
  })
  const preview = useMutation({ mutationFn: () => newsService.previewSource({ type: form.type, url: form.url, query: form.query }) })

  const needsUrl = form.type === 'rss' || form.type === 'youtube_channel'
  const needsQuery = form.type === 'google_news' || form.type === 'social'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{source ? t('Sửa nguồn tin') : t('Thêm nguồn tin')}</DialogTitle>
          <DialogDescription>{SOURCE_TYPE_HINTS[form.type]}</DialogDescription>
        </DialogHeader>

        <form
          id="news-source-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ns-name">{t('Tên nguồn')}</Label>
            <Input id="ns-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('Ví dụ: VnExpress Du lịch')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-type">{t('Loại nguồn')}</Label>
            <select
              id="ns-type"
              className={selectClass}
              value={form.type}
              onChange={(e) => {
                set('type', e.target.value as NewsSourceType)
                preview.reset()
              }}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {SOURCE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          {form.type === 'social' && (
            <div className="space-y-1.5">
              <Label htmlFor="ns-platform">{t('Nền tảng')}</Label>
              <select
                id="ns-platform"
                className={selectClass}
                value={form.platform ?? ''}
                onChange={(e) => set('platform', (e.target.value || null) as SocialPlatform | null)}
              >
                <option value="">{t('Chọn nền tảng')}</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_NAMES[p]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(needsUrl || form.type === 'social') && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ns-url">{form.type === 'social' ? t('Đường dẫn trang (không bắt buộc)') : t('Đường dẫn')}</Label>
              <Input id="ns-url" type="url" value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" />
            </div>
          )}
          {needsQuery && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ns-query">{t('Từ khoá tìm kiếm')}</Label>
              <Input id="ns-query" value={form.query} onChange={(e) => set('query', e.target.value)} placeholder={t('Ví dụ: du lịch Việt Nam')} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ns-include">{t('Chỉ lấy tin có từ (cách nhau bằng dấu phẩy)')}</Label>
            <Input id="ns-include" value={include} onChange={(e) => setInclude(e.target.value)} placeholder={t('du lịch, homestay')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-exclude">{t('Bỏ tin có từ')}</Label>
            <Input id="ns-exclude" value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder={t('tai nạn, quảng cáo')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-region">{t('Vùng mặc định')}</Label>
            <select
              id="ns-region"
              className={selectClass}
              value={form.defaultRegion ?? ''}
              onChange={(e) => set('defaultRegion', (e.target.value || null) as Region | null)}
            >
              <option value="">{t('Để AI xác định')}</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {REGION_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-interval">{t('Cào lại mỗi (phút)')}</Label>
            <Input
              id="ns-interval"
              type="number"
              min={30}
              step={30}
              value={form.intervalMinutes}
              onChange={(e) => set('intervalMinutes', Number(e.target.value) || 60)}
            />
          </div>
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <Checkbox checked={form.enabled} onCheckedChange={(v) => set('enabled', v === true)} className="mt-0.5" />
            <span>
              <span className="font-medium">{t('Đang bật')}</span>
              <span className="block text-muted-foreground">{t('Tắt để ngừng cào nguồn này mà vẫn giữ tin đã có.')}</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <Checkbox checked={form.autoPublish} onCheckedChange={(v) => set('autoPublish', v === true)} className="mt-0.5" />
            <span>
              <span className="font-medium">{t('Tự đăng lên Newsfeed')}</span>
              <span className="block text-muted-foreground">
                {t('Tin AI đánh giá là tin du lịch sẽ lên ngay. Tắt: mọi tin chờ admin duyệt ở tab Chờ duyệt.')}
              </span>
            </span>
          </label>
        </form>

        {form.type !== 'social' && (
          <section className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{t('Thử nguồn trước khi lưu')}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => preview.mutate()} disabled={preview.isPending}>
                {preview.isPending ? <Loader2 className="animate-spin" /> : <FlaskConical />}
                {t('Thử nguồn')}
              </Button>
            </div>
            {preview.isError && <p className="text-sm text-destructive">{(preview.error as Error).message}</p>}
            {preview.data && (
              <>
                <p className="text-sm text-muted-foreground">{t('Đọc được {count} tin. 5 tin đầu:', { count: preview.data.total })}</p>
                <ul className="space-y-2">
                  {preview.data.items.map((item) => (
                    <li key={item.url} className="flex gap-3 text-sm">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" className="h-12 w-20 shrink-0 rounded object-cover" />
                      ) : (
                        <div className="h-12 w-20 shrink-0 rounded bg-muted" />
                      )}
                      <span className="min-w-0">
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-medium hover:underline">
                          {item.title}
                        </a>
                        <span className="text-xs text-muted-foreground">{relativeTime(item.publishedAt)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {save.isError && <p className="text-sm text-destructive">{(save.error as Error).message}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('Huỷ')}
          </Button>
          <Button type="submit" form="news-source-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {source ? t('Lưu thay đổi') : t('Thêm nguồn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
