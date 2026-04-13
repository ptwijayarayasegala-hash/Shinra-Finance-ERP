import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatRupiah } from '@/lib/utils'
import type { InvoiceRecord, InvoiceItemRecord } from '@/lib/types/finance'

export function buildInvoicePDF(invoice: InvoiceRecord, items: InvoiceItemRecord[]): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const marginL = 20
  const marginR = 20
  const pageW = 210
  const contentW = pageW - marginL - marginR

  // Header bar
  doc.setFillColor(12, 10, 9) // stone-950
  doc.rect(0, 0, pageW, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', marginL, 12)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(invoice.invoice_number, marginL, 20)

  // Status badge area (top right)
  doc.setFontSize(9)
  doc.text(invoice.status.toUpperCase(), pageW - marginR, 16, { align: 'right' })

  // Reset color
  doc.setTextColor(0, 0, 0)

  let y = 38

  // Invoice meta — 2 columns
  const col1X = marginL
  const col2X = marginL + contentW / 2

  doc.setFontSize(8)
  doc.setTextColor(120, 113, 108) // stone-500
  doc.text('KEPADA', col1X, y)
  doc.text('TANGGAL INVOICE', col2X, y)
  y += 5
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(invoice.customer_name, col1X, y)
  doc.setFont('helvetica', 'normal')
  doc.text(invoice.invoice_date ?? '-', col2X, y)
  y += 5

  if (invoice.due_date) {
    doc.setFontSize(8)
    doc.setTextColor(120, 113, 108)
    doc.text('JATUH TEMPO', col2X, y)
    y += 4
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.text(invoice.due_date, col2X, y)
    y += 5
  } else {
    y += 2
  }

  y += 6

  // Line items table
  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR },
    head: [['Deskripsi', 'Qty', 'Harga Satuan', 'Total']],
    body: items.map(item => [
      item.description,
      String(item.quantity),
      formatRupiah(item.unit_price),
      formatRupiah(item.line_total),
    ]),
    headStyles: {
      fillColor: [28, 25, 23], // stone-900
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: { fontSize: 9, textColor: [28, 25, 23] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 38 },
      3: { halign: 'right', cellWidth: 38 },
    },
    alternateRowStyles: { fillColor: [250, 250, 249] }, // stone-50
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6

  // Totals block (right-aligned)
  const totalsX = pageW - marginR - 80
  const valueX = pageW - marginR

  const addRow = (label: string, value: string, bold = false) => {
    doc.setFontSize(9)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(bold ? 0 : 100, bold ? 0 : 92, bold ? 0 : 88)
    doc.text(label, totalsX, y)
    doc.setTextColor(0, 0, 0)
    doc.text(value, valueX, y, { align: 'right' })
    y += 5
  }

  addRow('Subtotal', formatRupiah(invoice.subtotal))

  if (invoice.is_taxable) {
    addRow('DPP (11/12)', formatRupiah(invoice.dpp))
    addRow('PPN 12%', formatRupiah(invoice.tax_amount))
  }

  // Separator line
  doc.setDrawColor(214, 211, 209) // stone-300
  doc.line(totalsX, y - 2, valueX, y - 2)
  y += 1
  addRow('TOTAL', formatRupiah(invoice.total), true)

  // Notes
  if (invoice.notes) {
    y += 4
    doc.setFontSize(8)
    doc.setTextColor(120, 113, 108)
    doc.text('Catatan:', marginL, y)
    y += 4
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(invoice.notes, contentW) as string[]
    doc.text(lines, marginL, y)
  }

  // Footer
  const footerY = 285
  doc.setFontSize(8)
  doc.setTextColor(163, 163, 163)
  doc.text('Shinra Group — shinra-finance', pageW / 2, footerY, { align: 'center' })

  return doc
}
