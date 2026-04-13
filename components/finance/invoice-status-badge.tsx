import { cn } from '@/lib/utils'
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, type InvoiceStatus } from '@/lib/types/finance'

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        INVOICE_STATUS_COLORS[status]
      )}
    >
      {INVOICE_STATUS_LABELS[status]}
    </span>
  )
}
