import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { t } from '@/i18n'
import { catalogService } from '@/services'
import type { CatalogMeta, ChecklistInput, ChecklistItem } from '@/services/catalog.service'

import type { Notice } from '../shared'
import { tagLabel } from './catalogFormat'
import { ChipPicker, EmptyRow, FormError, Loading, RowActions, TagList } from './catalogShared'

/** Checklist chuẩn bị: what the AI may tell travellers to pack. It never adds its own. */
export function ChecklistTab({ meta, onNotice }: { meta: CatalogMeta; onNotice: (notice: Notice) => void }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<ChecklistItem | 'new' | null>(null)
  const list = useQuery({ queryKey: ['admin', 'catalog', 'checklist'], queryFn: catalogService.listChecklist })

  const remove = useMutation({
    mutationFn: (item: ChecklistItem) => catalogService.deleteChecklistItem(item._id),
    onSuccess: () => {
      onNotice({ kind: 'success', text: t('Đã xoá mục chuẩn bị.') })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] })
    },
    onError: (error) => onNotice({ kind: 'error', text: (error as Error).message }),
  })

  const items = list.data?.items ?? []
  const groups = [...new Set(items.map((i) => i.group))]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t('Một mục hiện ra khi chuyến đi có ít nhất một tag của nó. AI chỉ sắp xếp và nhóm các mục này, không tự thêm mục mới.')}
        </p>
        <Button onClick={() => setEditing('new')} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          {t('Thêm mục')}
        </Button>
      </div>

      {list.isPending ? (
        <Loading text={t('Đang tải danh sách…')} />
      ) : list.isError ? (
        <p className="text-sm text-destructive">{(list.error as Error).message}</p>
      ) : items.length === 0 ? (
        <EmptyRow text={t('Chưa có mục chuẩn bị nào.')} />
      ) : (
        groups.map((group) => (
          <section key={group} className="space-y-2">
            <h3 className="text-sm font-semibold">{group}</h3>
            <ul className="divide-y divide-foreground/5 rounded-2xl border border-foreground/15 bg-card">
              {items
                .filter((i) => i.group === group)
                .map((item) => (
                  <li key={item._id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm">{item.text}</p>
                      <TagList tags={item.tags} meta={meta} />
                    </div>
                    <RowActions
                      name={item.text}
                      onEdit={() => setEditing(item)}
                      onDelete={() => remove.mutateAsync(item).catch(() => undefined)}
                      deleting={remove.isPending}
                      deleteDescription={t('Mục này sẽ không còn xuất hiện trong checklist của các bản nháp mới.')}
                    />
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}

      {editing && (
        <ChecklistDialog
          item={editing === 'new' ? null : editing}
          groups={groups}
          meta={meta}
          onClose={() => setEditing(null)}
          onNotice={onNotice}
        />
      )}
    </div>
  )
}

function ChecklistDialog({
  item,
  groups,
  meta,
  onClose,
  onNotice,
}: {
  item: ChecklistItem | null
  groups: string[]
  meta: CatalogMeta
  onClose: () => void
  onNotice: (notice: Notice) => void
}) {
  const queryClient = useQueryClient()
  const [text, setText] = useState(item?.text ?? '')
  const [group, setGroup] = useState(item?.group ?? groups[0] ?? '')
  const [order, setOrder] = useState(String(item?.order ?? 0))
  const [tags, setTags] = useState<string[]>(item?.tags ?? ['all'])
  const [formError, setFormError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (input: ChecklistInput) => catalogService.saveChecklistItem(item?._id ?? null, input),
    onSuccess: () => {
      onNotice({ kind: 'success', text: t('Đã lưu mục chuẩn bị.') })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] })
      onClose()
    },
    onError: (error) => setFormError((error as Error).message),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (tags.length === 0) {
      setFormError(t('Chọn ít nhất một tag. Chọn “Mọi chuyến đi” nếu mục này luôn cần.'))
      return
    }
    setFormError(null)
    save.mutate({ text, group, tags, order: Math.max(0, Math.round(Number(order) || 0)) })
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle>{item ? t('Sửa mục chuẩn bị') : t('Thêm mục chuẩn bị')}</DialogTitle>
          <DialogDescription>{t('Ví dụ: “Áo mưa mỏng” trong nhóm Quần áo, tag Mùa mưa.')}</DialogDescription>
        </DialogHeader>

        <form id="checklist-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cl-text">{t('Nội dung')}</Label>
            <Input id="cl-text" required maxLength={200} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <div className="space-y-2">
              <Label htmlFor="cl-group">{t('Nhóm')}</Label>
              <Input id="cl-group" required maxLength={40} list="cl-groups" value={group} onChange={(e) => setGroup(e.target.value)} />
              <datalist id="cl-groups">
                {groups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-order">{t('Thứ tự')}</Label>
              <Input id="cl-order" type="number" min={0} max={10000} value={order} onChange={(e) => setOrder(e.target.value)} />
            </div>
          </div>
          <ChipPicker
            legend={t('Hiện khi chuyến đi có')}
            options={meta.checklistTags}
            value={tags}
            onChange={setTags}
            label={(tag) => tagLabel(meta, tag)}
          />
          <FormError message={formError} />
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            {t('Huỷ')}
          </Button>
          <Button type="submit" form="checklist-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t('Lưu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
