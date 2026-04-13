'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccessContext, validateCompanyAccess } from '@/lib/access'
import { calcTax } from '@/lib/utils'

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
      invoice_date: formData.get('invoice_date')?.toString(),
      due_date: formData.get('due_date')?.toString() || null,
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
  const isTaxable = formData.get('is_taxable') === 'true'
  const itemCount = parseInt(formData.get('item_count')?.toString() ?? '0', 10)

  // Parse items dari form fields
  const items = []
  for (let i = 0; i < itemCount; i++) {
    const description = formData.get(`item_description_${i}`)?.toString().trim()
    const quantity = parseFloat(formData.get(`item_quantity_${i}`)?.toString() ?? '0')
    const unitPrice = parseFloat(formData.get(`item_unit_price_${i}`)?.toString() ?? '0')
    const productId = formData.get(`item_product_id_${i}`)?.toString() || null

    if (!description || quantity <= 0) continue
    items.push({
      invoice_id: invoiceId,
      product_id: productId,
      description,
      quantity,
      unit_price: unitPrice,
      line_total: quantity * unitPrice,
      sort_order: i,
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
  const { dpp, taxAmount, total } = isTaxable ? calcTax(subtotal) : { dpp: 0, taxAmount: 0, total: subtotal }

  const { error: updateError } = await supabase
    .schema('finance')
    .from('invoices')
    .update({ is_taxable: isTaxable, subtotal, dpp, tax_amount: taxAmount, total })
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
