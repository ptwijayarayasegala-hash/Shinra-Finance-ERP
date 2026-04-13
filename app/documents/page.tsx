import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext, getAllowedCompanyOptions } from '@/lib/access'
import { AppShell } from '@/components/app-shell'
import { StatusBanner } from '@/components/status-banner'
import { SubmitButton } from '@/components/submit-button'
import { createDocumentAction, deleteDocumentAction } from './actions'
import { ExternalLink, Paperclip, Plus, Trash2 } from 'lucide-react'
import type { DocumentRecord, DocumentType } from '@/lib/types/finance'
import { DOCUMENT_TYPE_LABELS } from '@/lib/types/finance'

type SearchParams = Promise<{ status?: string; type?: string }>

export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getAccessContext()
  const companies = await getAllowedCompanyOptions(access)
  const params = await searchParams

  let query = supabase
    .schema('finance')
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (!access.isSuperAdmin) query = query.in('company_id', access.membershipCompanyIds)
  const { data: documents } = await query
  const docs = (documents ?? []) as DocumentRecord[]

  // Fetch invoices dan POs untuk dropdown link
  const companyIds = companies.map(c => c.id)
  const [invoicesResult, posResult] = await Promise.all([
    supabase.schema('finance').from('invoices').select('id, invoice_number, customer_name').in('company_id', companyIds).neq('status', 'cancelled').order('created_at', { ascending: false }),
    supabase.schema('finance').from('purchase_orders').select('id, po_number, vendor_name').in('company_id', companyIds).neq('status', 'cancelled').order('created_at', { ascending: false }),
  ])

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-[1.6rem] border border-black/10 bg-stone-950 p-4 text-stone-50 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">Dokumen</h1>
              <p className="mt-1 text-sm text-stone-400">{docs.length} dokumen tersimpan</p>
            </div>
            <Paperclip className="size-8 text-stone-600 shrink-0" />
          </div>
        </section>

        {params.status && (
          <StatusBanner message={decodeURIComponent(params.status)} type={params.type === 'error' ? 'error' : 'success'} />
        )}

        <details className="group rounded-[1.25rem] border border-stone-200 bg-white">
          <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 text-sm font-semibold text-stone-700 select-none">
            <Plus className="size-4" />
            Tambah Dokumen
          </summary>
          <form action={createDocumentAction} className="border-t border-stone-100 px-5 pb-5 pt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Company *</label>
                <select name="company_id" required className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none">
                  <option value="">— Pilih company —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Tipe Dokumen</label>
                <select name="document_type" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none">
                  {(Object.entries(DOCUMENT_TYPE_LABELS) as [DocumentType, string][]).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-stone-600">Judul *</label>
                <input type="text" name="title" required placeholder="Contoh: Kontrak proyek solar WRS April 2026" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none" />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-stone-600">Link Dokumen * (Google Drive, Dropbox, dll)</label>
                <input type="url" name="external_url" required placeholder="https://drive.google.com/..." className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Link ke Invoice (opsional)</label>
                <select name="invoice_id" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none">
                  <option value="">— Tidak ada —</option>
                  {invoicesResult.data?.map(inv => (
                    <option key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.customer_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Link ke PO (opsional)</label>
                <select name="po_id" className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none">
                  <option value="">— Tidak ada —</option>
                  {posResult.data?.map(po => (
                    <option key={po.id} value={po.id}>{po.po_number} — {po.vendor_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-stone-600">Catatan</label>
                <textarea name="notes" rows={2} className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none resize-none" />
              </div>
            </div>
            <SubmitButton className="rounded-lg bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
              Simpan Dokumen
            </SubmitButton>
          </form>
        </details>

        <div className="space-y-2">
          {docs.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">
              Belum ada dokumen.
            </div>
          ) : (
            docs.map(doc => (
              <div key={doc.id} className="flex items-start justify-between gap-4 rounded-[1.25rem] border border-stone-200 bg-white p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-stone-500 border border-stone-200 rounded px-1.5 py-0.5">
                      {DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-stone-900">{doc.title}</p>
                  {doc.notes && <p className="text-xs text-stone-400 mt-0.5">{doc.notes}</p>}
                  <p className="text-xs text-stone-400 mt-0.5">{doc.created_at.split('T')[0]}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={doc.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-300 hover:text-stone-900 transition"
                  >
                    <ExternalLink className="size-3.5" />
                    Buka
                  </a>
                  <form action={deleteDocumentAction}>
                    <input type="hidden" name="document_id" value={doc.id} />
                    <SubmitButton className="flex items-center justify-center size-8 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors" pendingText="">
                      <Trash2 className="size-4" />
                    </SubmitButton>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  )
}
