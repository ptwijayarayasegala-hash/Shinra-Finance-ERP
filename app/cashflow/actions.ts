'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext, validateCompanyAccess } from '@/lib/access'

function finish(message: string, type: 'success' | 'error' = 'success') {
  revalidatePath('/cashflow')
  revalidatePath('/dashboard')
  redirect(`/cashflow?status=${encodeURIComponent(message)}&type=${type}`)
}

export async function createManualEntryAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getAccessContext()
  const companyId = formData.get('company_id')?.toString()
  if (!companyId) finish('Pilih company terlebih dahulu.', 'error')

  const validation = validateCompanyAccess(access, companyId!)
  if (!validation.ok) finish(validation.message, 'error')

  const direction = formData.get('direction')?.toString()
  if (!['in', 'out'].includes(direction ?? '')) finish('Direction tidak valid.', 'error')

  const category = formData.get('category')?.toString()
  const validCategories = ['salary', 'operational', 'tax', 'other']
  if (!validCategories.includes(category ?? '')) finish('Kategori tidak valid.', 'error')

  const amount = parseFloat(formData.get('amount')?.toString() ?? '0')
  if (amount <= 0) finish('Jumlah harus lebih dari 0.', 'error')

  const description = formData.get('description')?.toString().trim()
  if (!description) finish('Deskripsi wajib diisi.', 'error')

  const { error } = await supabase.schema('finance').from('cashflow_entries').insert({
    company_id: companyId,
    direction,
    category,
    amount,
    entry_date: formData.get('entry_date')?.toString() || new Date().toISOString().split('T')[0],
    description,
    is_auto: false,
    created_by: user.id,
  })

  if (error) finish(`Gagal simpan: ${error.message}`, 'error')
  finish('Entry cashflow ditambahkan.')
}

export async function updateManualEntryAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const entryId = formData.get('entry_id')?.toString()!
  const amount = parseFloat(formData.get('amount')?.toString() ?? '0')
  if (amount <= 0) finish('Jumlah harus lebih dari 0.', 'error')

  const description = formData.get('description')?.toString().trim()
  if (!description) finish('Deskripsi wajib diisi.', 'error')

  // Hanya boleh update entry manual (is_auto = false)
  const { error } = await supabase
    .schema('finance')
    .from('cashflow_entries')
    .update({
      direction: formData.get('direction')?.toString(),
      category: formData.get('category')?.toString(),
      amount,
      entry_date: formData.get('entry_date')?.toString(),
      description,
    })
    .eq('id', entryId)
    .eq('is_auto', false) // Guard: tidak bisa edit auto-generated entry

  if (error) finish(`Gagal update: ${error.message}`, 'error')
  finish('Entry diperbarui.')
}

export async function deleteManualEntryAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const entryId = formData.get('entry_id')?.toString()!

  // Hanya boleh delete entry manual (is_auto = false)
  const { error } = await supabase
    .schema('finance')
    .from('cashflow_entries')
    .delete()
    .eq('id', entryId)
    .eq('is_auto', false)

  if (error) finish(`Gagal hapus: ${error.message}`, 'error')
  finish('Entry dihapus.')
}
