'use client'

import { useState, useCallback } from 'react'
import { Plus, Trash2, CornerDownRight } from 'lucide-react'
import { formatRupiah, calcTaxByType } from '@/lib/utils'
import type { TaxType } from '@/lib/types/finance'

interface LineItem {
  id: string
  product_id: string
  description: string
  quantity: string
  unit_price: string
  item_type: 'main' | 'sub'
  sub_label: string
}

interface Product {
  id: string
  name: string
  price: number | null
}

interface LineItemsEditorProps {
  initialItems?: LineItem[]
  products?: Product[]
  taxType: TaxType
}

const SUB_LABELS = ['a', 'b', 'c', 'd', 'e', 'f']

function newMainItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    product_id: '',
    description: '',
    quantity: '1',
    unit_price: '0',
    item_type: 'main',
    sub_label: '',
  }
}

function newSubItem(label: string): LineItem {
  return {
    id: crypto.randomUUID(),
    product_id: '',
    description: '',
    quantity: '0',
    unit_price: '0',
    item_type: 'sub',
    sub_label: label,
  }
}

const TAX_OPTIONS: { value: TaxType; label: string }[] = [
  { value: 'none', label: 'Tanpa Pajak' },
  { value: 'ppn', label: 'PPN 12% (DPP Nilai Lain 11/12 × 12%)' },
  { value: 'pph23', label: 'PPh 23 2% (dipotong dari subtotal)' },
]

