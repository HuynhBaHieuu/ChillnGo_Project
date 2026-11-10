import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type * as React from 'react'

import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import type { CatalogMeta } from '@/services/catalog.service'

import { ConfirmDialog } from '../shared'
import { tagLabel } from './catalogFormat'

/** Toggle chips for picking several values (tags, months). */
export function ChipPicker<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  label,
}: {
  legend: string
  options: readonly T[]
  value: T[]
  onChange: (next: T[]) => void
  label: (option: T) => string
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = value.includes(option)
          return (
            <button
              key={String(option)}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== option) : [...value, option])}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                on ? 'border-foreground bg-foreground text-background' : 'border-foreground/20 hover:bg-muted',
              )}
            >
              {label(option)}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function TagList({ tags, meta }: { tags: string[]; meta: CatalogMeta | undefined }) {
  if (tags.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
          {tagLabel(meta, tag)}
        </span>
      ))}
    </span>
  )
}

/** The edit and delete buttons at the end of a row; delete asks first. */
export function RowActions({
  name,
  onEdit,
  onDelete,
  deleting,
  deleteDescription,
}: {
  name: string
  onEdit: () => void
  onDelete: () => Promise<unknown>
  deleting: boolean
  deleteDescription: React.ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label={t('Sửa {name}', { name })}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => setConfirming(true)} aria-label={t('Xoá {name}', { name })}>
        <Trash2 className="size-4" />
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('Xoá {name}?', { name })}
        description={deleteDescription}
        confirmLabel={t('Xoá')}
        destructive
        pending={deleting}
        onConfirm={() => {
          void onDelete().finally(() => setConfirming(false))
        }}
      />
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

export function Loading({ text }: { text: string }) {
  return (
    <p className="text-sm text-muted-foreground" role="status">
      {text}
    </p>
  )
}

export function EmptyRow({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-foreground/20 px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </p>
  )
}
