import { useMutation } from '@tanstack/react-query'
import { CircleCheck, Flag, Loader2 } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { REPORT_REASONS, REPORT_REASON_LABELS, REPORT_TARGET_LABELS } from '@/features/report/labels'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { ApiError, reportService } from '@/services'
import type { ReportReason, ReportTargetType } from '@/services/types'

const MAX_NOTE = 500

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetType: ReportTargetType
  targetId: string
}

/**
 * "Báo cáo": pick a reason, optionally say more, send. Keep it mounted while
 * its parent is: the thank-you toast shows after the dialog has closed.
 */
export function ReportDialog({ open, onOpenChange, targetType, targetId }: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const noteId = useId()

  const send = useMutation({
    mutationFn: () => reportService.createReport({ targetType, targetId, reason: reason as ReportReason, note: note.trim() }),
    onSuccess: () => close(t('Cảm ơn bạn, chúng tôi sẽ xem xét.')),
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'ALREADY_REPORTED') close(t('Bạn đã báo cáo nội dung này rồi.'))
    },
  })

  function close(message?: string) {
    onOpenChange(false)
    setReason(null)
    setNote('')
    send.reset()
    if (message) setToast(message)
  }

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const needsNote = reason === 'other' && note.trim().length === 0
  const error = send.error && !(send.error instanceof ApiError && send.error.code === 'ALREADY_REPORTED') ? send.error : null

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!reason || needsNote || send.isPending) return
    send.mutate()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
        <DialogContent className="bg-card">
          <form onSubmit={submit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>{t('Báo cáo {thing}', { thing: t(REPORT_TARGET_LABELS[targetType]) })}</DialogTitle>
              <DialogDescription>
                {t('Báo cáo được gửi ẩn danh tới đội kiểm duyệt. Người bị báo cáo không biết ai đã báo cáo.')}
              </DialogDescription>
            </DialogHeader>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t('Vì sao bạn báo cáo?')}</legend>
              {REPORT_REASONS.map((value) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                    reason === value ? 'border-foreground bg-muted' : 'border-foreground/15 hover:bg-muted/60',
                  )}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="size-4 accent-current"
                  />
                  {t(REPORT_REASON_LABELS[value])}
                </label>
              ))}
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor={noteId}>
                {reason === 'other' ? t('Mô tả vấn đề (bắt buộc)') : t('Ghi chú thêm (không bắt buộc)')}
              </Label>
              <Textarea
                id={noteId}
                rows={3}
                maxLength={MAX_NOTE}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <p className="text-right text-xs text-muted-foreground">
                {note.length}/{MAX_NOTE}
              </p>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {(error as Error).message}
              </p>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => close()} disabled={send.isPending}>
                {t('Huỷ')}
              </Button>
              <Button type="submit" variant="destructive" disabled={!reason || needsNote || send.isPending}>
                {send.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Flag className="size-4" aria-hidden />}
                {t('Gửi báo cáo')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {toast &&
        createPortal(
          <div
            role="status"
            className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-foreground/15 bg-card px-5 py-3 text-sm shadow-lg"
          >
            <CircleCheck className="size-4" aria-hidden />
            {toast}
          </div>,
          document.body,
        )}
    </>
  )
}
