import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, KeyRound, Loader2, Pencil, Pin, PinOff, Play, Plus, RefreshCw, Search, Sparkles, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { PLATFORM_NAMES, newsOrigin } from '@/features/news/labels'
import { t, translated } from '@/i18n'
import { REGION_LABELS, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { newsService } from '@/services'
import type { NewsReviewAction } from '@/services/news.service'
import type { NewsItem, NewsSource, NewsSourceInput, NewsStatus, Region } from '@/services/types'

import { ConfirmDialog, Pagination, formatDateTime } from '../shared'
import type { Notice } from '../shared'
import { SourceDialog } from './SourceDialog'
import { SOURCE_TYPE_LABELS, sourceInput } from './sourceForm'

type PanelTab = 'sources' | 'pending' | 'published' | 'hidden' | 'rejected' | 'runs' | 'worker'
type ItemTab = Extract<PanelTab, NewsStatus>

const REGIONS: Region[] = ['north', 'central', 'south', 'islands', 'overseas']

const ACTION_LABELS = translated<NewsReviewAction>({
  approve: 'Đăng lên Newsfeed',
  reject: 'Loại tin',
  hide: 'Ẩn tin',
  unhide: 'Hiện lại',
})

/** Which decisions apply in each status (the API checks the same). */
const ACTIONS: Record<ItemTab, NewsReviewAction[]> = {
  pending: ['approve', 'reject'],
  published: ['hide'],
  hidden: ['unhide'],
  rejected: ['approve'],
}

const TRIGGER_LABELS = translated<'schedule' | 'manual' | 'worker'>({
  schedule: 'Theo lịch',
  manual: 'Bấm tay',
  worker: 'Máy cào',
})

/** Tin tức: the sources the Newsfeed's travel news comes from, and the news itself. */
export function NewsPanel({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const [tab, setTab] = useState<PanelTab>('sources')
  const queryClient = useQueryClient()

  const runAll = useMutation({
    mutationFn: newsService.runAll,
    onSuccess: async ({ sources, enriched }) => {
      const created = sources.reduce((n, s) => n + (s.created ?? 0), 0)
      const failed = sources.filter((s) => !s.ok).length
      onNotice({
        kind: failed ? 'error' : 'success',
        text:
          sources.length === 0
            ? t('Không có nguồn nào đang bật để cào.')
            : t('Đã cào {sources} nguồn: {created} tin mới, AI xử lý {enriched} tin, {failed} nguồn lỗi.', {
                sources: sources.length,
                created,
                enriched,
                failed,
              }),
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'news'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
    onError: (error) => onNotice({ kind: 'error', text: (error as Error).message }),
  })

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as PanelTab)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList>
            <TabsTrigger value="sources">{t('Nguồn')}</TabsTrigger>
            <TabsTrigger value="pending">{t('Chờ duyệt')}</TabsTrigger>
            <TabsTrigger value="published">{t('Đã đăng')}</TabsTrigger>
            <TabsTrigger value="hidden">{t('Đã ẩn')}</TabsTrigger>
            <TabsTrigger value="rejected">{t('Bị loại')}</TabsTrigger>
            <TabsTrigger value="runs">{t('Nhật ký cào')}</TabsTrigger>
            <TabsTrigger value="worker">{t('Máy cào')}</TabsTrigger>
          </TabsList>
        </div>
        <Button variant="outline" onClick={() => runAll.mutate()} disabled={runAll.isPending}>
          {runAll.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {t('Cào tất cả ngay')}
        </Button>
      </div>
      <TabsContent value="sources">
        <SourcesTab onNotice={onNotice} />
      </TabsContent>
      {(['pending', 'published', 'hidden', 'rejected'] as const).map((status) => (
        <TabsContent key={status} value={status}>
          <ItemsTab status={status} onNotice={onNotice} />
        </TabsContent>
      ))}
      <TabsContent value="runs">
        <RunsTab />
      </TabsContent>
      <TabsContent value="worker">
        <WorkerTab onNotice={onNotice} />
      </TabsContent>
    </Tabs>
  )
}

/* --------------------------------------------------------------- sources */

function SourcesTab({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<NewsSource | 'new' | null>(null)
  const [deleting, setDeleting] = useState<NewsSource | null>(null)
  const sources = useQuery({ queryKey: ['admin', 'news', 'sources'], queryFn: newsService.getSources })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'news'] })
  const fail = (error: unknown) => onNotice({ kind: 'error', text: (error as Error).message })

  const toggle = useMutation({
    mutationFn: ({ source, patch }: { source: NewsSource; patch: Partial<NewsSourceInput> }) =>
      newsService.updateSource(source._id, { ...sourceInput(source), ...patch }),
    onSuccess: refresh,
    onError: fail,
  })

  const run = useMutation({
    mutationFn: (source: NewsSource) => newsService.runSource(source._id),
    onSuccess: async ({ result, enriched }, source) => {
      onNotice(
        result.ok
          ? {
              kind: 'success',
              text: t('{name}: đọc {fetched} tin, {created} tin mới, {duplicates} đã có, {filtered} bị lọc. AI xử lý {enriched} tin.', {
                name: source.name,
                fetched: result.fetched ?? 0,
                created: result.created ?? 0,
                duplicates: result.duplicates ?? 0,
                filtered: result.filtered ?? 0,
                enriched,
              }),
            }
          : { kind: 'error', text: t('{name}: {error}', { name: source.name, error: result.error ?? '' }) },
      )
      await refresh()
      await queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
    onError: fail,
  })

  const remove = useMutation({
    mutationFn: (source: NewsSource) => newsService.deleteSource(source._id),
    onSuccess: async (_d, source) => {
      onNotice({ kind: 'success', text: t('Đã xoá nguồn {name}. Tin đã có vẫn được giữ.', { name: source.name }) })
      setDeleting(null)
      await refresh()
    },
    onError: fail,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t('Nguồn được cào tự động mỗi giờ. Tin mới đi qua bộ lọc từ khoá, AI tóm tắt và gắn vùng, rồi lên Newsfeed hoặc chờ duyệt tuỳ nguồn.')}
        </p>
        <Button onClick={() => setEditing('new')}>
          <Plus />
          {t('Thêm nguồn')}
        </Button>
      </div>

      {sources.isPending ? (
        <Loading />
      ) : sources.isError ? (
        <p className="text-sm text-destructive">{(sources.error as Error).message}</p>
      ) : sources.data.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t('Chưa có nguồn nào. Bấm Thêm nguồn, ví dụ RSS https://vnexpress.net/rss/du-lich.rss.')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-foreground/10">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('Nguồn')}</th>
                <th className="px-4 py-3 font-medium">{t('Lần cào gần nhất')}</th>
                <th className="px-4 py-3 font-medium">{t('Tin')}</th>
                <th className="px-4 py-3 font-medium">{t('Bật')}</th>
                <th className="px-4 py-3 font-medium">{t('Tự đăng')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('Thao tác')}</th>
              </tr>
            </thead>
            <tbody>
              {sources.data.items.map((source) => (
                <tr key={source._id} className="border-t border-foreground/10 align-top">
                  <td className="max-w-[18rem] px-4 py-3">
                    <p className="font-semibold">{source.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {SOURCE_TYPE_LABELS[source.type]}
                      {source.platform && ` · ${PLATFORM_NAMES[source.platform]}`}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={source.query || source.url}>
                      {source.query ? `“${source.query}”` : source.url}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {source.lastRunAt ? (
                      <>
                        <p>{relativeTime(source.lastRunAt)}</p>
                        {source.lastStatus === 'error' ? (
                          <p className="max-w-[16rem] text-xs text-destructive">{source.lastError}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">{t('{count} tin mới', { count: source.lastNewCount })}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground">{t('Chưa cào')}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <p>{t('{count} đã đăng', { count: source.counts?.published ?? 0 })}</p>
                    <p>{t('{count} chờ duyệt', { count: (source.counts?.pending ?? 0) + (source.counts?.queued ?? 0) })}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={source.enabled}
                      aria-label={t('Bật nguồn {name}', { name: source.name })}
                      onCheckedChange={(v) => toggle.mutate({ source, patch: { enabled: v === true } })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={source.autoPublish}
                      aria-label={t('Tự đăng tin của {name}', { name: source.name })}
                      onCheckedChange={(v) => toggle.mutate({ source, patch: { autoPublish: v === true } })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => run.mutate(source)}
                        disabled={source.type === 'social' || (run.isPending && run.variables?._id === source._id)}
                        title={source.type === 'social' ? t('Nguồn mạng xã hội do máy cào lấy') : undefined}
                      >
                        {run.isPending && run.variables?._id === source._id ? <Loader2 className="animate-spin" /> : <Play />}
                        {t('Cào ngay')}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(source)} aria-label={t('Sửa nguồn {name}', { name: source.name })}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(source)} aria-label={t('Xoá nguồn {name}', { name: source.name })}>
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <SourceDialog
          key={editing === 'new' ? 'new' : editing._id}
          source={editing === 'new' ? null : editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={async (saved, created) => {
            onNotice({ kind: 'success', text: created ? t('Đã thêm nguồn {name}.', { name: saved.name }) : t('Đã lưu nguồn {name}.', { name: saved.name }) })
            setEditing(null)
            await refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t('Xoá nguồn này?')}
        description={t('Nguồn {name} sẽ ngừng được cào. Tin đã đăng từ nguồn này vẫn còn trên Newsfeed.', { name: deleting?.name ?? '' })}
        confirmLabel={t('Xoá nguồn')}
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  )
}

/* ----------------------------------------------------------------- items */

function ItemsTab({ status, onNotice }: { status: ItemTab; onNotice: (notice: Notice) => void }) {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [editing, setEditing] = useState<NewsItem | null>(null)

  const list = useQuery({
    queryKey: ['admin', 'news', 'items', status, search, page],
    queryFn: () => newsService.getItems({ status, q: search || undefined, page }),
  })
  const refresh = async () => {
    setSelected([])
    await queryClient.invalidateQueries({ queryKey: ['admin', 'news'] })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    await queryClient.invalidateQueries({ queryKey: ['news'] })
  }
  const fail = (error: unknown) => onNotice({ kind: 'error', text: (error as Error).message })

  const review = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: NewsReviewAction }) => newsService.reviewItems(ids, action),
    onSuccess: async ({ updated }, { action }) => {
      onNotice({ kind: 'success', text: t('{action}: {count} tin.', { action: ACTION_LABELS[action], count: updated }) })
      await refresh()
    },
    onError: fail,
  })
  const pin = useMutation({
    mutationFn: (item: NewsItem) => newsService.patchItem(item._id, { pinned: !item.pinned }),
    onSuccess: async (item) => {
      onNotice({ kind: 'success', text: item.pinned ? t('Đã ghim tin lên đầu Newsfeed.') : t('Đã bỏ ghim tin.') })
      await refresh()
    },
    onError: fail,
  })

  const items = list.data?.items ?? []
  const allSelected = items.length > 0 && items.every((i) => selected.includes(i._id))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {ACTIONS[status].length > 0 && items.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v === true ? items.map((i) => i._id) : [])} />
              {t('Chọn tất cả')}
            </label>
            {ACTIONS[status].map((action) => (
              <Button
                key={action}
                size="sm"
                variant={action === 'approve' || action === 'unhide' ? 'default' : 'outline'}
                disabled={selected.length === 0 || review.isPending}
                onClick={() => review.mutate({ ids: selected, action })}
              >
                {t('{action} ({count})', { action: ACTION_LABELS[action], count: selected.length })}
              </Button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(q.trim())
            setPage(1)
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Tìm theo tiêu đề…')} className="w-56" />
          <Button type="submit" variant="outline" size="icon" aria-label={t('Tìm')}>
            <Search className="size-4" aria-hidden />
          </Button>
        </form>
      </div>

      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <p className="text-sm text-destructive">{(list.error as Error).message}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('Không có tin nào ở mục này.')}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item._id} className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-card p-4 md:flex-row">
              <div className="flex gap-3 md:contents">
                <Checkbox
                  className="mt-1"
                  checked={selected.includes(item._id)}
                  aria-label={t('Chọn tin {title}', { title: item.title })}
                  onCheckedChange={(v) => setSelected((s) => (v === true ? [...s, item._id] : s.filter((id) => id !== item._id)))}
                />
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" className="h-24 w-full shrink-0 rounded-xl object-cover md:w-40" />
                ) : (
                  <div className="hidden h-24 w-40 shrink-0 rounded-xl bg-muted md:block" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {item.pinned && <Badge variant="solid">{t('Đã ghim')}</Badge>}
                  {item.aiStatus === 'failed' && <Badge variant="outline">{t('AI lỗi, dùng trích đoạn')}</Badge>}
                  {item.aiStatus === 'skipped' && <Badge variant="outline">{t('Chưa có AI')}</Badge>}
                  {(item.content?.length ?? 0) === 0 && <Badge variant="outline">{t('Chưa có bài viết')}</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {newsOrigin(item)} · {formatDateTime(item.publishedAt)}
                  </span>
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="block font-semibold hover:underline">
                  {item.title}
                </a>
                <p className="line-clamp-3 text-muted-foreground">{item.summary || t('(Chưa có tóm tắt)')}</p>
                <p className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  {item.regions.map((r) => (
                    <Badge key={r} variant="outline">
                      {REGION_LABELS[r]}
                    </Badge>
                  ))}
                  {item.destinations.map((d) => (
                    <Badge key={d} variant="outline">
                      📍 {d}
                    </Badge>
                  ))}
                  {status === 'published' && <span className="self-center">{t('{count} lượt mở', { count: item.clickCount ?? 0 })}</span>}
                </p>
                {item.statusReason && <p className="text-xs text-destructive">{t('Lý do: {reason}', { reason: item.statusReason })}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap items-start gap-2 md:w-44 md:flex-col md:items-stretch">
                {ACTIONS[status].map((action) => (
                  <Button
                    key={action}
                    size="sm"
                    variant={action === 'approve' || action === 'unhide' ? 'default' : 'outline'}
                    disabled={review.isPending}
                    onClick={() => review.mutate({ ids: [item._id], action })}
                  >
                    {ACTION_LABELS[action]}
                  </Button>
                ))}
                {status === 'published' && (
                  <Button size="sm" variant="outline" onClick={() => pin.mutate(item)} disabled={pin.isPending}>
                    {item.pinned ? <PinOff /> : <Pin />}
                    {item.pinned ? t('Bỏ ghim') : t('Ghim')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditing(item)}>
                  <Pencil />
                  {t('Sửa bài')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}

      {editing && (
        <EditItemDialog
          key={editing._id}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            onNotice({ kind: 'success', text: t('Đã lưu tin.') })
            setEditing(null)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

function EditItemDialog({ item, onClose, onSaved }: { item: NewsItem; onClose: () => void; onSaved: () => void }) {
  const [headline, setHeadline] = useState(item.headline ?? '')
  const [summary, setSummary] = useState(item.aiSummary ?? '')
  // One paragraph per block; blocks are separated by an empty line.
  const [content, setContent] = useState((item.content ?? []).join('\n\n'))
  const [images, setImages] = useState(item.images)
  const [regions, setRegions] = useState<Region[]>(item.regions)
  const [destinations, setDestinations] = useState(item.destinations.join(', '))
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const save = useMutation({
    mutationFn: () =>
      newsService.patchItem(item._id, {
        headline: headline.trim(),
        summary: summary.trim(),
        content: paragraphs,
        images,
        regions,
        destinations: destinations
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: onSaved,
  })
  // The AI's new post replaces what is in the form; nothing is saved twice.
  const rewrite = useMutation({
    mutationFn: () => newsService.rewriteItem(item._id),
    onSuccess: (fresh) => {
      setHeadline(fresh.headline ?? '')
      setSummary(fresh.aiSummary ?? '')
      setContent((fresh.content ?? []).join('\n\n'))
      setImages(fresh.images)
      setRegions(fresh.regions)
      setDestinations(fresh.destinations.join(', '))
    },
  })
  const busy = save.isPending || rewrite.isPending
  const failure = (save.error ?? rewrite.error) as Error | null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('Sửa bài')}</DialogTitle>
          <DialogDescription>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
              <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              <span className="line-clamp-1">{item.originalTitle ?? item.title}</span>
            </a>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-foreground/10 p-3">
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              {item.writtenAt
                ? t('AI viết bài này lúc {time}.', { time: formatDateTime(item.writtenAt) })
                : t('Tin này chưa có bài viết. AI có thể đọc bài gốc và viết ngay.')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => rewrite.mutate()} disabled={busy}>
              {rewrite.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {rewrite.isPending ? t('Đang viết…') : t('Viết lại bằng AI')}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ni-headline">{t('Tiêu đề hiển thị')}</Label>
            <Input
              id="ni-headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={200}
              placeholder={item.originalTitle ?? item.title}
            />
            <p className="text-xs text-muted-foreground">{t('Để trống thì dùng tiêu đề của nguồn.')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ni-summary">{t('Tóm tắt hiển thị trên Newsfeed')}</Label>
            <Textarea id="ni-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={600} />
            {item.excerpt && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">{t('Xem trích đoạn gốc')}</summary>
                <p className="mt-1 whitespace-pre-line">{item.excerpt}</p>
              </details>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ni-content">{t('Nội dung bài')}</Label>
            <Textarea id="ni-content" rows={12} value={content} onChange={(e) => setContent(e.target.value)} className="leading-relaxed" />
            <p className={cn('text-xs', paragraphs.length > 8 ? 'text-destructive' : 'text-muted-foreground')}>
              {t('{count}/8 đoạn. Mỗi đoạn cách nhau một dòng trống.', { count: paragraphs.length })}
            </p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('Ảnh ({count})', { count: images.length })}</legend>
            {images.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('Bài này không có ảnh.')}</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {images.map((url, index) => (
                  <li key={url} className="relative">
                    <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-square w-full rounded-lg bg-muted object-cover" />
                    {index === 0 && (
                      <Badge variant="solid" className="absolute bottom-1 left-1">
                        {t('Ảnh bìa')}
                      </Badge>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute right-1 top-1 size-6 rounded-full"
                      aria-label={t('Bỏ ảnh {n}', { n: index + 1 })}
                      title={t('Bỏ ảnh {n}', { n: index + 1 })}
                      onClick={() => setImages((list) => list.filter((x) => x !== url))}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('Vùng')}</legend>
            <div className="flex flex-wrap gap-3">
              {REGIONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={regions.includes(r)}
                    onCheckedChange={(v) => setRegions((list) => (v === true ? [...list, r] : list.filter((x) => x !== r)))}
                  />
                  {REGION_LABELS[r]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="ni-dest">{t('Địa điểm (cách nhau bằng dấu phẩy)')}</Label>
            <Input id="ni-dest" value={destinations} onChange={(e) => setDestinations(e.target.value)} placeholder={t('Đà Lạt, Hội An')} />
          </div>
          {failure && <p className="text-sm text-destructive">{failure.message}</p>}
        </div>
        <DialogFooter>
          {item.status === 'published' && (
            <Button asChild variant="ghost" className="sm:mr-auto">
              <a href={`/news/${item._id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                {t('Xem trang tin')}
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t('Huỷ')}
          </Button>
          <Button onClick={() => save.mutate()} disabled={busy || paragraphs.length > 8}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {t('Lưu thay đổi')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ runs */

function RunsTab() {
  const [page, setPage] = useState(1)
  const runs = useQuery({ queryKey: ['admin', 'news', 'runs', page], queryFn: () => newsService.getRuns(page) })

  if (runs.isPending) return <Loading />
  if (runs.isError) return <p className="text-sm text-destructive">{(runs.error as Error).message}</p>
  if (runs.data.items.length === 0) return <p className="text-sm text-muted-foreground">{t('Chưa có lần cào nào. Nhật ký giữ 30 ngày.')}</p>

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-foreground/10">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('Thời gian')}</th>
              <th className="px-4 py-3 font-medium">{t('Nguồn')}</th>
              <th className="px-4 py-3 font-medium">{t('Cách chạy')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('Đọc được')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('Mới')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('Trùng')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('Bị lọc')}</th>
              <th className="px-4 py-3 font-medium">{t('Kết quả')}</th>
            </tr>
          </thead>
          <tbody>
            {runs.data.items.map((run) => (
              <tr key={run._id} className="border-t border-foreground/10 align-top">
                <td className="whitespace-nowrap px-4 py-2.5">{formatDateTime(run.createdAt)}</td>
                <td className="px-4 py-2.5">{run.sourceName}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{TRIGGER_LABELS[run.trigger]}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{run.fetched}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{run.created}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{run.duplicates}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{run.filtered}</td>
                <td className={cn('max-w-[20rem] px-4 py-2.5', run.error ? 'text-destructive' : 'text-muted-foreground')}>
                  {run.error || t('Thành công ({seconds} giây)', { seconds: (run.durationMs / 1000).toFixed(1) })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={runs.data.page} pageSize={runs.data.pageSize} total={runs.data.total} onPage={setPage} />
    </div>
  )
}

/* ---------------------------------------------------------------- worker */

function WorkerTab({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const queryClient = useQueryClient()
  const [newKey, setNewKey] = useState<string | null>(null)
  const [revoking, setRevoking] = useState(false)
  const worker = useQuery({ queryKey: ['admin', 'news', 'worker'], queryFn: newsService.getWorker })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'news', 'worker'] })

  const create = useMutation({
    mutationFn: newsService.createWorkerKey,
    onSuccess: async (key) => {
      setNewKey(key)
      await refresh()
    },
    onError: (error) => onNotice({ kind: 'error', text: (error as Error).message }),
  })
  const revoke = useMutation({
    mutationFn: newsService.revokeWorkerKey,
    onSuccess: async () => {
      onNotice({ kind: 'success', text: t('Đã thu hồi mã. Máy cào dùng mã cũ sẽ bị từ chối.') })
      setRevoking(false)
      await refresh()
    },
    onError: (error) => onNotice({ kind: 'error', text: (error as Error).message }),
  })

  if (worker.isPending) return <Loading />
  if (worker.isError) return <p className="text-sm text-destructive">{(worker.error as Error).message}</p>
  const w = worker.data

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-foreground/10 bg-card p-5">
        <h3 className="font-display text-lg">{t('Trạng thái máy cào')}</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-muted-foreground">{t('Mã kết nối')}</dt>
          <dd>{w.hasKey ? `${w.keyHint}…` : t('Chưa tạo')}</dd>
          <dt className="text-muted-foreground">{t('Tạo lúc')}</dt>
          <dd>{w.createdAt ? formatDateTime(w.createdAt) : '—'}</dd>
          <dt className="text-muted-foreground">{t('Lần cuối kết nối')}</dt>
          <dd>{w.lastSeenAt ? relativeTime(w.lastSeenAt) : t('Chưa kết nối')}</dd>
          <dt className="text-muted-foreground">{t('Nguồn mạng xã hội đang bật')}</dt>
          <dd>{w.socialSources}</dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
            {w.hasKey ? t('Tạo mã mới') : t('Tạo mã')}
          </Button>
          {w.hasKey && (
            <Button variant="outline" onClick={() => setRevoking(true)}>
              {t('Thu hồi mã')}
            </Button>
          )}
        </div>
        {w.hasKey && <p className="text-xs text-muted-foreground">{t('Tạo mã mới sẽ làm mã cũ hết hiệu lực.')}</p>}
      </section>

      <section className="space-y-3 rounded-2xl border border-foreground/10 bg-card p-5 text-sm">
        <h3 className="font-display text-lg">{t('Cài máy cào')}</h3>
        <p className="text-muted-foreground">
          {t('Nguồn mạng xã hội cần đăng nhập nên không cào được trên máy chủ. Một máy tính chạy Agent Reach sẽ cào giúp và gửi tin về đây.')}
        </p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>{t('Cài Agent Reach và đăng nhập các nền tảng bằng tài khoản phụ.')}</li>
          <li>{t('Bấm Tạo mã ở bên trái và chép mã (chỉ hiện một lần).')}</li>
          <li>
            {t('Trong thư mục tools/news-worker của dự án, tạo file worker.env gồm:')}
            <pre className="mt-1.5 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              {`CHILLNGO_API=${window.location.origin.includes('localhost') ? 'http://localhost:4000' : 'https://chillgo-project.vercel.app'}\nCHILLNGO_WORKER_KEY=cgw_…`}
            </pre>
          </li>
          <li>{t('Chạy node worker.mjs, rồi đặt lịch chạy mỗi 1–2 giờ (Task Scheduler hoặc cron).')}</li>
        </ol>
      </section>

      <Dialog open={newKey !== null} onOpenChange={(open) => !open && setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Mã máy cào mới')}</DialogTitle>
            <DialogDescription>{t('Chép mã này vào worker.env ngay. Đóng hộp thoại là không xem lại được.')}</DialogDescription>
          </DialogHeader>
          <code className="block break-all rounded-lg bg-muted p-3 text-sm">{newKey}</code>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(newKey ?? '')
                onNotice({ kind: 'success', text: t('Đã chép mã.') })
              }}
            >
              <Copy />
              {t('Chép mã')}
            </Button>
            <Button onClick={() => setNewKey(null)}>{t('Xong')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revoking}
        title={t('Thu hồi mã máy cào?')}
        description={t('Máy cào sẽ ngừng gửi được tin cho tới khi bạn tạo mã mới.')}
        confirmLabel={t('Thu hồi mã')}
        destructive
        pending={revoke.isPending}
        onConfirm={() => revoke.mutate()}
        onOpenChange={setRevoking}
      />
    </div>
  )
}

function Loading() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {t('Đang tải…')}
    </p>
  )
}
