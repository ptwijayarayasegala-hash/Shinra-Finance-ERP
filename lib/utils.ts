import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format angka ke rupiah: 1500000 → "Rp 1.500.000" */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Hitung tax (DPP Nilai Lain — untuk PKP aktif):
 *  DPP = subtotal × (11/12)
 *  PPN = DPP × 12%
 *  Total = subtotal + PPN
 */
export function calcTax(subtotal: number): { dpp: number; taxAmount: number; total: number } {
  const dpp = subtotal * (11 / 12)
  const taxAmount = dpp * 0.12
  const total = subtotal + taxAmount
  return {
    dpp: Math.round(dpp),
    taxAmount: Math.round(taxAmount),
    total: Math.round(total),
  }
}
