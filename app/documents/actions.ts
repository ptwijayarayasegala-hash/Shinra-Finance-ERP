'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext, validateCompanyAccess } from '@/lib/access'

function finish(message: string, type: 'success' | 'error' = 'success') {
  revalidatePath('/documents')
  redirect(`/documents?status=${encodeURIComponent(message)}&type=${type}`)
}

export async function createDocumentAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getAccessContext()
  const companyId = formData.get('company_id')?.toString()
  if (!companyId) finish('Pilih company terlebih dahulu.', 'error')

  const validation = validateCompanyAccess(access, companyId!)
  if (!validation.ok) finish(validation.message, 'error')

  const title = formData.get('title')?.toString().trim()
  if (!title) finish('Judul wajib diisi.', 'error')

  const externalUrl = formData.get('external_url')?.toString().trim()
  if (!externalUrl) finish('Link dokumen wajib diisi.', 'error')

  const { error } = await supabase.schema('finance').from('documents').insert({
    company_id: companyId,
    title,
    document_type: formData.get('document_type')?.toString() || 'other',
    external_url: externalUrl,
    invoice_id: formData.get('invoice_id')?.toString() || null,
    po_id: formData.get('po_id')?.toString() || null,
    notes: formData.get('notes')?.toString().trim() || null,
    created_by: user.id,
  })

  if (error) finish(`Gagal simpan dokumen: ${error.message}`, 'error')
  finish('Dokumen berhasil ditambahkan.')
}

export async function deleteDocumentAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const documentId = formData.get('document_id')?.toString()!
  const { error } = await supabase.schema('finance').from('documents').delete().eq('id', documentId)
  if (error) finish(`Gagal hapus: ${error.message}`, 'error')
  finish('Dokumen dihapus.')
}
