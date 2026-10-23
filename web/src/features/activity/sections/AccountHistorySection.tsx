import { AtSign, BadgeCheck, FileText, History, Image, ImageOff, MapPin, Sparkles, UserPen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Empty, ErrorPanel, ListSkeleton, SectionHeader } from '@/features/activity/components'
import { dateTime, timeAgo } from '@/features/activity/format'
import { useAccountHistory } from '@/features/activity/hooks'
import { t } from '@/i18n'
import type { MessageKey } from '@/i18n'
import type { AccountEvent, AccountEventType } from '@/services/activity.service'

const EVENTS: Record<AccountEventType, { label: MessageKey; icon: LucideIcon }> = {
  account_created: { label: 'Tạo tài khoản#event', icon: Sparkles },
  email_verified: { label: 'Xác minh địa chỉ email#event', icon: BadgeCheck },
  avatar_changed: { label: 'Đổi ảnh đại diện#event', icon: Image },
  avatar_removed: { label: 'Gỡ ảnh đại diện#event', icon: ImageOff },
  cover_changed: { label: 'Đổi ảnh bìa#event', icon: Image },
  cover_removed: { label: 'Gỡ ảnh bìa#event', icon: ImageOff },
  username_changed: { label: 'Đổi tên người dùng#event', icon: AtSign },
  display_name_changed: { label: 'Đổi tên hiển thị#event', icon: UserPen },
  bio_changed: { label: 'Đổi phần giới thiệu#event', icon: FileText },
  location_changed: { label: 'Đổi nơi sống#event', icon: MapPin },
}

/** A line of detail under the event, where one was recorded. */
function detail(event: AccountEvent): string | null {
  const { from, to, via } = event.details
  if (event.type === 'username_changed' && from && to) return `@${from} → @${to}`
  if ((event.type === 'display_name_changed' || event.type === 'location_changed') && to) {
    return from ? `${from} → ${to}` : to
  }
  if (via === 'google') return event.type === 'account_created' ? t('Đăng ký bằng Google') : t('Xác nhận qua Google')
  if (via === 'email' && event.type === 'account_created') return t('Đăng ký bằng email')
  return null
}

export function AccountHistorySection() {
  const history = useAccountHistory()

  return (
    <>
      <SectionHeader
        title={t('Lịch sử tài khoản')}
        description={t('Những thay đổi bạn đã thực hiện trên tài khoản. Chỉ hiện các sự kiện đã được ghi lại.')}
      />

      {history.isPending ? (
        <ListSkeleton rows={4} />
      ) : history.isError ? (
        <ErrorPanel error={history.error} onRetry={() => void history.refetch()} />
      ) : history.data.length === 0 ? (
        <Empty icon={History} title={t('Chưa có lịch sử tài khoản')} description={t('Các thay đổi trên hồ sơ của bạn sẽ được ghi lại ở đây.')} />
      ) : (
        <ol className="relative space-y-1 before:absolute before:bottom-6 before:left-[34px] before:top-6 before:w-px before:bg-np-beige/10">
          {history.data.map((event) => {
            const kind = EVENTS[event.type]
            const extra = detail(event)
            return (
              <li key={event._id} className="relative flex items-start gap-4 rounded-[14px] p-3 transition-colors hover:bg-np-card/70">
                <span className="relative z-[1] grid size-11 shrink-0 place-items-center rounded-full border border-np-beige/10 bg-np-surface text-np-sage">
                  <kind.icon className="size-[18px]" aria-hidden />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[15px] font-semibold text-np-cream">{t(kind.label)}</p>
                  {extra && <p className="mt-0.5 truncate text-[13px] text-np-body">{extra}</p>}
                  <p className="mt-1 text-xs text-np-meta">
                    <time dateTime={event.createdAt}>{dateTime(event.createdAt)}</time> · {timeAgo(event.createdAt)}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
