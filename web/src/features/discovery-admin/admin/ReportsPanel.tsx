import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, EyeOff, ExternalLink, Eye, Loader2, Lock, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  REPORT_ACTION_LABELS,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
} from '@/features/report/labels'
import { t } from '@/i18n'
import type { MessageKey } from '@/i18n'
import { hasModule } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { reportService } from '@/services'
import type {
  ReportGroup,
  ReportPerson,
  ReportReason,
  ReportSnapshot,
  ReportStatus,
  ReportTargetState,
  ReportTargetType,
  ResolveAction,
  User,
} from '@/services/types'

import { linkFor } from './moderationLinks'
import { Avatar, ConfirmDialog, Pagination, formatDateTime } from './shared'
import type { Notice } from './shared'

const ALL = 'all'
const STATUSES: ReportStatus[] = ['pending', 'resolved', 'dismissed']
const TYPES: ReportTargetType[] = ['post', 'comment', 'checkin', 'user', 'business', 'businessPost']

interface Selected {
  targetType: ReportTargetType
  targetId: string
}

/**
 * Kiểm duyệt nội dung: reports grouped by what they are about, and the page
 * for one piece of content with its reports and the decision buttons.
 */
export function ReportsPanel({ actor, onNotice }: { actor: User; onNotice: (notice: Notice) => void }) {
  const [selected, setSelected] = useState<Selected | null>(null)

  if (selected) {
    return (
      <ReportDetail
        actor={actor}
        targetType={selected.targetType}
        targetId={selected.targetId}
        onBack={() => setSelected(null)}
        onNotice={onNotice}
      />
    )
  }
  return <ReportQueue onOpen={setSelected} />
}

/* ------------------------------------------------------------------ queue */

function ReportQueue({ onOpen }: { onOpen: (selected: Selected) => void }) {
  const [status, setStatus] = useState<ReportStatus>('pending')
  const [type, setType] = useState<string>(ALL)
  const [page, setPage] = useState(1)

  const params = { status, targetType: type === ALL ? undefined : (type as ReportTargetType), page }
  const list = useQuery({
    queryKey: ['admin', 'reports', params],
    queryFn: () => reportService.getReportQueue(params),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label={t('Trạng thái báo cáo')} className="inline-flex rounded-full border border-foreground/15 bg-card p-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              onClick={() => {
                setStatus(s)
                setPage(1)
              }}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                status === s ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(REPORT_STATUS_LABELS[s])}
            </button>
          ))}
        </div>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="sm:w-48" aria-label={t('Lọc theo loại nội dung')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('Mọi loại nội dung')}</SelectItem>
            {TYPES.map((tp) => (
              <SelectItem key={tp} value={tp}>
                <span className="capitalize">{t(REPORT_TARGET_LABELS[tp])}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('Đang tải danh sách…')}
        </p>
      ) : list.isError ? (
        <p className="text-sm text-destructive">{(list.error as Error).message}</p>
      ) : list.data.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-foreground/20 px-4 py-10 text-center text-sm text-muted-foreground">
          {status === 'pending' ? t('Không có báo cáo nào đang chờ xử lý.') : t('Chưa có báo cáo nào ở mục này.')}
        </p>
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-2xl border border-foreground/15 bg-card">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-foreground/10 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('Nội dung')}</th>
                  <th className="px-4 py-3 font-medium">{t('Chủ nội dung')}</th>
                  <th className="px-4 py-3 font-medium">{t('Báo cáo')}</th>
                  <th className="px-4 py-3 font-medium">{status === 'pending' ? t('Gần nhất') : t('Kết quả')}</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">{t('Thao tác')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((g) => (
                  <QueueRow key={`${g.targetType}:${g.targetId}`} group={g} onOpen={() => onOpen(g)} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">{t('{n} nội dung bị báo cáo', { n: list.data.total })}</p>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
          </div>
        </>
      )}
    </div>
  )
}

