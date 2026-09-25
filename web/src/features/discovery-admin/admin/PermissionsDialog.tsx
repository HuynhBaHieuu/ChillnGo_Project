import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ADMIN_MODULES, MODULE_LABELS } from '@/lib/roles'
import type { AdminModule } from '@/lib/roles'

/** The module checklist, used both on its own and inside the "create admin" form. */
export function PermissionChecklist({
  value,
  onChange,
  idPrefix,
}: {
  value: AdminModule[]
  onChange: (value: AdminModule[]) => void
  idPrefix: string
}) {
  const toggle = (module: AdminModule, checked: boolean) =>
    onChange(checked ? [...value, module] : value.filter((m) => m !== module))

  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium">Được phép dùng</legend>
      {ADMIN_MODULES.map((module) => (
        <label
          key={module}
          htmlFor={`${idPrefix}-${module}`}
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-foreground/10 p-3 hover:bg-muted/60"
        >
          <Checkbox
            id={`${idPrefix}-${module}`}
            checked={value.includes(module)}
            onCheckedChange={(checked) => toggle(module, checked === true)}
            className="mt-0.5"
          />
          <span className="text-sm">
            <span className="block font-semibold">{MODULE_LABELS[module].title}</span>
            <span className="block text-xs text-muted-foreground">{MODULE_LABELS[module].description}</span>
          </span>
        </label>
      ))}
      <p className="text-xs text-muted-foreground">
        Admin không bao giờ tạo được Admin khác, đổi cấu hình hệ thống hay thao tác trên Super Admin, dù được
        cấp quyền nào.
      </p>
    </fieldset>
  )
}

interface PermissionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  confirmLabel: string
  initial: AdminModule[]
  pending: boolean
  onConfirm: (permissions: AdminModule[]) => void
}

export function PermissionsDialog(props: PermissionsDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="bg-card">
        {/* Mounted only while open, so it always starts from the current permissions. */}
        {props.open && <PermissionsBody {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function PermissionsBody({ onOpenChange, title, confirmLabel, initial, pending, onConfirm }: PermissionsDialogProps) {
  const [value, setValue] = useState<AdminModule[]>(initial)

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Chọn những mục Admin này được dùng trong trang quản trị.</DialogDescription>
      </DialogHeader>
      <PermissionChecklist value={value} onChange={setValue} idPrefix="perm-dialog" />
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
          Huỷ
        </Button>
        <Button onClick={() => onConfirm(value)} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  )
}
