'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext, validateCompanyAccess } from '@/lib/access'
import { calcTax } from '@/lib/utils'
import { format } from 'date-fns'

function finish(message: string, type: 'success' | 'error' = 'success') {
  revalidatePath('/invoices')
  revalidatePath('/dashboard')
  redirect(`/invoices?status=${encodeURIComponent(message)}&type=${type}`)
}

export async function createInvoiceAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getAccessContext()
  const companyId = formData.get('company_id')?.toString()
  if (!companyId) finish('Pilih company terlebih dahulu.', 'error')

  const validation = validateCompanyAccess(access, companyId!)
  if (!validation.ok) finish(validation.message, 'error')

  const customerName = formData.get('customer_name')?.toString().trim()
  if (!customerName) finish('Nama customer wajib diisi.', 'error')

  const yymm = format(new Date(), 'yyMM')
  const { data: invoiceNumber, error: rpcError } = await supabase.rpc(
    'finance_next_invoice_number',
    { p_company_id: companyId, p_year_month: yymm }
  )
  if (rpcError || !invoiceNumber) finish('Gagal generate nomor invoice.', 'error')

  const { data: invoice, error: insertError } = await supabase
    .schema('finance')
    .from('invoices')
    .insert({
      company_id: companyId,
      invoice_number: invoiceNumber,
      customer_id: formData.get('customer_id')?.toString() || null,
      customer_name: customerName,
      invoice_date: formData.get('invoice_date')?.toString() || new Date().toISOString().split('T')[0],
      due_date: formData.get('due_date')?.toString() || null,
      notes: formData.get('notes')?.toString().trim() || null,
      is_taxable: false,
      subtotal: 0,
      dpp: 0,
      tax_amount: 0,
      total: 0,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (insertError || !invoice) finish(`Gagal membuat invoice: ${insertError?.message}`, 'error')

  revalidatePath('/invoices')
  revalidatePath('/dashboard')
  redirect(`/invoices/${invoice!.id}?status=${encodeURIComponent('Invoice dibuat. Tambahkan item sekarang.')}&type=success`)
}
