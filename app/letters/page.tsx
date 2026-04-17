import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext, getAllowedCompanyOptions } from '@/lib/access'
import { AppShell } from '@/components/app-shell'
import { StatusBanner } from '@/components/status-banner'
import { SubmitButton } from '@/components/submit-button'
import { createLetterAction, updateLetterAction, deleteLetterAction } from './actions'
import Link from 'next/link'
import { ExternalLink, Mail, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { LetterRecord, LetterDirection, LetterCategory } from '@/lib/types/finance'
import { LETTER_CATEGORY_LABELS, LETTER_TYPE_OPTIONS } from '@/lib/types/finance'

type SearchParams = Promise<{ dir?: string; year?: string; status?: string; type?: string; edit?: string }>

const CATEGORY_COLORS: Record<LetterCategory, string> = {
  A: 'bg-blue-50 text-blue-700 border-blue-200',
  B: 'bg-violet-50 text-violet-700 border-violet-200',
  C: 'bg-amber-50 text-amber-700 border-amber-200',
}

function DriveInput({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <label className="text-xs font-medium text-muted-foreground">Link Google Drive (opsional)</label>
      <input
        type="url"
        name="drive_link"
        defaultValue={defaultValue ?? ''}
        placeholder="https://drive.google.com/..."
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
    </div>
  )
}

export default async function LettersPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getAccessContext()
  const companies = await getAllowedCompanyOptions(access)
  const params = await searchParams
  const filterDir = (params.dir ?? 'all') as LetterDirection | 'all'
  const currentYear = new Date().getFullYear()
  const filterYear = params.year ? parseInt(params.year) : currentYear
  const editId = params.edit ?? null

  let query = supabase
    .schema('finance')
    .from('letters')
    .select('*')
    .order('letter_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (!access.isSuperAdmin) {
    query = query.in('company_id', access.membershipCompanyIds)
  }
  if (filterDir !== 'all') {
    query = query.eq('direction', filterDir)
  }
  query = query.eq('letter_year', filterYear)

  const { data: letters } = await query

  const companyMap = Object.fromEntries(companies.map(c => [c.id, c]))
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - i)

  const editLetter = editId ? (letters ?? []).find((l: LetterRecord) => l.id === editId) ?? null : null

  const baseHref = `/letters?dir=${filterDir}&year=${filterYear}`

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <section className="rounded-[1.6rem] border border-primary/20 bg-primary p-4 text-primary-foreground sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">Surat</h1>
              <p className="mt-1 text-sm text-primary-foreground/60">
                {letters?.length ?? 0} surat ditemukan · {filterYear}
              </p>
            </div>
            <Mail className="size-8 text-primary-foreground/50 shrink-0" />
          </div>
        </section>

        {params.status && (
          <StatusBanner
            message={decodeURIComponent(params.status)}
            type={params.type === 'error' ? 'error' : 'success'}
          />
        )}

        {/* Filter */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'keluar', 'masuk'] as const).map((d) => (
            <Link
              key={d}
              href={`/letters?dir=${d}&year=${filterYear}`}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                filterDir === d
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-border/80'
              }`}
            >
              {d === 'all' ? 'Semua' : d === 'keluar' ? 'Keluar' : 'Masuk'}
            </Link>
          ))}
          <div className="ml-auto flex gap-2">
            {yearOptions.map((y) => (
              <Link
                key={y}
                href={`/letters?dir=${filterDir}&year=${y}`}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  filterYear === y
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80'
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>

        {/* Edit form — muncul kalau ?edit=<id> */}
        {editLetter && (
          <div className="rounded-[1.25rem] border border-primary/30 bg-card shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div>
                <p className="text-sm font-semibold text-foreground">Edit Surat</p>
                <p className="text-xs text-muted-foreground font-mono">{editLetter.letter_number}</p>
              </div>
              <Link
                href={baseHref}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="size-4" />
              </Link>
            </div>
            <form action={updateLetterAction} className="px-5 pb-5 pt-4 space-y-4">
              <input type="hidden" name="id" value={editLetter.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Perihal *</label>
                  <input
                    type="text"
                    name="perihal"
                    required
                    defaultValue={editLetter.perihal}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {editLetter.direction === 'keluar' ? 'Nama Penerima' : 'Nama Pengirim'} *
                  </label>
                  <input
                    type="text"
                    name="recipient_or_sender"
                    required
                    defaultValue={editLetter.recipient_or_sender}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tanggal Surat</label>
                  <input
                    type="date"
                    name="letter_date"
                    defaultValue={editLetter.letter_date}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <DriveInput defaultValue={editLetter.drive_link} />
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Catatan</label>
                  <textarea
                    name="notes"
                    rows={2}
                    defaultValue={editLetter.notes ?? ''}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
                  />
                </div>
              </div>
              <SubmitButton className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Simpan Perubahan
              </SubmitButton>
            </form>
          </div>
        )}

        {/* Form catat surat baru */}
        <details className="group rounded-[1.25rem] border border-border bg-card">
          <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 text-sm font-semibold text-foreground select-none">
            <Plus className="size-4" />
            Catat Surat Baru
          </summary>
          <form action={createLetterAction} className="border-t border-border/50 px-5 pb-5 pt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Company *</label>
                <select name="company_id" required className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="">— Pilih company —</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Arah *</label>
                <select name="direction" required className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="keluar">Surat Keluar</option>
                  <option value="masuk">Surat Masuk</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Kategori (keluar) *</label>
                <select name="category" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="">— (kosongkan jika masuk) —</option>
                  <option value="A">A — Internal</option>
                  <option value="B">B — Antar Divisi</option>
                  <option value="C">C — Luar</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Kode Penerima (keluar) *</label>
                <input
                  type="text"
                  name="recipient_code"
                  maxLength={5}
                  placeholder="mis. SL, HR, ADM"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none uppercase"
                />
                <p className="text-[11px] text-muted-foreground">2–3 huruf, dipakai dalam nomor surat</p>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Nomor Surat Masuk (jika masuk)</label>
                <input
                  type="text"
                  name="letter_number_masuk"
                  placeholder="Nomor referensi dari pengirim"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Jenis Surat *</label>
                <select name="letter_type" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  {LETTER_TYPE_OPTIONS.map(opt => (
                    <option key={opt.code} value={opt.code}>{opt.label}</option>
                  ))}
                  <option value="LIN">Lainnya (LIN)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tanggal Surat *</label>
                <input
                  type="date"
                  name="letter_date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Nama Penerima / Pengirim *</label>
                <input
                  type="text"
                  name="recipient_or_sender"
                  required
                  placeholder="Nama penerima (keluar) atau pengirim (masuk)"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Perihal *</label>
                <input
                  type="text"
                  name="perihal"
                  required
                  placeholder="Perihal / subjek surat"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <DriveInput />

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Catatan</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Catatan opsional..."
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
                />
              </div>
            </div>

            <SubmitButton className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Simpan Surat
            </SubmitButton>
          </form>
        </details>

        {/* Daftar surat */}
        <div className="space-y-2">
          {(letters ?? []).length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Belum ada surat untuk periode ini.
            </div>
          ) : (
            (letters ?? []).map((letter: LetterRecord) => {
              const company = companyMap[letter.company_id]
              const isEditing = editId === letter.id
              return (
                <div
                  key={letter.id}
                  className={`flex items-start justify-between gap-4 rounded-[1.25rem] border bg-card p-4 transition ${
                    isEditing ? 'border-primary/40 shadow-sm' : 'border-border'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        letter.direction === 'keluar'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-sky-200 bg-sky-50 text-sky-700'
                      }`}>
                        {letter.direction === 'keluar' ? '↑ Keluar' : '↓ Masuk'}
                      </span>

                      {letter.category && (
                        <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_COLORS[letter.category as LetterCategory]}`}>
                          {letter.category} · {LETTER_CATEGORY_LABELS[letter.category as LetterCategory]}
                        </span>
                      )}

                      <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {letter.letter_type}
                      </span>

                      {company && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: company.color }} />
                          {company.prefix}
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 text-sm font-semibold text-foreground font-mono tracking-wide">
                      {letter.letter_number}
                    </p>
                    <p className="mt-0.5 text-xs text-foreground/80">{letter.perihal}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {letter.direction === 'keluar' ? 'Kepada: ' : 'Dari: '}
                      {letter.recipient_or_sender}
                    </p>

                    {letter.drive_link && (
                      <a
                        href={letter.drive_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        Buka di Google Drive
                      </a>
                    )}

                    {letter.notes && (
                      <p className="mt-0.5 text-xs text-muted-foreground italic">{letter.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="text-xs text-muted-foreground">{letter.letter_date}</p>
                    <div className="flex gap-1">
                      <Link
                        href={isEditing ? baseHref : `${baseHref}&edit=${letter.id}`}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Edit surat"
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                      <form action={deleteLetterAction}>
                        <input type="hidden" name="id" value={letter.id} />
                        <button
                          type="submit"
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Hapus surat"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </AppShell>
  )
}
