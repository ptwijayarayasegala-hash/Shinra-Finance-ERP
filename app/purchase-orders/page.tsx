import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext, getAllowedCompanyOptions } from '@/lib/access'
import { AppShell } from '@/components/app-shell'
import { StatusBanner } from '@/components/status-banner'
import { SubmitButton } from '@/components/submit-button'
import { POStatusBadge } from '@/components/finance/po-status-badge'
import { createPOAction } from './actions'
import { formatRupiah } from '@/lib/utils'
import Link from 'next/link'
import { Plus, ShoppingCart } from 'lucide-react'
import type { POStatus } from '@/lib/types/finance'

type SearchParams = Promise<{ status?: string; type?: string; filter?: string }>

const STATUS_FILTERS = [
  { value: 'all', label: 'Semua' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Terkirim' },
  { value: 'received', label: 'Diterima' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getAccessContext()
  const companies = await getAllowedCompanyOptions(access)
  const params = await searchParams
  const filterStatus = params.filter ?? 'all'

  let query = supabase
    .schema('finance')
    .from('purchase_orders')
    .select('id, company_id, po_number, vendor_name, po_date, expected_date, total, status, created_at')
    .order('created_at', { ascending: false })

  if (!access.isSuperAdmin) query = query.in('company_id', access.membershipCompanyIds)
  if (filterStatus !== 'all') query = query.eq('status', filterStatus as POStatus)

  const { data: pos } = await query

  const companyIds = companies.map(c => c.id)
  const { data: vendors } = await supabase
    .schema('core')
    .from('vendors')
    .select('id, name, company_id')
    .in('company_id', companyIds)
    .eq('is_active', true)
    .order('name')

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-[1.6rem] border border-black/10 bg-stone-950 p-4 text-stone-50 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">Purchase Order</h1>
              <p className="mt-1 text-sm text-stone-400">{pos?.length ?? 0} PO ditemukan</p>
            </div>
            <ShoppingCart className="size-8 text-stone-600 shrink-0" />
          </div>
        </section>

        {params.status && (
          <StatusBanner
            message={decodeURIComponent(params.status)}
            type={params.type === 'error' ? 'error' : 'success'}
          />
        )}

        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {STATUS_FILTERS.map(f => (
            <Link key={f.value} href={`/purchase-orders?filter=${f.value}`}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${filterStatus === f.value ? 'border-stone-950 bg-stone-950 text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'}`}>
              {f.label}
            </Link>
          ))}
        </div>

        <details className="group rounded-[1.25rem] border border-stone-200 bg-white">
          <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 text-sm font-semibold text-stone-700 select-none">
            <Plus className="size-4" />
            Buat Purchase Order Baru
          </summary>
          <form action={createPOAction} className="border-t border-stone-100 px-5 pb-5 pt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Company *</label>
                <select name="company_id" required className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none">
                  <option value="">— Pilih company —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Vendor</label>
                <select name="vendor_id" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none">
                  <option value="">— Pilih dari daftar (opsional) —</option>
                  {vendors?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Nama Vendor *</label>
                <input type="text" name="vendor_name" required placeholder="Nama vendor di PO" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Tanggal PO</label>
                <input type="date" name="po_date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Estimasi Terima</label>
                <input type="date" name="expected_date" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600">Catatan</label>
              <textarea name="notes" rows={2} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none resize-none" />
            </div>
            <SubmitButton className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
              Buat PO
            </SubmitButton>
          </form>
        </details>

        <div className="space-y-2">
          {(pos ?? []).length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">Belum ada PO.</div>
          ) : (
            (pos ?? []).map(po => (
              <Link key={po.id} href={`/purchase-orders/${po.id}`}
                className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-stone-200 bg-white p-4 transition hover:border-stone-300 hover:shadow-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-stone-900">{po.po_number}</span>
                    <POStatusBadge status={po.status as POStatus} />
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500 truncate">{po.vendor_name}</p>
                  <p className="text-xs text-stone-400">{po.po_date}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-stone-900">{formatRupiah(po.total)}</p>
                  {po.expected_date && <p className="text-xs text-stone-400">Est: {po.expected_date}</p>}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppShell>
  )
}