export function LineItemsEditor({
  initialItems = [],
  products = [],
  taxType: initialTaxType,
}: LineItemsEditorProps) {
  const [items, setItems] = useState<LineItem[]>(
    initialItems.length > 0 ? initialItems : [newMainItem()]
  )
  const [taxType, setTaxType] = useState<TaxType>(initialTaxType)

  const addMainItem = useCallback(() => {
    setItems((prev) => [...prev, newMainItem()])
  }, [])

  const addSubItem = useCallback((afterIndex: number) => {
    setItems((prev) => {
      // Count existing sub-items after this main item (up to next main item)
      let subCount = 0
      for (let i = afterIndex + 1; i < prev.length; i++) {
        if (prev[i].item_type === 'main') break
        subCount++
      }
      const label = SUB_LABELS[subCount] ?? String(subCount + 1)
      const sub = newSubItem(label)
      const next = [...prev]
      // Find insertion point: after all existing sub-items for this main
      let insertAt = afterIndex + 1
      while (insertAt < next.length && next[insertAt].item_type === 'sub') {
        insertAt++
      }
      next.splice(insertAt, 0, sub)
      return next
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const mainCount = prev.filter((i) => i.item_type === 'main').length
      const target = prev.find((i) => i.id === id)
      if (!target) return prev
      if (target.item_type === 'main' && mainCount === 1) return prev // keep at least 1 main
      return prev.filter((item) => item.id !== id)
    })
  }, [])

  const updateItem = useCallback((id: string, field: keyof LineItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        if (field === 'product_id' && value) {
          const product = products.find((p) => p.id === value)
          return {
            ...item,
            product_id: value,
            description: product?.name ?? item.description,
            unit_price: product?.price != null ? String(product.price) : item.unit_price,
          }
        }
        return { ...item, [field]: value }
      })
    )
  }, [products])

  // ── Kalkulasi total (hanya main items yang punya harga) ───────────────────
  const subtotal = items.reduce((sum, item) => {
    if (item.item_type === 'sub') return sum
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unit_price) || 0
    return sum + qty * price
  }, 0)

  const { dpp, taxAmount, total } = calcTaxByType(subtotal, taxType)

  // Nomor urut main items
  let mainCounter = 0

  return (
    <div className="space-y-3">
      {/* Tax type selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-stone-600">Jenis Pajak</label>
        <select
          name="tax_type"
          value={taxType}
          onChange={(e) => setTaxType(e.target.value as TaxType)}
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-stone-400 focus:outline-none"
        >
          {TAX_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Header kolom */}
      <div className="hidden sm:grid sm:grid-cols-[24px_1fr_80px_110px_32px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
        <span>#</span>
        <span>Deskripsi</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Harga Satuan</span>
        <span />
      </div>

      {/* Baris item */}
      {items.map((item, idx) => {
        const isSub = item.item_type === 'sub'
        if (!isSub) mainCounter++
        const rowNum = isSub ? '' : String(mainCounter)

        return (
          <div key={item.id}>
            {/* Hidden fields untuk Server Action */}
            <input type="hidden" name={`item_product_id_${idx}`} value={item.product_id} />
            <input type="hidden" name={`item_type_${idx}`} value={item.item_type} />
            <input type="hidden" name={`item_sub_label_${idx}`} value={item.sub_label} />

            <div className={`flex flex-col gap-2 sm:grid sm:grid-cols-[24px_1fr_80px_110px_32px] sm:items-center ${isSub ? 'pl-6' : ''}`}>
              {/* Nomor / label */}
              <div className="hidden sm:flex items-center">
                {isSub ? (
                  <span className="text-xs text-stone-400 flex items-center gap-0.5">
                    <CornerDownRight className="size-3" />{item.sub_label}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-stone-500">{rowNum}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                {!isSub && products.length > 0 && (
                  <select
                    value={item.product_id}
                    onChange={(e) => updateItem(item.id, 'product_id', e.target.value)}
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-600 focus:border-stone-400 focus:outline-none"
                  >
                    <option value="">— Pilih dari katalog (opsional) —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  name={`item_description_${idx}`}
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  placeholder={isSub ? `Sub-item ${item.sub_label}` : 'Deskripsi item'}
                  required={!isSub}
                  className={`w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none ${isSub ? 'text-stone-500' : ''}`}
                />
              </div>

              <input
                type="number"
                name={`item_quantity_${idx}`}
                value={item.quantity}
                onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                min="0"
                step="0.01"
                disabled={isSub}
                className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-right focus:border-stone-400 focus:outline-none disabled:bg-stone-50 disabled:text-stone-400"
              />

              <input
                type="number"
                name={`item_unit_price_${idx}`}
                value={item.unit_price}
                onChange={(e) => updateItem(item.id, 'unit_price', e.target.value)}
                min="0"
                step="1"
                disabled={isSub}
                className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-right focus:border-stone-400 focus:outline-none disabled:bg-stone-50 disabled:text-stone-400"
              />

              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            {/* Tombol tambah sub-item (hanya di main item) */}
            {!isSub && (
              <button
                type="button"
                onClick={() => addSubItem(idx)}
                className="ml-6 mt-1 flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 transition"
              >
                <CornerDownRight className="size-3" />
                Tambah sub-item
              </button>
            )}
          </div>
        )
      })}

      {/* Tombol tambah main item */}
      <button
        type="button"
        onClick={addMainItem}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-xs font-medium text-stone-500 transition hover:border-stone-400 hover:text-stone-700"
      >
        <Plus className="size-3.5" />
        Tambah item
      </button>

      {/* Hidden: jumlah total item (main + sub) */}
      <input type="hidden" name="item_count" value={items.length} />

      {/* Summary total */}
      <div className="rounded-[1.25rem] border border-stone-100 bg-stone-50 p-4 space-y-1.5">
        <div className="flex justify-between text-sm text-stone-600">
          <span>Subtotal</span>
          <span className="font-medium tabular-nums">{formatRupiah(subtotal)}</span>
        </div>
        {taxType === 'ppn' && (
          <>
            <div className="flex justify-between text-sm text-stone-500">
              <span>DPP (11/12)</span>
              <span className="tabular-nums">{formatRupiah(dpp)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-500">
              <span>PPN 12%</span>
              <span className="tabular-nums">{formatRupiah(taxAmount)}</span>
            </div>
          </>
        )}
        {taxType === 'pph23' && (
          <div className="flex justify-between text-sm text-stone-500">
            <span>PPh 23 2% (dipotong)</span>
            <span className="tabular-nums text-red-600">({formatRupiah(taxAmount)})</span>
          </div>
        )}
        <div className="flex justify-between border-t border-stone-200 pt-2 text-sm font-semibold text-stone-900">
          <span>Total</span>
          <span className="tabular-nums">{formatRupiah(total)}</span>
        </div>
      </div>
    </div>
  )
}
