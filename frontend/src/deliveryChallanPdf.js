import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const A4 = { width: 595, height: 842 }
const ROW_START_Y = 527
const ROW_BOTTOM_Y = 110
const ROW_LIMIT = ROW_START_Y - ROW_BOTTOM_Y - 52
const DESCRIPTION_WIDTH = 326
const REFERENCES_WIDTH = 96
const NAVY = rgb(0.08, 0.2, 0.39)
const ROW_FILL = rgb(0.94, 0.97, 1)
const ROW_LINE = rgb(0.42, 0.54, 0.69)

function wrapPdfText(text, font, fontSize, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      line = candidate
      continue
    }

    if (line) lines.push(line)
    line = ''
    for (const character of word) {
      const next = `${line}${character}`
      if (line && font.widthOfTextAtSize(next, fontSize) > maxWidth) {
        lines.push(line)
        line = character
      } else {
        line = next
      }
    }
  }

  if (line) lines.push(line)
  return lines.length ? lines : ['—']
}

function encodeBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('en-GB').format(date)
}

function textLines(value, font, size, width, maximum, fieldName) {
  const lines = wrapPdfText(value || '—', font, size, width)
  if (lines.length > maximum) {
    throw new Error(`${fieldName} is too long to fit in the delivery challan header. Shorten it before generating the PDF.`)
  }
  return lines
}

function transformerRow(transformer, index, regularFont, dateLabel) {
  const transformerName = String(transformer.transformerName || '').replace(/\s*·\s*/g, ' | ')
  const details = [
    transformer.dtrNo && `DTR No. ${transformer.dtrNo}`,
    transformer.sNo && `Serial No. ${transformer.sNo}`,
    transformer.capacity && `${transformer.capacity} kVA`,
    transformer.type,
    transformer.spmCenter && `SPM Center: ${transformer.spmCenter}`,
    transformer.oilCapacity !== undefined && transformer.oilCapacity !== null && transformer.oilCapacity !== ''
      ? `Oil: ${transformer.oilCapacity} L`
      : '',
    String(transformer.intakeType || '').toUpperCase() === 'RGP' ? 'RGP Return' : '',
  ].filter(Boolean)
  const description = details.length > 0
    ? details.join(' | ')
    : transformerName || `Transformer ${transformer.transformerId || index + 1}`
  const references = (Array.isArray(transformer.tNotes) ? transformer.tNotes : [])
    .map(note => `${note.tNoteNo || ''}${note.date ? ` / ${dateLabel(note.date)}` : ''}`.trim())
    .filter(Boolean)
    .join('; ') || '—'
  const descriptionLines = wrapPdfText(description, regularFont, 9.5, DESCRIPTION_WIDTH)
  const referenceLines = wrapPdfText(references, regularFont, 9, REFERENCES_WIDTH)
  const rowHeight = Math.max(36, descriptionLines.length * 12 + 10, referenceLines.length * 11.5 + 10)

  if (rowHeight > ROW_LIMIT) {
    throw new Error(`Transformer ${transformer.dtrNo || transformer.sNo || index + 1} has too much detail to fit on an A4 delivery challan. Shorten its details or T-note references.`)
  }
  return { descriptionLines, referenceLines, rowHeight }
}

function drawText(page, text, x, y, font, size, maxWidth, align = 'left', lineHeight = size * 1.3) {
  const lines = wrapPdfText(text, font, size, maxWidth)
  lines.forEach((line, index) => page.drawText(line, {
    x: align === 'center'
      ? x - font.widthOfTextAtSize(line, size) / 2
      : align === 'right'
        ? x - font.widthOfTextAtSize(line, size)
        : x,
    y: y - index * lineHeight,
    font,
    size,
    color: NAVY,
  }))
  return lines
}

function paginateRows(rows) {
  const pages = []
  let pageRows = []
  let usedHeight = 0

  rows.forEach(row => {
    if (pageRows.length > 0 && usedHeight + row.rowHeight > ROW_LIMIT) {
      pages.push(pageRows)
      pageRows = []
      usedHeight = 0
    }
    pageRows.push(row)
    usedHeight += row.rowHeight
  })

  if (pageRows.length > 0 || pages.length === 0) pages.push(pageRows)
  return pages
}

