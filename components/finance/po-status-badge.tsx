import { cn } from '@/lib/utils'
import { PO_STATUS_LABELS, PO_STATUS_COLORS, type POStatus } from '@/lib/types/finance'

export function POStatusBadge({ status }: { status: POStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        PO_STATUS_COLORS[status]
      )}
    >
      {PO_STATUS_LABELS[status]}
    </span>
  )
}
