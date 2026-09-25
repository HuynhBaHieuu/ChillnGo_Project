import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { adminService } from '@/services'
import type { AppSettings } from '@/services/admin.service'

import type { Notice } from './shared'

const ANNOUNCEMENT_MAX = 280

/** Cấu hình hệ thống: superadmin only. Both settings take effect immediately. */
export function SettingsPanel({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const current = useQuery({ queryKey: ['admin', 'settings'], queryFn: adminService.getSettings })

  if (current.isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Đang tải cấu hình…
      </p>
    )
  }
  if (current.isError) return <p className="text-sm text-destructive">{(current.error as Error).message}</p>

  const saved = current.data.settings
  // Re-mount the form whenever the saved values change, so it starts from them.
  return <SettingsForm key={JSON.stringify(saved)} saved={saved} onNotice={onNotice} />
}

function SettingsForm({ saved, onNotice }: { saved: AppSettings; onNotice: (notice: Notice) => void }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<AppSettings>(saved)

  const save = useMutation({
    mutationFn: (settings: AppSettings) => adminService.saveSettings(settings),
    onSuccess: () => {
      onNotice({ kind: 'success', text: 'Đã lưu cấu hình hệ thống.' })
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
      void queryClient.invalidateQueries({ queryKey: ['public-settings'] })
    },
    onError: (error) => onNotice({ kind: 'error', text: (error as Error).message }),
  })

  const dirty =
    draft.registrationOpen !== saved.registrationOpen || draft.announcement.trim() !== saved.announcement

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate({ ...draft, announcement: draft.announcement.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <label
        htmlFor="setting-registration"
        className="flex cursor-pointer items-start gap-4 rounded-2xl border border-foreground/15 bg-card p-5"
      >
        <Checkbox
          id="setting-registration"
          checked={draft.registrationOpen}
          onCheckedChange={(checked) => setDraft({ ...draft, registrationOpen: checked === true })}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-semibold">Cho phép đăng ký tài khoản mới</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Khi tắt, trang đăng ký báo tạm ngừng, và đăng nhập Google lần đầu không tạo được tài khoản mới. Người
            đã có tài khoản vẫn đăng nhập bình thường.
          </span>
        </span>
      </label>

      <div className="space-y-2 rounded-2xl border border-foreground/15 bg-card p-5">
        <Label htmlFor="setting-announcement" className="text-sm font-semibold">
          Thông báo toàn trang
        </Label>
        <p className="text-sm text-muted-foreground">
          Hiện thành một dải thông báo phía trên mọi trang, ví dụ lịch bảo trì. Để trống để tắt.
        </p>
        <Textarea
          id="setting-announcement"
          value={draft.announcement}
          maxLength={ANNOUNCEMENT_MAX}
          onChange={(e) => setDraft({ ...draft, announcement: e.target.value })}
          placeholder="Ví dụ: ChillnGo bảo trì từ 22:00 đến 23:00 tối nay."
          rows={3}
        />
        <p className="text-right text-xs text-muted-foreground">
          {draft.announcement.length}/{ANNOUNCEMENT_MAX}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!dirty || save.isPending}>
          {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Lưu cấu hình
        </Button>
        {dirty && (
          <Button type="button" variant="ghost" onClick={() => setDraft(saved)} disabled={save.isPending}>
            Huỷ thay đổi
          </Button>
        )}
      </div>
    </form>
  )
}
