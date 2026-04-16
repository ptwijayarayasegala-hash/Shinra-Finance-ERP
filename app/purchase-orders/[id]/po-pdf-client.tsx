'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import type { PORecord, POItemRecord } from '@/lib/types/finance'
import type { Company } from '@/lib/types'

export function POPDFButton({
  po,
  items,
  company,
}: {
  po: PORecord
  items: POItemRecord[]
  company: Company | null
}) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const { buildPOPDF } = await import('@/lib/pdf/po-pdf')
      const doc = await buildPOPDF(po, items, company)
      doc.save(`${po.po_number}.pdf`)
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
