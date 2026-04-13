// ─── Invoice ──────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled'
export type TaxType = 'ppn' | 'pph23' | 'none'

export interface InvoiceRecord {
  id: string
  company_id: string
  invoice_number: string
  customer_id: string | null
  customer_name: string
  customer_address: string | null
  customer_npwp: string | null
  invoice_date: string
  due_date: string | null
  po_reference: string | null
  quo_reference: string | null
  spk_reference: string | null
  subtotal: number
  is_taxable: boolean
  tax_type: TaxType
  dpp: number
  tax_amount: number
  total: number
  currency: string
  status: InvoiceStatus
  paid_at: string | null
  cancelled_at: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface InvoiceItemRecord {
  id: string
  invoice_id: string
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  line_total: number
  sort_order: number
  item_type: 'main' | 'sub'
  sub_label: string | null
  created_at: string
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Terkirim',
  paid: 'Lunas',
  cancelled: 'Dibatalkan',
}

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-stone-100 text-stone-600 border-stone-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

// ─── Purchase Order ───────────────────────────────────────────────────────────

export type POStatus = 'draft' | 'sent' | 'received' | 'cancelled'

export interface PORecord {
  id: string
  company_id: string
  po_number: string
  vendor_id: string | null
  vendor_name: string
  vendor_address: string | null
  vendor_npwp: string | null
  po_date: string
  expected_date: string | null
  ref_invoice: string | null
  subtotal: number
  is_taxable: boolean
  tax_type: TaxType
  dpp: number
  tax_amount: number
  total: number
  currency: string
  status: POStatus
  received_at: string | null
  cancelled_at: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface POItemRecord {
  id: string
  po_id: string
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  line_total: number
  sort_order: number
  item_type: 'main' | 'sub'
  sub_label: string | null
  created_at: string
}

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft: 'Draft',
  sent: 'Terkirim',
  received: 'Diterima',
  cancelled: 'Dibatalkan',
}

export const PO_STATUS_COLORS: Record<POStatus, string> = {
  draft: 'bg-stone-100 text-stone-600 border-stone-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  received: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

// ─── Cashflow ─────────────────────────────────────────────────────────────────

export type CashflowDirection = 'in' | 'out'
export type CashflowCategory =
  | 'invoice'
  | 'po'
  | 'salary'
  | 'operational'
  | 'tax'
  | 'other'

export interface CashflowEntry {
  id: string
  company_id: string
  direction: CashflowDirection
  category: CashflowCategory
  amount: number
  currency: string
  entry_date: string
  description: string
  invoice_id: string | null
  po_id: string | null
  is_auto: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export const CASHFLOW_CATEGORY_LABELS: Record<CashflowCategory, string> = {
  invoice: 'Invoice',
  po: 'Purchase Order',
  salary: 'Gaji',
  operational: 'Operasional',
  tax: 'Pajak',
  other: 'Lainnya',
}

export const MANUAL_CASHFLOW_CATEGORIES: CashflowCategory[] = [
  'salary',
  'operational',
  'tax',
  'other',
]

// ─── Documents ────────────────────────────────────────────────────────────────

export type DocumentType = 'contract' | 'tax_document' | 'receipt' | 'other'

export interface DocumentRecord {
  id: string
  company_id: string
  title: string
  document_type: DocumentType
  external_url: string
  invoice_id: string | null
  po_id: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  contract: 'Kontrak',
  tax_document: 'Dokumen Pajak',
  receipt: 'Kwitansi / Nota',
  other: 'Lainnya',
}
