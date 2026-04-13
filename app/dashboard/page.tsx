import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext } from '@/lib/access'
import { AppShell } from '@/components/app-shell'
import { CashflowDirectionBadge } from '@/components/finance/cashflow-direction-badge'
import { InvoiceStatusBadge } from '@/components/finance/invoice-status-badge'
import { formatRupiah } from '@/lib/utils'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import type { CashflowEntry, CashflowDirection, CashflowCategory, InvoiceStatus } from '@/lib/types/finance'
import { CASHFLOW_CATEGORY_LABELS } from '@/lib/types/finance'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getAccessContext()
  const companyFilter = access.isSuperAdmin ? undefined : access.membershipCompanyIds

  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  // ── Fetch semua data paralel ──────────────────────────────────────────────
  const [
    invoicesOutstandingResult,
    invoicesPiutangResult,
    posOutstandingResult,
    cashflowInResult,
    cashflowOutResult,
    recentEntriesResult,
    recentInvoicesResult,
  ] = await Promise.all([
    // Invoice outstanding (draft + sent)
    (() => {
      let q = supabase.schema('finance').from('invoices').select('id', { count: 'exact', head: true }).in('status', ['draft', 'sent'])
      if (companyFilter) q = q.in('company_id', companyFilter)
      return q
    })(),
    // Total piutang (status = sent)
    (() => {
      let q = supabase.schema('finance').from('invoices').select('total').eq('status', 'sent')
      if (companyFilter) q = q.in('company_id', companyFilter)
      return q
    })(),
    // PO outstanding (draft + sent)
    (() => {
      let q = supabase.schema('finance').from('purchase_orders').select('id', { count: 'exact', head: true }).in('status', ['draft', 'sent'])
      if (companyFilter) q = q.in('company_id', companyFilter)
      return q
    })(),
    // Cashflow masuk bulan ini
    (() => {
      let q = supabase.schema('finance').from('cashflow_entries').select('amount').eq('direction', 'in').gte('entry_date', monthStart).lte('entry_date', monthEnd)
      if (companyFilter) q = q.in('company_id', companyFilter)
      return q
    })(),
    // Cashflow keluar bulan ini
    (() => {
      let q = supabase.schema('finance').from('cashflow_entries').select('amount').eq('direction', 'out').gte('entry_date', monthStart).lte('entry_date', monthEnd)
      if (companyFilter) q = q.in('company_id', companyFilter)
      return q
    })(),
    // 5 transaksi cashflow terbaru
    (() => {
      let q = supabase.schema('finance').from('cashflow_entries').select('id, direction, category, amount, description, entry_date, is_auto').order('created_at', { ascending: false }).limit(5)
      if (companyFilter) q = q.in('company_id', companyFilter)
      return q
    })(),
    // 5 invoice terbaru
    (() => {
      let q = supabase.schema('finance').from('invoices').select('id, invoice_number, customer_name, total, status, invoice_date').order('created_at', { ascending: false }).limit(5)
      if (companyFilter) q = q.in('company_id', companyFilter)
      return q
    })(),
  ])

  const totalPiutang = (invoicesPiutangResult.data ?? []).reduce((sum, inv) => sum + inv.total, 0)
  const kasmasuk = (cashflowInResult.data ?? []).reduce((sum, e) => sum + e.amount, 0)
  const kasKeluar = (cashflowOutResult.data ?? []).reduce((sum, e) => sum + e.amount, 0)
  const recentEntries = (recentEntriesResult.data ?? []) as CashflowEntry[]
  const recentInvoices = recentInvoicesResult.data ?? []

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <section className="rounded-[1.6rem] border border-black/10 bg-stone-950 p-4 text-stone-50 sm:p-6">
          <h1 className="text-2xl font-semibold sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-stone-400">{format(now, 'MMMM yyyy')}</p>
        </section>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link href="/invoices?filter=sent" className="rounded-[1.25rem] border border-stone-200 bg-white p-4 hover:border-stone-300 transition">
            <p className="text-xs text-stone-400 mb-1">Invoice Outstanding</p>
            <p className="text-2xl font-bold text-stone-900">{invoicesOutstandingResult.count ?? 0}</p>
            <p className="text-xs text-stone-400 mt-1">draft + terkirim</p>
          </Link>

          <Link href="/invoices?filter=sent" className="rounded-[1.25rem] border border-stone-200 bg-white p-4 hover:border-stone-300 transition">
            <p className="text-xs text-stone-400 mb-1">Total Piutang</p>
            <p className="text-lg font-bold text-stone-900 tabular-nums">{formatRupiah(totalPiutang)}</p>
            <p className="text-xs text-stone-400 mt-1">belum lunas</p>
          </Link>

          <Link href="/purchase-orders?filter=sent" className="rounded-[1.25rem] border border-stone-200 bg-white p-4 hover:border-stone-300 transition">
            <p className="text-xs text-stone-400 mb-1">PO Outstanding</p>
            <p className="text-2xl font-bold text-stone-900">{posOutstandingResult.count ?? 0}</p>
            <p className="text-xs text-stone-400 mt-1">draft + terkirim</p>
          </Link>

          <Link href="/cashflow" className="rounded-[1.25rem] border border-emerald-100 bg-emerald-50 p-4 hover:border-emerald-200 transition">
            <p className="text-xs text-emerald-600 mb-1">Kas Masuk</p>
            <p className="text-lg font-bold text-emerald-700 tabular-nums">{formatRupiah(kasmasuk)}</p>
            <p className="text-xs text-emerald-500 mt-1">bulan ini</p>
          </Link>

          <Link href="/cashflow" className="rounded-[1.25rem] border border-red-100 bg-red-50 p-4 hover:border-red-200 transition">
            <p className="text-xs text-red-600 mb-1">Kas Keluar</p>
            <p className="text-lg font-bold text-red-600 tabular-nums">{formatRupiah(kasKeluar)}</p>
            <p className="text-xs text-red-400 mt-1">bulan ini</p>
          </Link>

          <div className="rounded-[1.25rem] border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-400 mb-1">Net Cashflow</p>
            <p className={`text-lg font-bold tabular-nums ${kasmasuk - kasKeluar >= 0 ? 'text-stone-900' : 'text-red-600'}`}>
              {formatRupiah(kasmasuk - kasKeluar)}
            </p>
            <p className="text-xs text-stone-400 mt-1">bulan ini</p>
          </div>
        </div>

        {/* Invoice terbaru */}
        <div className="rounded-[1.25rem] border border-stone-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900">Invoice Terbaru</h2>
            <Link href="/invoices" className="text-xs text-stone-500 hover:text-stone-900">Lihat semua →</Link>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-stone-400">Belum ada invoice.</p>
          ) : (
            recentInvoices.map(inv => (
              <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-stone-100 p-3 hover:border-stone-200 transition">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{inv.invoice_number}</span>
                    <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                  </div>
                  <p className="text-xs text-stone-500 truncate">{inv.customer_name}</p>
                </div>
                <p className="text-sm font-medium tabular-nums shrink-0">{formatRupiah(inv.total)}</p>
              </Link>
            ))
          )}
        </div>

        {/* Transaksi cashflow terbaru */}
        <div className="rounded-[1.25rem] border border-stone-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900">Transaksi Terbaru</h2>
            <Link href="/cashflow" className="text-xs text-stone-500 hover:text-stone-900">Lihat semua →</Link>
          </div>
          {recentEntries.length === 0 ? (
            <p className="text-sm text-stone-400">Belum ada transaksi.</p>
          ) : (
            recentEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between gap-4 rounded-xl border border-stone-100 p-3">
                <div className="min-w-0 flex items-center gap-3">
                  <CashflowDirectionBadge direction={entry.direction as CashflowDirection} />
                  <div className="min-w-0">
                    <p className="text-xs text-stone-700 truncate">{entry.description}</p>
                    <p className="text-xs text-stone-400">{CASHFLOW_CATEGORY_LABELS[entry.category as CashflowCategory]} · {entry.entry_date}</p>
                  </div>
                </div>
                <p className={`text-sm font-semibold tabular-nums shrink-0 ${entry.direction === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {entry.direction === 'in' ? '+' : '-'}{formatRupiah(entry.amount)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  )
}
