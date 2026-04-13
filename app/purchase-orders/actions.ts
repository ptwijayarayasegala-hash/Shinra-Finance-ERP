'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext, validateCompanyAccess } from '@/lib/access'
import { format } from 'date-fns'

function finish(message: string, type: 'success' | 'error' = 'success') {
  revalidatePath('/purchase-orders')
  revalidatePath('/dashboard')
  redirect(`/purchase-orders?status=${encodeURIComponent(message)}&type=${type}`)
}

export async function createPOAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getAccessContext()
  const companyId = formData.get('company_id')?.toString()
  if (!companyId) finish('Pilih company terlebih dahulu.', 'error')

  const validation = validateCompanyAccess(access, companyId!)
  if (!validation.ok) finish(validation.message, 'error')

  const vendorName = formData.get('vendor_name')?.toString().trim()
  if (!vendorName) finish('Nama vendor wajib diisi.', 'error')

  const yymm = format(new Date(), 'yyMM')
  const { data: poNumber, error: rpcError } = await supabase.rpc(
    'finance_next_po_number',
    { p_company_id: companyId, p_year_month: yymm }
  )
  if (rpcError || !poNumber) finish('Gagal generate nomor PO.', 'error')

  const { data: po, error: insertError } = await supabase
    .schema('finance')
    .from('purchase_orders')
    .insert({
      company_id: companyId,
      po_number: poNumber,
      vendor_id: formData.get('vendor_id')?.toString() || null,
      vendor_name: vendorName,
      vendor_address: formData.get('vendor_address')?.toString().trim() || null,
      vendor_npwp: formData.get('vendor_npwp')?.toString().trim() || null,
      po_date: formData.get('po_date')?.toString() || new Date().toISOString().split('T')[0],
      expected_date: formData.get('expected_date')?.toString() || null,
      ref_invoice: formData.get('ref_invoice')?.toString().trim() || null,
      notes: formData.get('notes')?.toString().trim() || null,
      tax_type: formData.get('tax_type')?.toString() || 'none',
      is_taxable: false,
      subtotal: 0,
      dpp: 0,
      tax_amount: 0,
      total: 0,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (insertError || !po) finish(`Gagal membuat PO: ${insertError?.message}`, 'error')

  revalidatePath('/purchase-orders')
  revalidatePath('/dashboard')
  redirect(`/purchase-orders/${po!.id}?status=${encodeURIComponent('PO dibuat. Tambahkan item sekarang.')}&type=success`)
}
