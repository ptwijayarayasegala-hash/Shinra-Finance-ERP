import { cn } from '@/lib/utils'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { CashflowDirection } from '@/lib/types/finance'

export function CashflowDirectionBadge({ direction }: { direction: CashflowDirection }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        direction === 'in'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
      )}
    >
      {direction === 'in' ? (
        <ArrowDownLeft className="size-3" />
      ) : (
        <ArrowUpRight className="size-3" />
      )}
      {direction === 'in' ? 'Masuk' : 'Keluar'}
    </span>
  )
}