function topReasons(reasons: Record<ReportReason, number>): [ReportReason, number][] {
  return REPORT_REASONS.map((r) => [r, reasons[r] ?? 0] as [ReportReason, number])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
}

function QueueRow({ group, onOpen }: { group: ReportGroup; onOpen: () => void }) {
  return (
    <tr className="border-b border-foreground/5 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Thumb snapshot={group.snapshot} type={group.targetType} />
          <div className="min-w-0 max-w-72">
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <TypeBadge type={group.targetType} />
              <StateBadge state={group.target} />
            </p>
            <p className="mt-1 truncate font-semibold">{group.snapshot.title || group.snapshot.text || t('(không có tiêu đề)')}</p>
            {group.snapshot.title && group.snapshot.text && (
              <p className="truncate text-xs text-muted-foreground">{group.snapshot.text}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <PersonLine person={group.owner} />
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold tabular-nums">{t('{n} báo cáo', { n: group.count })}</p>
        <p className="mt-1 flex flex-wrap gap-1">
          {topReasons(group.reasons)
            .slice(0, 3)
            .map(([reason, n]) => (
              <span key={reason} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {t(REPORT_REASON_LABELS[reason])} · {n}
              </span>
            ))}
        </p>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {group.resolvedAt ? (
          <>
            <span className="block font-semibold text-foreground">{t(REPORT_ACTION_LABELS[group.action])}</span>
            {formatDateTime(group.resolvedAt)}
            {group.resolvedBy && <span className="block">{t('bởi {name}', { name: group.resolvedBy.displayName })}</span>}
          </>
        ) : (
          formatDateTime(group.lastReportedAt)
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <Button variant="outline" size="sm" onClick={onOpen}>
          {t('Xem xét')}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </td>
    </tr>
  )
}

/* ----------------------------------------------------------------- detail */

const ACTION_META: Record<ResolveAction, { label: MessageKey; icon: typeof Eye; destructive: boolean }> = {
  dismiss: { label: 'Bỏ qua (không vi phạm)', icon: ShieldCheck, destructive: false },
  hide: { label: 'Ẩn nội dung', icon: EyeOff, destructive: false },
  remove: { label: 'Gỡ nội dung', icon: Trash2, destructive: true },
  lock: { label: 'Khoá tài khoản', icon: Lock, destructive: true },
}

function ReportDetail({
  actor,
  targetType,
  targetId,
  onBack,
  onNotice,
}: Selected & { actor: User; onBack: () => void; onNotice: (notice: Notice) => void }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState<ResolveAction | null>(null)

  const detail = useQuery({
    queryKey: ['admin', 'reports', 'target', targetType, targetId],
    queryFn: () => reportService.getReportTarget(targetType, targetId),
  })

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  }

  const resolve = useMutation({
    mutationFn: (action: ResolveAction) => reportService.resolveReport(targetType, targetId, action, note.trim()),
    onSuccess: (result, action) => {
      setConfirm(null)
      setNote('')
      refresh()
      onNotice({ kind: 'success', text: t('{action}: đã xử lý {n} báo cáo.', { action: t(ACTION_META[action].label), n: result.resolved }) })
    },
    onError: (error) => {
      setConfirm(null)
      onNotice({ kind: 'error', text: (error as Error).message })
    },
  })

  const unhide = useMutation({
    mutationFn: () => reportService.unhideContent(targetType, targetId),
    onSuccess: () => {
      refresh()
      onNotice({ kind: 'success', text: t('Nội dung đã hiện lại.') })
    },
    onError: (error) => onNotice({ kind: 'error', text: (error as Error).message }),
  })

  const back = (
    <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
      <ArrowLeft className="size-4" aria-hidden />
      {t('Về danh sách báo cáo')}
    </Button>
  )

  if (detail.isPending) {
    return (
      <div className="space-y-4">
        {back}
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('Đang tải…')}
        </p>
      </div>
    )
  }
  if (detail.isError) {
    return (
      <div className="space-y-4">
        {back}
        <p className="text-sm text-destructive">{(detail.error as Error).message}</p>
      </div>
    )
  }

  const { target, reports } = detail.data
  const can = (action: ResolveAction) =>
    target.allowedActions.includes(action) && (action !== 'lock' || hasModule(actor, 'users'))
  const actions = (['dismiss', 'hide', 'remove', 'lock'] as ResolveAction[]).filter(can)
  const busy = resolve.isPending || unhide.isPending
  const canUnhide = targetType !== 'user' && target.exists && target.hidden && hasModule(actor, 'content')
  const link = linkFor(targetType, targetId, target.snapshot)

  return (
    <div className="space-y-6">
      {back}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Preview */}
        <section className="space-y-4 rounded-2xl border border-foreground/15 bg-card p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <TypeBadge type={targetType} />
            <StateBadge state={target} />
          </div>
          {target.snapshot.imageUrl && (
            <img
              src={target.snapshot.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              className={cn('w-full rounded-xl object-cover', targetType === 'user' ? 'size-24 rounded-full' : 'max-h-72')}
            />
          )}
          {target.snapshot.title && <h3 className="font-display text-2xl">{target.snapshot.title}</h3>}
          {target.snapshot.text && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{target.snapshot.text}</p>
          )}
          {!target.exists && (
            <p className="text-xs text-muted-foreground">{t('Nội dung đã bị xoá. Đây là bản lưu lúc bị báo cáo.')}</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 pt-4">
            <PersonLine person={target.owner} />
            {link && target.exists && (
              <Button asChild variant="outline" size="sm">
                <Link to={link} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" aria-hidden />
                  {t('Mở nội dung')}
                </Link>
              </Button>
            )}
          </div>
        </section>

        {/* Decision */}
        <aside className="space-y-4 rounded-2xl border border-foreground/15 bg-card p-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t('Đang chờ xử lý')}</p>
            <p className="mt-1 font-display text-3xl tabular-nums">{target.pendingCount}</p>
          </div>
          {target.pendingCount > 0 && (
            <ul className="space-y-1 text-sm">
              {topReasons(target.reasons).map(([reason, n]) => (
                <li key={reason} className="flex justify-between gap-2">
                  <span>{t(REPORT_REASON_LABELS[reason])}</span>
                  <span className="tabular-nums text-muted-foreground">{n}</span>
                </li>
              ))}
            </ul>
          )}

          {target.pendingCount > 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="resolution-note">{t('Ghi chú quyết định (không bắt buộc)')}</Label>
                <Textarea id="resolution-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="grid gap-2">
                {actions.map((action) => {
                  const meta = ACTION_META[action]
                  const Icon = meta.icon
                  return (
                    <Button
                      key={action}
                      variant={meta.destructive ? 'destructive' : action === 'hide' ? 'default' : 'outline'}
                      disabled={busy}
                      onClick={() => (meta.destructive ? setConfirm(action) : resolve.mutate(action))}
                    >
                      {resolve.isPending && resolve.variables === action ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Icon className="size-4" aria-hidden />
                      )}
                      {t(meta.label)}
                    </Button>
                  )
                })}
              </div>
              {target.allowedActions.includes('lock') && !hasModule(actor, 'users') && (
                <p className="text-xs text-muted-foreground">{t('Khoá tài khoản cần thêm quyền Người dùng.')}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('Mọi báo cáo về nội dung này đã được xử lý.')}</p>
          )}

          {canUnhide && (
            <Button variant="outline" className="w-full" disabled={busy} onClick={() => unhide.mutate()}>
              {unhide.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              {t('Hiện lại nội dung')}
            </Button>
          )}
        </aside>
      </div>

      {/* Reports */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t('Người báo cáo ({n})', { n: reports.length })}</h3>
        <div className="relative overflow-x-auto rounded-2xl border border-foreground/15 bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-foreground/10 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('Người báo cáo')}</th>
                <th className="px-4 py-3 font-medium">{t('Lý do')}</th>
                <th className="px-4 py-3 font-medium">{t('Thời gian')}</th>
                <th className="px-4 py-3 font-medium">{t('Trạng thái')}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r._id} className="border-b border-foreground/5 align-top last:border-0">
                  <td className="px-4 py-3">
                    <PersonLine person={r.reporter} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t(REPORT_REASON_LABELS[r.reason])}</p>
                    {r.note && <p className="mt-1 max-w-72 whitespace-pre-line text-xs text-muted-foreground">{r.note}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="font-semibold">{t(REPORT_STATUS_LABELS[r.status])}</span>
                    {r.status !== 'pending' && (
                      <span className="block text-muted-foreground">
                        {t(REPORT_ACTION_LABELS[r.action])}
                        {r.resolvedBy && ` · ${r.resolvedBy.displayName}`}
                      </span>
                    )}
                    {r.resolutionNote && <span className="block text-muted-foreground">“{r.resolutionNote}”</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === 'lock' ? t('Khoá tài khoản của chủ nội dung?') : t('Gỡ nội dung này?')}
        description={
          confirm === 'lock'
            ? t('{name} sẽ không đăng nhập được nữa, buổi phát trực tiếp đang chạy sẽ kết thúc và nội dung bị báo cáo sẽ bị ẩn. Mở khoá lại ở mục Người dùng.', {
                name: target.owner ? `${target.owner.displayName} (@${target.owner.username})` : t('Chủ nội dung'),
              })
            : targetType === 'comment'
              ? t('Bình luận (và các trả lời của nó) sẽ bị xoá hẳn.')
              : t('Nội dung bị ẩn khỏi mọi người và chuyển vào mục Đã xoá gần đây của tác giả, tác giả không tự khôi phục được.')
        }
        confirmLabel={confirm ? t(ACTION_META[confirm].label) : ''}
        destructive
        pending={resolve.isPending}
        onConfirm={() => confirm && resolve.mutate(confirm)}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- pieces */

export function TypeBadge({ type }: { type: ReportTargetType }) {
  return (
    <span className="rounded-full border border-foreground/20 px-2 py-0.5 font-semibold capitalize text-foreground">
      {t(REPORT_TARGET_LABELS[type])}
    </span>
  )
}

function StateBadge({ state }: { state: ReportTargetState }) {
  if (!state.exists) {
    return <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{t('Đã bị xoá')}</span>
  }
  if (!state.hidden) return null
  const label =
    state.action === 'lock'
      ? t('Tài khoản đã khoá')
      : state.action === 'remove'
        ? t('Đã gỡ')
        : state.hiddenBy === 'system'
          ? t('Tự động ẩn tạm')
          : t('Đã ẩn')
  return <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">{label}</span>
}

export function Thumb({ snapshot, type }: { snapshot: ReportSnapshot; type: ReportTargetType }) {
  if (!snapshot.imageUrl) {
    return (
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-xs font-semibold uppercase text-muted-foreground">
        {type.slice(0, 2)}
      </span>
    )
  }
  return (
    <img
      src={snapshot.imageUrl}
      alt=""
      referrerPolicy="no-referrer"
      className={cn('size-12 shrink-0 border border-foreground/10 object-cover', type === 'user' ? 'rounded-full' : 'rounded-xl')}
    />
  )
}

export function PersonLine({ person }: { person: ReportPerson | null }) {
  if (!person) return <span className="text-xs text-muted-foreground">{t('Tài khoản đã xoá')}</span>
  return (
    <div className="flex items-center gap-2">
      <Avatar user={person} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{person.displayName}</p>
        <p className="truncate text-xs text-muted-foreground">
          @{person.username}
          {person.status === 'locked' && ` · ${t('Đã khoá')}`}
        </p>
      </div>
    </div>
  )
}
