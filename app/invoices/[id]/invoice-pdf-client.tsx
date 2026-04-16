'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import type { InvoiceRecord, InvoiceItemRecord } from '@/lib/types/finance'
import type { Company } from '@/lib/types'

export function InvoicePDFButton({
  invoice,
  items,
  company,
}: {
  invoice: InvoiceRecord
  items: InvoiceItemRecord[]
  company: Company | null
}) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const { buildInvoicePDF } = await import('@/lib/pdf/invoice-pdf')
      const doc = await buildInvoicePDF(invoice, items, company)
      doc.save(`${invoice.invoice_number}.pdf`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-border/80 hover:text-foreground transition disabled:opacity-50"
    >
      <Download className="size-3.5" />
      {loading ? 'Memuat...' : 'Export PDF'}
    </button>
  )
}
