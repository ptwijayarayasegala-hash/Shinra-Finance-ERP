import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatRupiah } from '@/lib/utils'
import type { PORecord, POItemRecord } from '@/lib/types/finance'

export function buildPOPDF(po: PORecord, items: POItemRecord[]): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const marginL = 20
  const marginR = 20
  const pageW = 210
  const contentW = pageW - marginL - marginR

  // Header bar
  doc.setFillColor(12, 10, 9)
  doc.rect(0, 0, pageW, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('PURCHASE ORDER', marginL, 12)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(po.po_number, marginL, 20)

  doc.setFontSize(9)
  doc.text(po.status.toUpperCase(), pageW - marginR, 16, { align: 'right' })

  doc.setTextColor(0, 0, 0)

  let y = 38

  const col1X = marginL
  const col2X = marginL + contentW / 2

  doc.setFontSize(8)
  doc.setTextColor(120, 113, 108)
  doc.text('KEPADA VENDOR', col1X, y)
  doc.text('TANGGAL PO', col2X, y)
  y += 5
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(po.vendor_name, col1X, y)
  doc.setFont('helvetica', 'normal')
  doc.text(po.po_date ?? '-', col2X, y)
  y += 5

  if (po.expected_date) {
    doc.setFontSize(8)
    doc.setTextColor(120, 113, 108)
    doc.text('ESTIMASI TERIMA', col2X, y)
    y += 4
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.text(po.expected_date, col2X, y)
    y += 5
  } else {
    y += 2
  }

  y += 6

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
      fillColor: [28, 25, 23],
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
    alternateRowStyles: { fillColor: [250, 250, 249] },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6

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

  addRow('Subtotal', formatRupiah(po.subtotal))

  if (po.is_taxable) {
    addRow('DPP (11/12)', formatRupiah(po.dpp))
    addRow('PPN 12%', formatRupiah(po.tax_amount))
  }

  doc.setDrawColor(214, 211, 209)
  doc.line(totalsX, y - 2, valueX, y - 2)
  y += 1
  addRow('TOTAL', formatRupiah(po.total), true)

  if (po.notes) {
    y += 4
    doc.setFontSize(8)
    doc.setTextColor(120, 113, 108)
    doc.text('Catatan:', marginL, y)
    y += 4
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(po.notes, contentW) as string[]
    doc.text(lines, marginL, y)
  }

  // Approval section
  y += 14
  if (y < 240) {
    doc.setFontSize(8)
    doc.setTextColor(120, 113, 108)
    const sigY = y + 18
    doc.text('Disetujui oleh', marginL, y)
    doc.text('Diterima oleh', pageW - marginR - 50, y)
    doc.setDrawColor(214, 211, 209)
    doc.line(marginL, sigY, marginL + 60, sigY)
    doc.line(pageW - marginR - 50, sigY, pageW - marginR, sigY)
  }

  const footerY = 285
  doc.setFontSize(8)
  doc.setTextColor(163, 163, 163)
  doc.text('Shinra Group — shinra-finance', pageW / 2, footerY, { align: 'center' })

  return doc
}
