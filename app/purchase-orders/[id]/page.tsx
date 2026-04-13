import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext, getAllowedCompanyOptions } from '@/lib/access'
import { AppShell } from '@/components/app-shell'
import { StatusBanner } from '@/components/status-banner'
import { SubmitButton } from '@/components/submit-button'
import { POStatusBadge } from '@/components/finance/po-status-badge'
import { LineItemsEditor } from '@/components/finance/line-items-editor'
import { formatRupiah } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { updatePOMetaAction, upsertPOItemsAction, updatePOStatusAction, markPOReceivedAction } from './actions'
import { POPDFButton } from './po-pdf-client'
import type { PORecord, POItemRecord, POStatus, TaxType } from '@/lib/types/finance'
import type { Company } from '@/lib/types'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; type?: string }> }

export default async function PODetailPage({ params, searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  const sp = await searchParams

  const [poResult, itemsResult] = await Promise.all([
    supabase.schema('finance').from('purchase_orders').select('*').eq('id', id).single(),
    supabase.schema('finance').from('po_items').select('*').eq('po_id', id).order('sort_order'),
  ])

  if (poResult.error || !poResult.data) notFound()
  const po = poResult.data as PORecord
  const items = (itemsResult.data ?? []) as POItemRecord[]

  const access = await getAccessContext()
  const companies = await getAllowedCompanyOptions(access)
  const company = (companies as Company[]).find(c => c.id === po.company_id) ?? null
  const companyIds = companies.map(c => c.id)

  const [vendorsResult, productsResult] = await Promise.all([
    supabase.schema('core').from('vendors').select('id, name').in('company_id', companyIds).eq('is_active', true).order('name'),
    supabase.schema('core').from('products').select('id, name, price').eq('company_id', po.company_id).eq('is_active', true).order('name'),
  ])

  const vendors = vendorsResult.data ?? []
  const products = productsResult.data ?? []
  const isEditable = po.status === 'draft'

  return (
    <AppShell>
      <div className="space-y-6">
        <Link href="/purchase-orders" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900">
          <ArrowLeft className="size-4" />
          Kembali ke daftar PO
        </Link>

        {sp.status && (
          <StatusBanner message={decodeURIComponent(sp.status)} type={sp.type === 'error' ? 'error' : 'success'} />
        )}

        <div className="rounded-[1.6rem] border border-black/10 bg-stone-950 p-4 text-stone-50 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-stone-400 mb-1">Purchase Order</p>
              <h1 className="text-xl font-bold sm:text-2xl">{po.po_number}</h1>
              <p className="mt-1 text-sm text-stone-300">{po.vendor_name}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <POStatusBadge status={po.status as POStatus} />
              <POPDFButton po={po} items={items} company={company} />
            </div>
          </div>
        </div>

        {po.status !== 'cancelled' && po.status !== 'received' && (
          <div className="flex flex-wrap gap-2">
            {po.status === 'draft' && (
              <form action={updatePOStatusAction}>
                <input type="hidden" name="po_id" value={po.id} />
                <input type="hidden" name="status" value="sent" />
                <SubmitButton className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
                  Tandai Terkirim
                </SubmitButton>
              </form>
            )}
            {po.status === 'sent' && (
              <form action={markPOReceivedAction}>
                <input type="hidden" name="po_id" value={po.id} />
                <SubmitButton className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
                  Tandai Diterima
                </SubmitButton>
              </form>
            )}
            <form action={updatePOStatusAction}>
              <input type="hidden" name="po_id" value={po.id} />
              <input type="hidden" name="status" value="cancelled" />
              <SubmitButton className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
                Batalkan
              </SubmitButton>
            </form>
          </div>
        )}

        <div className="rounded-[1.25rem] border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-stone-900">Detail PO</h2>
          {isEditable ? (
            <form action={updatePOMetaAction} className="space-y-4">
              <input type="hidden" name="po_id" value={po.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Vendor</label>
                  <select name="vendor_id" defaultValue={po.vendor_id ?? ''} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none">
                    <option value="">— Tidak ada —</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Nama di PO *</label>
                  <input type="text" name="vendor_name" defaultValue={po.vendor_name} required className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">NPWP Vendor</label>
                  <input type="text" name="vendor_npwp" defaultValue={po.vendor_npwp ?? ''} placeholder="contoh: 1000 0000 0544 2781" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Tanggal PO</label>
                  <input type="date" name="po_date" defaultValue={po.po_date} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Estimasi Terima</label>
                  <input type="date" name="expected_date" defaultValue={po.expected_date ?? ''} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Ref. Invoice</label>
                  <input type="text" name="ref_invoice" defaultValue={po.ref_invoice ?? ''} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Alamat Vendor</label>
                <textarea name="vendor_address" rows={2} defaultValue={po.vendor_address ?? ''} placeholder="Jl. Contoh No. 1, Salatiga, Jawa Tengah" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Catatan</label>
                <textarea name="notes" rows={2} defaultValue={po.notes ?? ''} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none resize-none" />
              </div>
              <SubmitButton className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
                Simpan Perubahan
              </SubmitButton>
            </form>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-stone-400">Vendor</dt><dd className="font-medium">{po.vendor_name}</dd></div>
              {po.vendor_npwp && <div><dt className="text-xs text-stone-400">NPWP Vendor</dt><dd>{po.vendor_npwp}</dd></div>}
              <div><dt className="text-xs text-stone-400">Tanggal PO</dt><dd>{po.po_date}</dd></div>
              {po.expected_date && <div><dt className="text-xs text-stone-400">Est. Terima</dt><dd>{po.expected_date}</dd></div>}
              {po.ref_invoice && <div><dt className="text-xs text-stone-400">Ref. Invoice</dt><dd>{po.ref_invoice}</dd></div>}
              {po.vendor_address && <div className="col-span-2 sm:col-span-3"><dt className="text-xs text-stone-400">Alamat Vendor</dt><dd>{po.vendor_address}</dd></div>}
              {po.notes && <div className="col-span-2 sm:col-span-3"><dt className="text-xs text-stone-400">Catatan</dt><dd>{po.notes}</dd></div>}
            </dl>
          )}
        </div>

        <div className="rounded-[1.25rem] border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-stone-900">Item</h2>
          {isEditable ? (
            <form action={upsertPOItemsAction} className="space-y-4">
              <input type="hidden" name="po_id" value={po.id} />
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
                taxType={(po.tax_type ?? 'none') as TaxType}
              />
              <SubmitButton className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
                Simpan Item
              </SubmitButton>
            </form>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
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
                <div className="flex justify-between text-sm text-stone-600"><span>Subtotal</span><span className="tabular-nums">{formatRupiah(po.subtotal)}</span></div>
                {po.tax_type === 'ppn' && (
                  <>
                    <div className="flex justify-between text-sm text-stone-500"><span>DPP (11/12)</span><span className="tabular-nums">{formatRupiah(po.dpp)}</span></div>
                    <div className="flex justify-between text-sm text-stone-500"><span>PPN 12%</span><span className="tabular-nums">{formatRupiah(po.tax_amount)}</span></div>
                  </>
                )}
                {po.tax_type === 'pph23' && (
                  <div className="flex justify-between text-sm text-stone-500"><span>PPh 23 2%</span><span className="tabular-nums text-red-600">({formatRupiah(po.tax_amount)})</span></div>
                )}
                <div className="flex justify-between font-semibold text-stone-900 pt-1"><span>Total</span><span className="tabular-nums">{formatRupiah(po.total)}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
