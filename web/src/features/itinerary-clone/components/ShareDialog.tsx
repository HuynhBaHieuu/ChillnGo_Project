import { Check, Copy, ExternalLink, Link2, Link2Off, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { GlassButton } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useShareItinerary } from '@/features/itinerary-clone/hooks'
import { t } from '@/i18n'
import { translateServerMessage } from '@/i18n/server'
import { shareUrlOf } from '@/services/itinerary.service'
import type { ClonedItinerary } from '@/services/types'

/**
 * Sharing an itinerary with friends: a read-only link anyone can open without
 * an account. Turning it off makes the old link stop working.
 */
export function ShareDialog({
  itinerary,
  open,
  onOpenChange,
}: {
  itinerary: ClonedItinerary
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const share = useShareItinerary(itinerary._id)
  const [copied, setCopied] = useState(false)
  const url = itinerary.shareToken ? shareUrlOf(itinerary.shareToken) : null

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Older browsers or no permission: select the text so Ctrl/Cmd+C works.
      document.querySelector<HTMLInputElement>('#share-url')?.select()
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('Chia sẻ lịch trình')}
      description={t('Ai có link đều xem được lịch trình và bản đồ, không cần tài khoản. Chỉ bạn sửa được.')}
    >
      <div className="space-y-4">
        {url ? (
          <>
            <div className="flex gap-2">
              <Input id="share-url" readOnly value={url} onFocus={(e) => e.target.select()} aria-label={t('Link chia sẻ')} />
              <GlassButton type="button" onClick={() => void copy()} className="shrink-0">
                {copied ? <Check /> : <Copy />}
                {copied ? t('Đã sao chép link') : t('Sao chép link')}
              </GlassButton>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button asChild variant="ghost" size="sm">
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  {t('Mở thử link')}
                </a>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={share.isPending}
                onClick={() => share.mutate(false)}
                className="text-muted-foreground hover:text-destructive"
              >
                {share.isPending ? <Loader2 className="animate-spin" /> : <Link2Off />}
                {t('Ngừng chia sẻ')}
              </Button>
            </div>
          </>
        ) : (
          <GlassButton type="button" size="lg" className="w-full" disabled={share.isPending} onClick={() => share.mutate(true)}>
            {share.isPending ? <Loader2 className="animate-spin" /> : <Link2 />}
            {t('Tạo link chia sẻ')}
          </GlassButton>
        )}

        {share.isError && (
          <p role="alert" className="text-sm text-destructive">
            {translateServerMessage((share.error as Error).message)}
          </p>
        )}
      </div>
    </Modal>
  )
}
