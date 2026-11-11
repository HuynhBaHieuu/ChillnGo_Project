import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { GlassButton } from '@/components/Button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { t } from '@/i18n'
import type { BusinessAd, BusinessAdInput } from '@/services/types'

import { PhotoPicker } from './PhotoPicker'

const MAX_AD_PHOTOS = 6

/** Write or edit one ad: title, text, photos and an optional offer line. */
export function AdForm({
  ad,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  ad: BusinessAd | null
  pending: boolean
  error: string | null
  onSubmit: (input: BusinessAdInput) => void
  onCancel: () => void
}) {
  const [input, setInput] = useState<BusinessAdInput>({
    title: ad?.title ?? '',
    content: ad?.content ?? '',
    photos: ad?.photos ?? [],
    offer: ad?.offer ?? '',
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit(input)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ad-title">{t('Tiêu đề')}</Label>
        <Input
          id="ad-title"
          required
          minLength={3}
          maxLength={120}
          value={input.title}
          onChange={(e) => setInput({ ...input, title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ad-offer">{t('Ưu đãi (không bắt buộc)')}</Label>
        <Input
          id="ad-offer"
          maxLength={80}
          value={input.offer}
          onChange={(e) => setInput({ ...input, offer: e.target.value })}
          placeholder={t('Ví dụ: Giảm 20% cho khách đặt trước 7 ngày')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ad-content">{t('Nội dung')}</Label>
        <Textarea
          id="ad-content"
          required
          minLength={10}
          maxLength={3000}
          rows={6}
          value={input.content}
          onChange={(e) => setInput({ ...input, content: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('Ảnh')}</Label>
        <PhotoPicker value={input.photos} onChange={(photos) => setInput({ ...input, photos })} max={MAX_AD_PHOTOS} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        <GlassButton type="submit" tone="sunset" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {ad ? t('Lưu thay đổi') : t('Đăng bài quảng cáo')}
        </GlassButton>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('Huỷ')}
        </Button>
      </div>
    </form>
  )
}
