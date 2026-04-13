'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext, validateCompanyAccess } from '@/lib/access'
import { calcTaxByType } from '@/lib/utils'
import type { TaxType } from '@/lib/types/finance'

function finish(invoiceId: string, message: string, type: 'success' | 'error' = 'success') {
  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  revalidatePath('/dashboard')
  redirect(`/invoices/${invoiceId}?status=${encodeURIComponent(message)}&type=${type}`)
}

// ── Update header (meta) ──────────────────────────────────────────────────────

export async function updateInvoiceMetaAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const invoiceId = formData.get('invoice_id')?.toString()!
  const customerName = formData.get('customer_name')?.toString().trim()
  if (!customerName) finish(invoiceId, 'Nama customer tidak boleh kosong.', 'error')

  const { error } = await supabase
    .schema('finance')
    .from('invoices')
    .update({
      customer_id: formData.get('customer_id')?.toString() || null,
      customer_name: customerName,
      customer_address: formData.get('customer_address')?.toString().trim() || null,
      customer_npwp: formData.get('customer_npwp')?.toString().trim() || null,
      invoice_date: formData.get('invoice_date')?.toString(),
      due_date: formData.get('due_date')?.toString() || null,
      po_reference: formData.get('po_reference')?.toString().trim() || null,
      quo_reference: formData.get('quo_reference')?.toString().trim() || null,
      spk_reference: formData.get('spk_reference')?.toString().trim() || null,
      notes: formData.get('notes')?.toString().trim() || null,
    })
    .eq('id', invoiceId)

  if (error) finish(invoiceId, `Gagal update invoice: ${error.message}`, 'error')
  finish(invoiceId, 'Invoice diperbarui.')
}

// ── Upsert line items + recalculate totals ────────────────────────────────────

export async function upsertInvoiceItemsAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const invoiceId = formData.get('invoice_id')?.toString()!
  const taxType = (formData.get('tax_type')?.toString() ?? 'none') as TaxType
  const itemCount = parseInt(formData.get('item_count')?.toString() ?? '0', 10)

  // Parse items dari form fields (termasuk sub-items)
  const items = []
  for (let i = 0; i < itemCount; i++) {
    const description = formData.get(`item_description_${i}`)?.toString().trim()
    const itemType = (formData.get(`item_type_${i}`)?.toString() ?? 'main') as 'main' | 'sub'
    const subLabel = formData.get(`item_sub_label_${i}`)?.toString() || null
    const quantity = parseFloat(formData.get(`item_quantity_${i}`)?.toString() ?? '0')
    const unitPrice = parseFloat(formData.get(`item_unit_price_${i}`)?.toString() ?? '0')
    const productId = formData.get(`item_product_id_${i}`)?.toString() || null

    if (!description) continue
    if (itemType === 'main' && quantity <= 0) continue
    items.push({
      invoice_id: invoiceId,
      product_id: productId,
      description,
      quantity: itemType === 'sub' ? 0 : quantity,
      unit_price: itemType === 'sub' ? 0 : unitPrice,
      line_total: itemType === 'sub' ? 0 : quantity * unitPrice,
      sort_order: i,
      item_type: itemType,
      sub_label: subLabel,
    })
  }

  // Hapus semua item lama, insert item baru
  await supabase.schema('finance').from('invoice_items').delete().eq('invoice_id', invoiceId)
  if (items.length > 0) {
    const { error } = await supabase.schema('finance').from('invoice_items').insert(items)
    if (error) finish(invoiceId, `Gagal simpan item: ${error.message}`, 'error')
  }

  // Hitung ulang subtotal dan tax
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0)
  const { dpp, taxAmount, total, isTaxable } = calcTaxByType(subtotal, taxType)

  const { error: updateError } = await supabase
    .schema('finance')
    .from('invoices')
    .update({ tax_type: taxType, is_taxable: isTaxable, subtotal, dpp, tax_amount: taxAmount, total })
    .eq('id', invoiceId)

  if (updateError) finish(invoiceId, `Gagal update total: ${updateError.message}`, 'error')
  finish(invoiceId, 'Item berhasil disimpan.')
}

// ── Update status (generic) ───────────────────────────────────────────────────

export async function updateInvoiceStatusAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const invoiceId = formData.get('invoice_id')?.toString()!
  const newStatus = formData.get('status')?.toString()

  const allowed = ['draft', 'sent', 'cancelled']
  if (!allowed.includes(newStatus ?? '')) {
    finish(invoiceId, 'Status tidak valid.', 'error')
  }

  const update: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'cancelled') update.cancelled_at = new Date().toISOString()

  const { error } = await supabase
    .schema('finance')
    .from('invoices')
    .update(update)
    .eq('id', invoiceId)

  if (error) finish(invoiceId, `Gagal update status: ${error.message}`, 'error')
  finish(invoiceId, `Status diubah ke ${newStatus}.`)
}

// ── Mark paid → auto-generate cashflow entry ─────────────────────────────────

export async function markInvoicePaidAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const invoiceId = formData.get('invoice_id')?.toString()!

  // Fetch invoice untuk dapat company_id dan total
  const { data: invoice, error: fetchError } = await supabase
    .schema('finance')
    .from('invoices')
    .select('id, company_id, invoice_number, customer_name, total, status')
    .eq('id', invoiceId)
    .single()

  if (fetchError || !invoice) finish(invoiceId, 'Invoice tidak ditemukan.', 'error')
  if (invoice!.status === 'paid') finish(invoiceId, 'Invoice sudah lunas.', 'error')

  // Update status invoice
  const { error: updateError } = await supabase
    .schema('finance')
    .from('invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invoiceId)

  if (updateError) finish(invoiceId, `Gagal update status: ${updateError.message}`, 'error')

  // Cek apakah cashflow entry sudah ada (idempotency guard)
  const { data: existing } = await supabase
    .schema('finance')
    .from('cashflow_entries')
    .select('id')
    .eq('invoice_id', invoiceId)
    .eq('is_auto', true)
    .maybeSingle()

  if (!existing) {
    await supabase.schema('finance').from('cashflow_entries').insert({
      company_id: invoice!.company_id,
      direction: 'in',
      category: 'invoice',
      amount: invoice!.total,
      entry_date: new Date().toISOString().split('T')[0],
      description: `Invoice ${invoice!.invoice_number} — ${invoice!.customer_name}`,
      invoice_id: invoiceId,
      is_auto: true,
      created_by: user.id,
    })
  }

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  revalidatePath('/cashflow')
  revalidatePath('/dashboard')
  redirect(`/invoices/${invoiceId}?status=${encodeURIComponent('Invoice ditandai lunas. Cashflow diperbarui.')}&type=success`)
}