export async function generateDeliveryChallanPdf(dc, templateUrl) {
  const templateResponse = await fetch(templateUrl)
  if (!templateResponse.ok) {
    throw new Error(`Unable to load the delivery challan template (${templateResponse.status}).`)
  }
  const templateBytes = await templateResponse.arrayBuffer()
  const templatePdf = await PDFDocument.load(templateBytes)
  if (templatePdf.getPageCount() !== 1) {
    throw new Error('The delivery challan template must contain exactly one A4 page.')
  }
  const templatePage = templatePdf.getPage(0)
  if (Math.abs(templatePage.getWidth() - A4.width) > 1 || Math.abs(templatePage.getHeight() - A4.height) > 1) {
    throw new Error('The delivery challan template must be A4 portrait size.')
  }

  const document = await PDFDocument.create()
  const [background] = await document.embedPdf(templateBytes, [0])
  const regularFont = await document.embedFont(StandardFonts.Helvetica)
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold)
  const transformers = Array.isArray(dc.transformerDetails) ? dc.transformerDetails : []
  const dateLabel = formatDate
  const rows = transformers.map((transformer, index) => transformerRow(transformer, index, regularFont, dateLabel))
  const pages = paginateRows(rows)
  const customerName = textLines(dc.customerName, boldFont, 9.5, 317, 2, 'Customer name')
  const customerAddress = textLines(dc.customerAddress, regularFont, 9, 296, 3, 'Customer address')
  const customerGstin = textLines(dc.customerGstin, boldFont, 9, 270, 1, 'Customer GSTIN')
  const challanNumber = textLines(dc.dcNo, boldFont, 9, 65, 1, 'Delivery challan number')
  const challanDate = textLines(dateLabel(dc.date), boldFont, 9, 62, 1, 'Delivery challan date')

  let transformerNumber = 0
  pages.forEach((pageRows, pageIndex) => {
    const page = document.addPage([A4.width, A4.height])
    page.drawPage(background, { x: 0, y: 0, width: A4.width, height: A4.height })
    drawText(page, customerName.join(' '), 52, 676, boldFont, 9.5, 317)
    drawText(page, customerAddress.join(' '), 70, 649, regularFont, 9, 296, 'left', 11.5)
    drawText(page, customerGstin.join(' '), 105, 587, boldFont, 9, 270)
    drawText(page, challanNumber.join(' '), 423, 658, boldFont, 9, 65)
    drawText(page, challanDate.join(' '), 520, 658, boldFont, 9, 62)

    if (dc.companyGstin) {
      page.drawRectangle({ x: 365, y: 684, width: 220, height: 20, color: rgb(1, 1, 1) })
      drawText(page, `GSTIN: ${dc.companyGstin}`, 370, 691, boldFont, 8, 210)
    }

    let rowOffset = 0
    pageRows.forEach((row, rowIndex) => {
      const rowTop = ROW_START_Y - rowOffset
      const rowBottom = rowTop - row.rowHeight
      if (rowIndex % 2 === 1) {
        page.drawRectangle({
          x: 16,
          y: rowBottom,
          width: A4.width - 32,
          height: row.rowHeight,
          color: ROW_FILL,
          opacity: 0.45,
        })
      }
      page.drawLine({
        start: { x: 16, y: rowBottom },
        end: { x: A4.width - 16, y: rowBottom },
        thickness: 0.45,
        color: ROW_LINE,
        opacity: 0.7,
      })
      transformerNumber += 1
      drawText(page, transformerNumber, 29, rowTop - 12, boldFont, 9, 22, 'center')
      row.descriptionLines.forEach((line, lineIndex) => {
        page.drawText(line, { x: 44, y: rowTop - 12 - lineIndex * 12, font: regularFont, size: 9.5, color: NAVY })
      })
      drawText(page, '1', 430, rowTop - 12, boldFont, 9, 46, 'center')
      row.referenceLines.forEach((line, lineIndex) => {
        page.drawText(line, { x: 482, y: rowTop - 12 - lineIndex * 11.5, font: regularFont, size: 9, color: NAVY })
      })
      rowOffset += row.rowHeight
    })

    if (pageIndex === pages.length - 1) {
      const totalY = ROW_START_Y - rowOffset - 19
      drawText(page, `TOTAL NO. OF TRANSFORMERS: ${dc.totalTransformers || transformers.length}`, 44, totalY, boldFont, 9.5, 370)
      drawText(page, 'EMPTY OIL DRUMS RETURNED', 44, totalY - 20, boldFont, 9.5, 320)
      const emptyDrumTotal = String(dc.emptyDrumsAvailable ? Number(dc.emptyDrumCount || 0) : 0)
      drawText(page, emptyDrumTotal, 430, totalY - 20, regularFont, 9.5, 46, 'center')
    }
  })

  const pdfBytes = await document.save()
  const fileName = `${String(dc.dcNo || 'Delivery-Challan').replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`
  return {
    fileName,
    dataUrl: `data:application/pdf;base64,${encodeBase64(pdfBytes)}`,
  }
}
