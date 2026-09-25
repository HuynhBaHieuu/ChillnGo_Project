import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { ROLE_LABELS } from '@/lib/roles'
import { adminService } from '@/services'
import type { AdminStats } from '@/services/admin.service'

/** Tổng quan: account statistics. Admins see regular users only. */
export function StatsPanel() {
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminService.getStats })

  if (stats.isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Đang tải thống kê…
      </p>
    )
  }
  if (stats.isError) {
    return <p className="text-sm text-destructive">{(stats.error as Error).message}</p>
  }

  const { users, signupsByDay, scope, byRole, adminActions7 } = stats.data

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Tile label="Tổng tài khoản" value={users.total} />
        <Tile label="Đăng ký mới 7 ngày" value={users.new7} />
        <Tile label="Đăng ký mới 30 ngày" value={users.new30} />
        <Tile label="Đã xác nhận email" value={users.verified} of={users.total} />
        <Tile label="Liên kết Google" value={users.googleLinked} of={users.total} />
        <Tile label="Đang bị khoá" value={users.locked} of={users.total} />
      </dl>

      <SignupChart data={signupsByDay} />

      {scope === 'full' && byRole && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Chỉ dành cho Super Admin</h3>
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile label={ROLE_LABELS.user} value={byRole.user ?? 0} />
            <Tile label={ROLE_LABELS.admin} value={byRole.admin ?? 0} />
            <Tile label={ROLE_LABELS.superadmin} value={byRole.superadmin ?? 0} />
            <Tile label="Thao tác quản trị 7 ngày" value={adminActions7 ?? 0} />
          </dl>
        </section>
      )}
    </div>
  )
}

function Tile({ label, value, of }: { label: string; value: number; of?: number }) {
  const share = of ? Math.round((value / of) * 100) : null
  return (
    <div className="rounded-2xl border border-foreground/15 bg-card p-5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-3xl tabular-nums">{value.toLocaleString('vi-VN')}</span>
        {share !== null && <span className="text-xs text-muted-foreground">{share}%</span>}
      </dd>
    </div>
  )
}

const dayLabel = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/**
 * Daily sign-ups, last 30 days. One series, so no legend: the heading names
 * it. Bars carry a hover/focus tooltip; the same numbers are in a table below.
 */
function SignupChart({ data }: { data: AdminStats['signupsByDay'] }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.count))
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const shown = active === null ? null : data[active]

  return (
    <section className="rounded-2xl border border-foreground/15 bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Đăng ký mới mỗi ngày, 30 ngày qua</h3>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {shown
            ? `${dayLabel(shown.date)}: ${shown.count} tài khoản`
            : `Tổng ${total} tài khoản · cao nhất ${max === 1 && total === 0 ? 0 : max}/ngày`}
        </p>
      </div>

      <div className="mt-5 flex gap-3">
        {/* y-axis: just the top and zero. */}
        <div className="flex h-40 flex-col justify-between text-right text-[11px] tabular-nums text-muted-foreground">
          <span>{max}</span>
          <span>0</span>
        </div>

        <div className="relative flex-1">
          <div aria-hidden className="absolute inset-x-0 top-0 border-t border-dashed border-foreground/10" />
          <div
            className="flex h-40 items-end gap-[2px] border-b border-foreground/30"
            onMouseLeave={() => setActive(null)}
          >
            {data.map((d, i) => (
              <button
                key={d.date}
                type="button"
                aria-label={`${dayLabel(d.date)}: ${d.count} tài khoản`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group flex h-full flex-1 items-end focus-visible:outline-none"
              >
                <span
                  className="w-full rounded-t-[4px] bg-[hsl(var(--tertiary-ink))] transition-opacity group-hover:opacity-80 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-foreground"
                  style={{ height: d.count === 0 ? 0 : `${Math.max(3, (d.count / max) * 100)}%` }}
                />
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{dayLabel(data[0].date)}</span>
            <span>{dayLabel(data[Math.floor(data.length / 2)].date)}</span>
            <span>{dayLabel(data[data.length - 1].date)}</span>
          </div>
        </div>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Xem dạng bảng</summary>
        <table className="mt-3 w-full max-w-xs text-left text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 font-medium">Ngày</th>
              <th className="py-1 text-right font-medium">Đăng ký</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t border-foreground/10">
                <td className="py-1">{dayLabel(d.date)}</td>
                <td className="py-1 text-right tabular-nums">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
