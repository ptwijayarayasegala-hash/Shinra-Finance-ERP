import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext, getAllowedCompanyOptions } from '@/lib/access'
import { AppShell } from '@/components/app-shell'
import { StatusBanner } from '@/components/status-banner'
import { SubmitButton } from '@/components/submit-button'
import { InvoiceStatusBadge } from '@/components/finance/invoice-status-badge'
import { LineItemsEditor } from '@/components/finance/line-items-editor'
import { formatRupiah } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  updateInvoiceMetaAction,
  upsertInvoiceItemsAction,
  updateInvoiceStatusAction,
  markInvoicePaidAction,
} from './actions'
import { InvoicePDFButton } from './invoice-pdf-client'
import type { InvoiceRecord, InvoiceItemRecord, InvoiceStatus, TaxType } from '@/lib/types/finance'
import type { Company } from '@/lib/types'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; type?: string }> }

export default async function InvoiceDetailPage({ params, searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  const sp = await searchParams

  const [invoiceResult, itemsResult] = await Promise.all([
    supabase.schema('finance').from('invoices').select('*').eq('id', id).single(),
    supabase.schema('finance').from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
  ])

  if (invoiceResult.error || !invoiceResult.data) notFound()
  const invoice = invoiceResult.data as InvoiceRecord
  const items = (itemsResult.data ?? []) as InvoiceItemRecord[]

  const access = await getAccessContext()
  const companies = await getAllowedCompanyOptions(access)
  const company = (companies as Company[]).find(c => c.id === invoice.company_id) ?? null
  const companyIds = companies.map(c => c.id)

  const [customersResult, productsResult] = await Promise.all([
    supabase.schema('core').from('customers').select('id, name').in('company_id', companyIds).eq('is_active', true).order('name'),
    supabase.schema('core').from('products').select('id, name, price').eq('company_id', invoice.company_id).eq('is_active', true).order('name'),
  ])

  const customers = customersResult.data ?? []
  const products = productsResult.data ?? []

  const isEditable = invoice.status === 'draft'

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Back */}
        <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900">
          <ArrowLeft className="size-4" />
          Kembali ke daftar invoice
        </Link>

        {sp.status && (
          <StatusBanner
            message={decodeURIComponent(sp.status)}
            type={sp.type === 'error' ? 'error' : 'success'}
          />
        )}

        {/* Header */}
        <div className="rounded-[1.6rem] border border-black/10 bg-stone-950 p-4 text-stone-50 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-stone-400 mb-1">Invoice</p>
              <h1 className="text-xl font-bold sm:text-2xl">{invoice.invoice_number}</h1>
              <p className="mt-1 text-sm text-stone-300">{invoice.customer_name}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <InvoiceStatusBadge status={invoice.status as InvoiceStatus} />
              <InvoicePDFButton invoice={invoice} items={items} company={company} />
            </div>
          </div>
        </div>

        {/* Actions */}
        {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
          <div className="flex flex-wrap gap-2">
            {invoice.status === 'draft' && (
              <form action={updateInvoiceStatusAction}>
                <input type="hidden" name="invoice_id" value={invoice.id} />
                <input type="hidden" name="status" value="sent" />
                <SubmitButton className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
                  Tandai Terkirim
                </SubmitButton>
              </form>
            )}
            {invoice.status === 'sent' && (
              <form action={markInvoicePaidAction}>
                <input type="hidden" name="invoice_id" value={invoice.id} />
                <SubmitButton className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
                  Tandai Lunas
                </SubmitButton>
              </form>
            )}
            <form action={updateInvoiceStatusAction}>
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <input type="hidden" name="status" value="cancelled" />
              <SubmitButton className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
                Batalkan
              </SubmitButton>
            </form>
          </div>
        )}

        {/* Info Invoice */}
        <div className="rounded-[1.25rem] border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-stone-900">Detail Invoice</h2>
          {isEditable ? (
            <form action={updateInvoiceMetaAction} className="space-y-4">
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Customer</label>
                  <select name="customer_id" defaultValue={invoice.customer_id ?? ''} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none">
                    <option value="">— Tidak ada —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Nama di Invoice *</label>
                  <input type="text" name="customer_name" defaultValue={invoice.customer_name} required className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">NPWP Customer</label>
                  <input type="text" name="customer_npwp" defaultValue={invoice.customer_npwp ?? ''} placeholder="contoh: 0139 0653 6106 8000" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Tanggal Invoice</label>
                  <input type="date" name="invoice_date" defaultValue={invoice.invoice_date} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Jatuh Tempo</label>
                  <input type="date" name="due_date" defaultValue={invoice.due_date ?? ''} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">No. PO Referensi</label>
                  <input type="text" name="po_reference" defaultValue={invoice.po_reference ?? ''} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">No. Quo Referensi</label>
                  <input type="text" name="quo_reference" defaultValue={invoice.quo_reference ?? ''} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">No. SPK Referensi</label>
                  <input type="text" name="spk_reference" defaultValue={invoice.spk_reference ?? ''} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Alamat Customer</label>
                <textarea name="customer_address" rows={2} defaultValue={invoice.customer_address ?? ''} placeholder="Jl. Contoh No. 1, Jakarta Selatan" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Catatan</label>
                <textarea name="notes" rows={2} defaultValue={invoice.notes ?? ''} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none resize-none" />
              </div>
              <SubmitButton className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
                Simpan Perubahan
              </SubmitButton>
            </form>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-stone-400">Customer</dt><dd className="font-medium">{invoice.customer_name}</dd></div>
              {invoice.customer_npwp && <div><dt className="text-xs text-stone-400">NPWP Customer</dt><dd>{invoice.customer_npwp}</dd></div>}
              <div><dt className="text-xs text-stone-400">Tanggal</dt><dd>{invoice.invoice_date}</dd></div>
              {invoice.due_date && <div><dt className="text-xs text-stone-400">Jatuh Tempo</dt><dd>{invoice.due_date}</dd></div>}
              {invoice.po_reference && <div><dt className="text-xs text-stone-400">No. PO</dt><dd>{invoice.po_reference}</dd></div>}
              {invoice.quo_reference && <div><dt className="text-xs text-stone-400">No. Quo</dt><dd>{invoice.quo_reference}</dd></div>}
              {invoice.spk_reference && <div><dt className="text-xs text-stone-400">No. SPK</dt><dd>{invoice.spk_reference}</dd></div>}
              {invoice.customer_address && <div className="col-span-2 sm:col-span-3"><dt className="text-xs text-stone-400">Alamat Customer</dt><dd>{invoice.customer_address}</dd></div>}
              {invoice.notes && <div className="col-span-2 sm:col-span-3"><dt className="text-xs text-stone-400">Catatan</dt><dd>{invoice.notes}</dd></div>}
            </dl>
          )}
        </div>

        {/* Line Items */}
        <div className="rounded-[1.25rem] border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-stone-900">Item</h2>
          {isEditable ? (
            <form action={upsertInvoiceItemsAction} className="space-y-4">
              <input type="hidden" name="invoice_id" value={invoice.id} />

              <LineItemsEditor
                initialItems={items.map(item => ({
                  id: item.id,
                  product_id: item.product_id ?? '',
                  description: item.description,
                  quantity: String(item.quantity),
                  unit_price: String(item.unit_price),
                  item_type: item.item_type ?? 'main',
                  sub_label: item.sub_label ?? '',
                }))}
                products={products.map(p => ({ id: p.id, name: p.name, price: p.price }))}
                taxType={(invoice.tax_type ?? 'none') as TaxType}
              />

              <SubmitButton className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
                Simpan Item
              </SubmitButton>
            </form>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className={`flex justify-between gap-4 text-sm ${item.item_type === 'sub' ? 'pl-5 text-stone-500' : ''}`}>
                  <div>
                    <p className={item.item_type === 'sub' ? 'text-stone-500' : 'font-medium'}>
                      {item.item_type === 'sub' && <span className="mr-1 text-xs text-stone-400">{item.sub_label}.</span>}
                      {item.description}
                    </p>
                    {item.item_type === 'main' && (
                      <p className="text-xs text-stone-400">{item.quantity} × {formatRupiah(item.unit_price)}</p>
                    )}
                  </div>
                  <p className="font-medium tabular-nums shrink-0">{item.item_type === 'sub' ? '-' : formatRupiah(item.line_total)}</p>
                </div>
              ))}
              <div className="border-t border-stone-100 pt-3 space-y-1">
                <div className="flex justify-between text-sm text-stone-600">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatRupiah(invoice.subtotal)}</span>
                </div>
                {invoice.tax_type === 'ppn' && (
                  <>
                    <div className="flex justify-between text-sm text-stone-500">
                      <span>DPP (11/12)</span>
                      <span className="tabular-nums">{formatRupiah(invoice.dpp)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-stone-500">
                      <span>PPN 12%</span>
                      <span className="tabular-nums">{formatRupiah(invoice.tax_amount)}</span>
                    </div>
                  </>
                )}
                {invoice.tax_type === 'pph23' && (
                  <div className="flex justify-between text-sm text-stone-500">
                    <span>PPh 23 2%</span>
                    <span className="tabular-nums text-red-600">({formatRupiah(invoice.tax_amount)})</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-stone-900 pt-1">
                  <span>Total</span>
                  <span className="tabular-nums">{formatRupiah(invoice.total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
