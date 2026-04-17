'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext, validateCompanyAccess } from '@/lib/access'

function finish(message: string, type: 'success' | 'error' = 'success', extra = '') {
  revalidatePath('/letters')
  redirect(`/letters${extra}?status=${encodeURIComponent(message)}&type=${type}`)
}

export async function createLetterAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getAccessContext()
  const companyId = formData.get('company_id')?.toString()
  if (!companyId) finish('Pilih company terlebih dahulu.', 'error')

  const validation = validateCompanyAccess(access, companyId!)
  if (!validation.ok) finish(validation.message, 'error')

  const direction = formData.get('direction')?.toString() as 'masuk' | 'keluar'
  if (!direction) finish('Arah surat wajib dipilih.', 'error')

  const letterType = formData.get('letter_type')?.toString().trim().toUpperCase()
  if (!letterType) finish('Jenis surat wajib diisi.', 'error')

  const recipientOrSender = formData.get('recipient_or_sender')?.toString().trim()
  if (!recipientOrSender) finish('Nama penerima/pengirim wajib diisi.', 'error')

  const perihal = formData.get('perihal')?.toString().trim()
  if (!perihal) finish('Perihal wajib diisi.', 'error')

  const letterDateStr = formData.get('letter_date')?.toString() || new Date().toISOString().split('T')[0]
  const letterDate = new Date(letterDateStr)
  const letterMonth = letterDate.getMonth() + 1
  const letterYear = letterDate.getFullYear()

  const driveLink = formData.get('drive_link')?.toString().trim() || null

  let letterNumber: string

  if (direction === 'keluar') {
    const category = formData.get('category')?.toString()
    if (!category) finish('Kategori wajib dipilih untuk surat keluar.', 'error')

    const recipientCode = formData.get('recipient_code')?.toString().trim().toUpperCase()
    if (!recipientCode) finish('Kode penerima wajib diisi untuk surat keluar.', 'error')

    const { data: generated, error: rpcError } = await supabase.rpc(
      'finance_next_letter_number',
      {
        p_company_id: companyId,
        p_recipient_code: recipientCode,
        p_category: category,
        p_letter_type: letterType,
        p_month: letterMonth,
        p_year: letterYear,
      }
    )
    if (rpcError || !generated) finish('Gagal generate nomor surat.', 'error')
    letterNumber = generated as string

    const { error } = await supabase.schema('finance').from('letters').insert({
      company_id: companyId,
      direction,
      category,
      recipient_code: recipientCode,
      letter_type: letterType,
      letter_number: letterNumber,
      letter_date: letterDateStr,
      letter_month: letterMonth,
      letter_year: letterYear,
      recipient_or_sender: recipientOrSender,
      perihal,
      drive_link: driveLink,
      notes: formData.get('notes')?.toString().trim() || null,
      created_by: user.id,
    })
    if (error) finish(`Gagal menyimpan surat: ${error.message}`, 'error')
  } else {
    letterNumber = formData.get('letter_number_masuk')?.toString().trim() || ''
    if (!letterNumber) finish('Nomor surat masuk wajib diisi.', 'error')

    const { error } = await supabase.schema('finance').from('letters').insert({
      company_id: companyId,
      direction,
      category: null,
      recipient_code: null,
      letter_type: letterType,
      letter_number: letterNumber,
      letter_date: letterDateStr,
      letter_month: letterMonth,
      letter_year: letterYear,
      recipient_or_sender: recipientOrSender,
      perihal,
      drive_link: driveLink,
      notes: formData.get('notes')?.toString().trim() || null,
      created_by: user.id,
    })
    if (error) finish(`Gagal menyimpan surat: ${error.message}`, 'error')
  }

  finish(`Surat ${direction} berhasil dicatat: ${letterNumber}`)
}

export async function updateLetterAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = formData.get('id')?.toString()
  if (!id) finish('ID surat tidak ditemukan.', 'error')

  const perihal = formData.get('perihal')?.toString().trim()
  if (!perihal) finish('Perihal wajib diisi.', 'error')

  const recipientOrSender = formData.get('recipient_or_sender')?.toString().trim()
  if (!recipientOrSender) finish('Nama penerima/pengirim wajib diisi.', 'error')

  const driveLink = formData.get('drive_link')?.toString().trim() || null
  const notes = formData.get('notes')?.toString().trim() || null
  const letterDate = formData.get('letter_date')?.toString()

  const { error } = await supabase
    .schema('finance')
    .from('letters')
    .update({ perihal, recipient_or_sender: recipientOrSender, drive_link: driveLink, notes, letter_date: letterDate })
    .eq('id', id!)

  if (error) finish(`Gagal menyimpan perubahan: ${error.message}`, 'error')

  finish('Surat berhasil diupdate.')
}

export async function deleteLetterAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = formData.get('id')?.toString()
  if (!id) finish('ID surat tidak ditemukan.', 'error')

  const { error } = await supabase.schema('finance').from('letters').delete().eq('id', id!)
  if (error) finish(`Gagal menghapus surat: ${error.message}`, 'error')

  finish('Surat berhasil dihapus.')
}
