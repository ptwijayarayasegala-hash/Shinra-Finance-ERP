import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatRupiah, terbilangRupiah } from '@/lib/utils'
import type { PORecord, POItemRecord } from '@/lib/types/finance'
import type { Company } from '@/lib/types'

// ─── Helpers (same as invoice-pdf) ───────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function fillPoly(doc: jsPDF, pts: [number, number][], color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2])
  const deltas = pts.slice(1).map((pt, i) => [pt[0] - pts[i][0], pt[1] - pts[i][1]] as [number, number])
  doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], 'F', true)
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function formatDate(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export async function buildPOPDF(
  po: PORecord,
  items: POItemRecord[],
  company: Company | null
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const marginL = 15
  const marginR = 15
  const headerH = 42

  // ── Color palette ──────────────────────────────────────────────────────────
  const primary = hexToRgb(company?.color ?? '#1c1917')
  const secondary = hexToRgb(company?.color_secondary ?? '#44403c')
  const accent = hexToRgb(company?.color_accent ?? '#eab308')
  const white: [number, number, number] = [255, 255, 255]

  // ── Logo ───────────────────────────────────────────────────────────────────
  let logoDataUrl: string | null = null
  if (company?.logo_url) {
    logoDataUrl = await loadImageDataUrl(company.logo_url)
  }

  // ── Header decorative shapes ───────────────────────────────────────────────
  fillPoly(doc, [[0, 0], [pageW, 0], [pageW, headerH], [0, headerH]], primary)
  fillPoly(doc, [[140, 0], [pageW, 0], [pageW, headerH], [155, headerH]], secondary)
  fillPoly(doc, [[168, 0], [pageW, 0], [pageW, headerH * 0.6], [180, headerH * 0.6]], accent)

  // ── Logo in header ─────────────────────────────────────────────────────────
  let logoEndX = marginL
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', marginL, 7, 22, 22)
      logoEndX = marginL + 25
    } catch {
      logoEndX = marginL
    }
  }

  // ── Company info in header ─────────────────────────────────────────────────
  doc.setTextColor(255, 255, 255)
  if (company?.name) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(company.name, logoEndX + 2, 13)
  }
  if (company?.address) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    const addrLines = doc.splitTextToSize(company.address, 80) as string[]
    doc.text(addrLines, logoEndX + 2, 19)
  }
  if (company?.phone || company?.npwp) {
    const infoLine = [company.phone, company.npwp ? `NPWP: ${company.npwp}` : ''].filter(Boolean).join('  |  ')
    doc.setFontSize(7.5)
    doc.text(infoLine, logoEndX + 2, 30)
  }

  // ── "Purchase Order" title ─────────────────────────────────────────────────
  doc.setFontSize(17)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Purchase Order', pageW / 2, 22, { align: 'center' })

  // ── Reference numbers ──────────────────────────────────────────────────────
  const refX = 130
  const refValX = pageW - marginR
  let refY = 10

  const addRef = (label: string, value: string) => {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(200, 200, 200)
    doc.text(label, refX, refY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(255, 255, 255)
    doc.text(value, refValX, refY, { align: 'right' })
    refY += 5
  }

  addRef('No.', po.po_number)
  addRef('Tanggal', formatDate(po.po_date))
  if (po.expected_date) addRef('Est. Terima', formatDate(po.expected_date))
  if (po.ref_invoice) addRef('Ref. Invoice', po.ref_invoice)

  // ── "Kepada Vendor" section ────────────────────────────────────────────────
  let y = headerH + 8
  doc.setTextColor(120, 113, 108)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Kepada Vendor:', marginL, y)
  y += 5

  doc.setTextColor(20, 20, 20)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(po.vendor_name, marginL, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  if (po.vendor_address) {
    const addrLines = doc.splitTextToSize(po.vendor_address, 100) as string[]
    doc.text(addrLines, marginL, y)
    y += addrLines.length * 4.5
  }
  if (po.vendor_npwp) {
    doc.setFont('helvetica', 'bold')
    doc.text(`NPWP : ${po.vendor_npwp}`, marginL, y)
    doc.setFont('helvetica', 'normal')
    y += 5
  }

  y += 4

  // ── Line items table ──────────────────────────────────────────────────────
  let mainNum = 0
  const bodyRows: (string | object)[][] = items.map((item) => {
    if (item.item_type === 'sub') {
      return [
        '',
        { content: `   ${item.sub_label || ''}.  ${item.description}`, styles: { textColor: [130, 120, 115], fontSize: 8 } },
        '',
        '',
        { content: '-', styles: { halign: 'right', textColor: [130, 120, 115] } },
      ]
    }
    mainNum++
    return [
      String(mainNum),
      item.description,
      String(item.quantity),
      'Qty',
      { content: formatRupiah(item.unit_price), styles: { halign: 'right' } },
      { content: formatRupiah(item.line_total), styles: { halign: 'right' } },
    ]
  })

  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR },
    head: [['No.', 'Deskripsi', 'Jumlah', 'Satuan', 'Harga Satuan', 'Total']],
    body: bodyRows as Parameters<typeof autoTable>[1]['body'],
    headStyles: {
      fillColor: primary,
      textColor: white,
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: { fontSize: 8.5, textColor: [28, 25, 23], minCellHeight: 7 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 34 },
      5: { halign: 'right', cellWidth: 34 },
    },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    tableLineColor: [220, 215, 210],
    tableLineWidth: 0.1,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalsX = pageW - marginR - 90
  const valX = pageW - marginR

  const addTotalRow = (label: string, value: string, bold = false, valueColor?: [number, number, number]) => {
    doc.setFontSize(9)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(bold ? 20 : 100, bold ? 20 : 92, bold ? 20 : 88)
    doc.text(label, totalsX, y)
    doc.setTextColor(...(valueColor ?? (bold ? [20, 20, 20] : [20, 20, 20])))
    doc.text(value, valX, y, { align: 'right' })
    y += 5
  }

  addTotalRow('Sub Total', formatRupiah(po.subtotal))
  if (po.tax_type === 'ppn') {
    addTotalRow('DPP (11/12)', formatRupiah(po.dpp))
    addTotalRow('PPN 12%', formatRupiah(po.tax_amount))
  } else if (po.tax_type === 'pph23') {
    addTotalRow('PPh 23 2%', `(${formatRupiah(po.tax_amount)})`, false, [180, 50, 50])
  }

  doc.setDrawColor(200, 195, 190)
  doc.line(totalsX, y - 2, valX, y - 2)
  y += 1
  addTotalRow('Total', formatRupiah(po.total), true)

  // ── Terbilang ─────────────────────────────────────────────────────────────
  y += 4
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 25, 20)
  doc.text(`Terbilang : ${terbilangRupiah(po.total)}`, marginL, y)
  y += 8

  // ── Keterangan Pembayaran ─────────────────────────────────────────────────
  if (company?.bank_name || company?.bank_account_number) {
    doc.setDrawColor(220, 215, 210)
    doc.line(marginL, y - 2, pageW - marginR, y - 2)
    y += 2

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 25, 20)
    doc.text('Keterangan Pembayaran', marginL, y)
    y += 5

    const payGap = 30
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 75, 70)
    if (company.bank_name) {
      doc.text('Bank', marginL, y)
      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'bold')
      doc.text(`: ${company.bank_name}`, marginL + payGap, y)
      doc.setFont('helvetica', 'normal')
      y += 5
    }
    if (company.bank_account_number) {
      doc.setTextColor(80, 75, 70)
      doc.text('No. Rekening', marginL, y)
      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'bold')
      doc.text(`: ${company.bank_account_number}`, marginL + payGap, y)
      doc.setFont('helvetica', 'normal')
      y += 5
    }
    if (company.bank_account_name) {
      doc.setTextColor(80, 75, 70)
      doc.text('Atas Nama', marginL, y)
      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'bold')
      doc.text(`: ${company.bank_account_name}`, marginL + payGap, y)
      doc.setFont('helvetica', 'normal')
      y += 5
    }
    y += 3
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (po.notes) {
    doc.setFontSize(7.5)
    doc.setTextColor(130, 120, 115)
    doc.setFont('helvetica', 'italic')
    const noteLines = doc.splitTextToSize(`*${po.notes}`, pageW - marginL * 2 - 80) as string[]
    doc.text(noteLines, marginL, y)
  }

  // ── Signature block ────────────────────────────────────────────────────────
  const sigY = Math.max(y + 4, pageH - 60)
  const sigX = pageW - marginR - 55

  if (company?.name) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(30, 25, 20)
    doc.text(company.name, sigX + 27, sigY, { align: 'center' })
  }

  doc.setDrawColor(150, 145, 140)
  doc.line(sigX, sigY + 18, sigX + 54, sigY + 18)

  if (company?.signed_by_name) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(30, 25, 20)
    doc.text(company.signed_by_name, sigX + 27, sigY + 22, { align: 'center' })
  }
  if (company?.signed_by_title) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 95, 90)
    doc.text(company.signed_by_title, sigX + 27, sigY + 27, { align: 'center' })
  }

  // ── Bottom decorative shapes ──────────────────────────────────────────────
  const botY = pageH - 18
  fillPoly(doc, [[0, botY + 18], [0, botY + 8], [50, botY + 18]], secondary)
  fillPoly(doc, [[pageW - 60, botY + 18], [pageW, botY + 4], [pageW, botY + 18]], accent)
  fillPoly(doc, [[pageW - 35, botY + 18], [pageW, botY + 10], [pageW, botY + 18]], primary)

  return doc
}
