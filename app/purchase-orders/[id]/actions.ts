'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { calcTax } from '@/lib/utils'

function finish(poId: string, message: string, type: 'success' | 'error' = 'success') {
  revalidatePath(`/purchase-orders/${poId}`)
  revalidatePath('/purchase-orders')
  revalidatePath('/dashboard')
  redirect(`/purchase-orders/${poId}?status=${encodeURIComponent(message)}&type=${type}`)
}

export async function updatePOMetaAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const poId = formData.get('po_id')?.toString()!
  const vendorName = formData.get('vendor_name')?.toString().trim()
  if (!vendorName) finish(poId, 'Nama vendor tidak boleh kosong.', 'error')

  const { error } = await supabase
    .schema('finance')
    .from('purchase_orders')
    .update({
      vendor_id: formData.get('vendor_id')?.toString() || null,
      vendor_name: vendorName,
      po_date: formData.get('po_date')?.toString(),
      expected_date: formData.get('expected_date')?.toString() || null,
      notes: formData.get('notes')?.toString().trim() || null,
    })
    .eq('id', poId)

  if (error) finish(poId, `Gagal update PO: ${error.message}`, 'error')
  finish(poId, 'PO diperbarui.')
}

export async function upsertPOItemsAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const poId = formData.get('po_id')?.toString()!
  const isTaxable = formData.get('is_taxable') === 'true'
  const itemCount = parseInt(formData.get('item_count')?.toString() ?? '0', 10)

  const items = []
  for (let i = 0; i < itemCount; i++) {
    const description = formData.get(`item_description_${i}`)?.toString().trim()
    const quantity = parseFloat(formData.get(`item_quantity_${i}`)?.toString() ?? '0')
    const unitPrice = parseFloat(formData.get(`item_unit_price_${i}`)?.toString() ?? '0')
    const productId = formData.get(`item_product_id_${i}`)?.toString() || null
    if (!description || quantity <= 0) continue
    items.push({ po_id: poId, product_id: productId, description, quantity, unit_price: unitPrice, line_total: quantity * unitPrice, sort_order: i })
  }

  await supabase.schema('finance').from('po_items').delete().eq('po_id', poId)
  if (items.length > 0) {
    const { error } = await supabase.schema('finance').from('po_items').insert(items)
    if (error) finish(poId, `Gagal simpan item: ${error.message}`, 'error')
  }

  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0)
  const { dpp, taxAmount, total } = isTaxable ? calcTax(subtotal) : { dpp: 0, taxAmount: 0, total: subtotal }

  const { error: updateError } = await supabase
    .schema('finance')
    .from('purchase_orders')
    .update({ is_taxable: isTaxable, subtotal, dpp, tax_amount: taxAmount, total })
    .eq('id', poId)

  if (updateError) finish(poId, `Gagal update total: ${updateError.message}`, 'error')
  finish(poId, 'Item berhasil disimpan.')
}

export async function updatePOStatusAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const poId = formData.get('po_id')?.toString()!
  const newStatus = formData.get('status')?.toString()
  const allowed = ['draft', 'sent', 'cancelled']
  if (!allowed.includes(newStatus ?? '')) finish(poId, 'Status tidak valid.', 'error')

  const update: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'cancelled') update.cancelled_at = new Date().toISOString()

  const { error } = await supabase.schema('finance').from('purchase_orders').update(update).eq('id', poId)
  if (error) finish(poId, `Gagal update status: ${error.message}`, 'error')
  finish(poId, `Status diubah ke ${newStatus}.`)
}

export async function markPOReceivedAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const poId = formData.get('po_id')?.toString()!

  const { data: po, error: fetchError } = await supabase
    .schema('finance')
    .from('purchase_orders')
    .select('id, company_id, po_number, vendor_name, total, status')
    .eq('id', poId)
    .single()

  if (fetchError || !po) finish(poId, 'PO tidak ditemukan.', 'error')
  if (po!.status === 'received') finish(poId, 'PO sudah ditandai diterima.', 'error')

  const { error: updateError } = await supabase
    .schema('finance')
    .from('purchase_orders')
    .update({ status: 'received', received_at: new Date().toISOString() })
    .eq('id', poId)

  if (updateError) finish(poId, `Gagal update status: ${updateError.message}`, 'error')

  const { data: existing } = await supabase
    .schema('finance')
    .from('cashflow_entries')
    .select('id')
    .eq('po_id', poId)
    .eq('is_auto', true)
    .maybeSingle()

  if (!existing) {
    await supabase.schema('finance').from('cashflow_entries').insert({
      company_id: po!.company_id,
      direction: 'out',
      category: 'po',
      amount: po!.total,
      entry_date: new Date().toISOString().split('T')[0],
      description: `PO ${po!.po_number} — ${po!.vendor_name}`,
      po_id: poId,
      is_auto: true,
      created_by: user.id,
    })
  }

  revalidatePath(`/purchase-orders/${poId}`)
  revalidatePath('/purchase-orders')
  revalidatePath('/cashflow')
  revalidatePath('/dashboard')
  redirect(`/purchase-orders/${poId}?status=${encodeURIComponent('PO ditandai diterima. Cashflow diperbarui.')}&type=success`)
}
