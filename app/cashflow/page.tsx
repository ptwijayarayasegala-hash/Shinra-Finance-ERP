import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext, getAllowedCompanyOptions } from '@/lib/access'
import { AppShell } from '@/components/app-shell'
import { StatusBanner } from '@/components/status-banner'
import { SubmitButton } from '@/components/submit-button'
import { CashflowDirectionBadge } from '@/components/finance/cashflow-direction-badge'
import { CashflowChart } from './cashflow-chart-client'
import { createManualEntryAction, deleteManualEntryAction } from './actions'
import { formatRupiah } from '@/lib/utils'
import { Plus, TrendingUp } from 'lucide-react'
import { format, subMonths, startOfMonth } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import type { CashflowEntry, CashflowDirection, CashflowCategory } from '@/lib/types/finance'
import { CASHFLOW_CATEGORY_LABELS, MANUAL_CASHFLOW_CATEGORIES } from '@/lib/types/finance'

type SearchParams = Promise<{ status?: string; type?: string }>

export default async function CashflowPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getAccessContext()
  const companies = await getAllowedCompanyOptions(access)
  const params = await searchParams

  let query = supabase
    .schema('finance')
    .from('cashflow_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (!access.isSuperAdmin) query = query.in('company_id', access.membershipCompanyIds)
  const { data: entries } = await query
  const allEntries = (entries ?? []) as CashflowEntry[]

  // ── Agregasi per bulan untuk chart (12 bulan terakhir) ────────────────────
  const now = new Date()
  const monthMap: Record<string, { in: number; out: number }> = {}

  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i)
    const key = format(d, 'MMM yy', { locale: idLocale })
    monthMap[key] = { in: 0, out: 0 }
  }

  for (const entry of allEntries) {
    const d = new Date(entry.entry_date)
    const key = format(d, 'MMM yy', { locale: idLocale })
    if (monthMap[key]) {
      monthMap[key][entry.direction] += entry.amount
    }
  }

  const chartData = Object.entries(monthMap).map(([month, v]) => ({
    month,
    in: v.in,
    out: v.out,
    net: v.in - v.out,
  }))

  // ── KPI bulan ini ─────────────────────────────────────────────────────────
  const thisMonthKey = format(now, 'MMM yy', { locale: idLocale })
  const thisMonth = monthMap[thisMonthKey] ?? { in: 0, out: 0 }

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-[1.6rem] border border-black/10 bg-stone-950 p-4 text-stone-50 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">Cashflow</h1>
              <p className="mt-1 text-sm text-stone-400">{allEntries.length} transaksi tercatat</p>
            </div>
            <TrendingUp className="size-8 text-stone-600 shrink-0" />
          </div>
        </section>

        {params.status && (
          <StatusBanner message={decodeURIComponent(params.status)} type={params.type === 'error' ? 'error' : 'success'} />
        )}

        {/* KPI Bulan ini */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[1.25rem] border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-400 mb-1">Masuk</p>
            <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatRupiah(thisMonth.in)}</p>
            <p className="text-xs text-stone-400 mt-0.5">bulan ini</p>
          </div>
          <div className="rounded-[1.25rem] border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-400 mb-1">Keluar</p>
            <p className="text-lg font-bold text-red-500 tabular-nums">{formatRupiah(thisMonth.out)}</p>
            <p className="text-xs text-stone-400 mt-0.5">bulan ini</p>
          </div>
          <div className="rounded-[1.25rem] border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-400 mb-1">Net</p>
            <p className={`text-lg font-bold tabular-nums ${thisMonth.in - thisMonth.out >= 0 ? 'text-stone-900' : 'text-red-600'}`}>
              {formatRupiah(thisMonth.in - thisMonth.out)}
            </p>
            <p className="text-xs text-stone-400 mt-0.5">bulan ini</p>
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-[1.25rem] border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-900 mb-4">12 Bulan Terakhir</h2>
          <CashflowChart data={chartData} />
        </div>

        {/* Form entry manual */}
        <details className="group rounded-[1.25rem] border border-stone-200 bg-white">
          <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 text-sm font-semibold text-stone-700 select-none">
            <Plus className="size-4" />
            Tambah Entry Manual
          </summary>
          <form action={createManualEntryAction} className="border-t border-stone-100 px-5 pb-5 pt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Company *</label>
                <select name="company_id" required className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none">
                  <option value="">— Pilih company —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Arah *</label>
                <div className="flex gap-3">
                  {(['in', 'out'] as const).map(d => (
                    <label key={d} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="direction" value={d} defaultChecked={d === 'out'} className="size-4" />
                      <span className="text-sm">{d === 'in' ? 'Masuk' : 'Keluar'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Kategori *</label>
                <select name="category" required className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none">
                  {MANUAL_CASHFLOW_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{CASHFLOW_CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Jumlah (IDR) *</label>
                <input type="number" name="amount" min="1" step="1" required placeholder="0" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Tanggal *</label>
                <input type="date" name="entry_date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none" />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-stone-600">Deskripsi *</label>
                <input type="text" name="description" required placeholder="Contoh: Gaji tim April 2026" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none" />
              </div>
            </div>

            <SubmitButton className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
              Tambah Entry
            </SubmitButton>
          </form>
        </details>

        {/* Daftar entries */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-stone-700">Semua Transaksi</h2>
          {allEntries.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">
              Belum ada transaksi cashflow.
            </div>
          ) : (
            allEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-stone-200 bg-white p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <CashflowDirectionBadge direction={entry.direction as CashflowDirection} />
                    <span className="text-xs text-stone-400">{CASHFLOW_CATEGORY_LABELS[entry.category as CashflowCategory]}</span>
                    {entry.is_auto && <span className="text-[10px] text-stone-400 border border-stone-200 rounded px-1.5 py-0.5">Auto</span>}
                  </div>
                  <p className="text-sm text-stone-700 truncate">{entry.description}</p>
                  <p className="text-xs text-stone-400">{entry.entry_date}</p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-3">
                  <p className={`text-sm font-semibold tabular-nums ${entry.direction === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {entry.direction === 'in' ? '+' : '-'}{formatRupiah(entry.amount)}
                  </p>
                  {!entry.is_auto && (
                    <form action={deleteManualEntryAction}>
                      <input type="hidden" name="entry_id" value={entry.id} />
                      <SubmitButton className="text-xs text-stone-400 hover:text-red-600 transition-colors" pendingText="...">
                        Hapus
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  )
}
