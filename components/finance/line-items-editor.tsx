'use client'

import { useState, useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { formatRupiah, calcTax } from '@/lib/utils'

interface LineItem {
  id: string // local only, not saved to DB
  product_id: string
  description: string
  quantity: string
  unit_price: string
}

interface Product {
  id: string
  name: string
  price: number | null
}

interface LineItemsEditorProps {
  initialItems?: LineItem[]
  products?: Product[]
  isTaxable: boolean
}

function newItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    product_id: '',
    description: '',
    quantity: '1',
    unit_price: '0',
  }
}

export function LineItemsEditor({
  initialItems = [],
  products = [],
  isTaxable: initialTaxable,
}: LineItemsEditorProps) {
  const [items, setItems] = useState<LineItem[]>(
    initialItems.length > 0 ? initialItems : [newItem()]
  )
  const [isTaxable, setIsTaxable] = useState(initialTaxable)

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, newItem()])
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      if (prev.length === 1) return prev // jangan hapus kalau tinggal 1
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

  // ── Kalkulasi total ───────────────────────────────────────────────────────
  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unit_price) || 0
    return sum + qty * price
  }, 0)

  const { dpp, taxAmount, total } = isTaxable
    ? calcTax(subtotal)
    : { dpp: 0, taxAmount: 0, total: subtotal }

  return (
    <div className="space-y-3">
      {/* Toggle PPN */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          name="is_taxable"
          value="true"
          checked={isTaxable}
          onChange={(e) => setIsTaxable(e.target.checked)}
          className="size-4 rounded border-stone-300"
        />
        <span className="text-sm text-stone-700">Kena PPN (DPP Nilai Lain 11/12 × 12%)</span>
      </label>

      {/* Header kolom */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_80px_110px_32px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
        <span>Deskripsi</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Harga Satuan</span>
        <span />
      </div>

      {/* Baris item */}
      {items.map((item, idx) => (
        <div key={item.id} className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_80px_110px_32px] sm:items-center">
          {/* Hidden fields untuk Server Action */}
          <input type="hidden" name={`item_product_id_${idx}`} value={item.product_id} />

          <div className="flex flex-col gap-1.5">
            {/* Pilih dari produk (opsional) */}
            {products.length > 0 && (
              <select
                value={item.product_id}
                onChange={(e) => updateItem(item.id, 'product_id', e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-600 focus:border-stone-400 focus:outline-none"
              >
                <option value="">— Pilih dari katalog (opsional) —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="text"
              name={`item_description_${idx}`}
              value={item.description}
              onChange={(e) => updateItem(item.id, 'description', e.target.value)}
              placeholder="Deskripsi item"
              required
              className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
            />
          </div>

          <input
            type="number"
            name={`item_quantity_${idx}`}
            value={item.quantity}
            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
            min="0"
            step="0.01"
            required
            className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-right focus:border-stone-400 focus:outline-none"
          />

          <input
            type="number"
            name={`item_unit_price_${idx}`}
            value={item.unit_price}
            onChange={(e) => updateItem(item.id, 'unit_price', e.target.value)}
            min="0"
            step="1"
            required
            className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-right focus:border-stone-400 focus:outline-none"
          />

          <button
            type="button"
            onClick={() => removeItem(item.id)}
            disabled={items.length === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}

      {/* Tombol tambah item */}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-xs font-medium text-stone-500 transition hover:border-stone-400 hover:text-stone-700"
      >
        <Plus className="size-3.5" />
        Tambah item
      </button>

      {/* Hidden field: jumlah item (untuk parsing di Server Action) */}
      <input type="hidden" name="item_count" value={items.length} />

      {/* Summary total */}
      <div className="rounded-[1.25rem] border border-stone-100 bg-stone-50 p-4 space-y-1.5">
        <div className="flex justify-between text-sm text-stone-600">
          <span>Subtotal</span>
          <span className="font-medium tabular-nums">{formatRupiah(subtotal)}</span>
        </div>
        {isTaxable && (
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
        <div className="flex justify-between border-t border-stone-200 pt-2 text-sm font-semibold text-stone-900">
          <span>Total</span>
          <span className="tabular-nums">{formatRupiah(total)}</span>
        </div>
      </div>
    </div>
  )
}
