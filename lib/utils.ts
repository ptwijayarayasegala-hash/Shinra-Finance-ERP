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

/**
 * Hitung pajak berdasarkan tax_type:
 * - 'ppn'   : PPN 12% DPP Nilai Lain → total = subtotal + tax (ditambah)
 * - 'pph23' : PPh 23 2% → total = subtotal - tax (dipotong)
 * - 'none'  : tanpa pajak
 */
export function calcTaxByType(
  subtotal: number,
  taxType: 'ppn' | 'pph23' | 'none'
): { dpp: number; taxAmount: number; total: number; isTaxable: boolean } {
  if (taxType === 'ppn') {
    const dpp = subtotal * (11 / 12)
    const taxAmount = dpp * 0.12
    return {
      dpp: Math.round(dpp),
      taxAmount: Math.round(taxAmount),
      total: Math.round(subtotal + taxAmount),
      isTaxable: true,
    }
  }
  if (taxType === 'pph23') {
    const taxAmount = subtotal * 0.02
    return {
      dpp: 0,
      taxAmount: Math.round(taxAmount),
      total: Math.round(subtotal - taxAmount),
      isTaxable: true,
    }
  }
  return { dpp: 0, taxAmount: 0, total: subtotal, isTaxable: false }
}

/** Konversi angka ke terbilang Bahasa Indonesia (Rupiah) */
function _terbilang(n: number): string {
  const satuan = [
    '', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
    'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas',
    'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas',
  ]
  if (n < 20) return satuan[n]
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const ones = n % 10
    return satuan[tens] + ' puluh' + (ones > 0 ? ' ' + satuan[ones] : '')
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100)
    const rest = n % 100
    const prefix = hundreds === 1 ? 'seratus' : satuan[hundreds] + ' ratus'
    return prefix + (rest > 0 ? ' ' + _terbilang(rest) : '')
  }
  if (n < 1000000) {
    const thousands = Math.floor(n / 1000)
    const rest = n % 1000
    const prefix = thousands === 1 ? 'seribu' : _terbilang(thousands) + ' ribu'
    return prefix + (rest > 0 ? ' ' + _terbilang(rest) : '')
  }
  if (n < 1000000000) {
    const millions = Math.floor(n / 1000000)
    const rest = n % 1000000
    return _terbilang(millions) + ' juta' + (rest > 0 ? ' ' + _terbilang(rest) : '')
  }
  const billions = Math.floor(n / 1000000000)
  const rest = n % 1000000000
  return _terbilang(billions) + ' miliar' + (rest > 0 ? ' ' + _terbilang(rest) : '')
}

export function terbilangRupiah(amount: number): string {
  const rounded = Math.round(amount)
  if (rounded === 0) return 'Nol Rupiah'
  const words = _terbilang(rounded)
  return words.charAt(0).toUpperCase() + words.slice(1) + ' Rupiah'
}
