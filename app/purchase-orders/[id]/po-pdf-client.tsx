'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import type { PORecord, POItemRecord } from '@/lib/types/finance'

export function POPDFButton({ po, items }: { po: PORecord; items: POItemRecord[] }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const { buildPOPDF } = await import('@/lib/pdf/po-pdf')
      const doc = buildPOPDF(po, items)
      doc.save(`${po.po_number}.pdf`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-300 hover:text-stone-900 transition disabled:opacity-50"
    >
      <Download className="size-3.5" />
      {loading ? 'Memuat...' : 'Export PDF'}
    </button>
  )
}
