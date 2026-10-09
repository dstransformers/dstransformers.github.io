import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import regularFontUrl from '@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff?url'
import semiboldFontUrl from '@fontsource/source-sans-3/files/source-sans-3-latin-600-normal.woff?url'
import boldFontUrl from '@fontsource/source-sans-3/files/source-sans-3-latin-700-normal.woff?url'
import currencyRegularFontUrl from '@fontsource/source-sans-3/files/source-sans-3-latin-ext-400-normal.woff?url'
import currencySemiboldFontUrl from '@fontsource/source-sans-3/files/source-sans-3-latin-ext-600-normal.woff?url'
import currencyBoldFontUrl from '@fontsource/source-sans-3/files/source-sans-3-latin-ext-700-normal.woff?url'
import letterheadUrl from '../../PhotoGallery/letterhead_template.pdf?url'

const A4 = { width: 595.28, height: 841.89 }
const LETTERHEAD = { width: 589.68, height: 835.92 }
const PAGE_MARGIN = 40
const CONTENT_TOP = 155
const CONTENT_BOTTOM = 798
const FONT_SIZES = [9.5, 9, 8.5, 8, 7.5]
const BLACK = rgb(0.08, 0.12, 0.18)
const NAVY = rgb(0.12, 0.23, 0.37)
const LIGHT_BLUE = rgb(0.94, 0.96, 0.98)
const BORDER = rgb(0.73, 0.78, 0.83)
const RUPEE = '₹'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

function escapeBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function fallbackCurrencyFont(font, fonts) {
  if (font === fonts.bold) return fonts.currencyBold
  if (font === fonts.semibold) return fonts.currencySemibold
  return fonts.currencyRegular
}

function measureText(text, font, currencyFont, size) {
  return String(text).split(RUPEE).reduce((width, part, index) => (
    width
      + font.widthOfTextAtSize(part, size)
      + (index < String(text).split(RUPEE).length - 1 ? currencyFont.widthOfTextAtSize(RUPEE, size) : 0)
  ), 0)
}

function textLines(text, font, size, maxWidth, currencyFont) {
  const lines = []
  let current = ''
  for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    if (measureText(candidate, font, currencyFont, size) <= maxWidth) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = ''
    for (const character of word) {
      const next = `${current}${character}`
      if (current && measureText(next, font, currencyFont, size) > maxWidth) {
        lines.push(current)
        current = character
      } else {
        current = next
      }
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function billTerms(quotation) {
  return String(quotation.terms || '').trim().split(/\r?\n/).filter(Boolean).length
    ? String(quotation.terms).trim().split(/\r?\n/)
    : [
      '1. This bill covers only the services and materials expressly listed above.',
      '2. Any work or materials outside the stated scope require prior written approval and may be charged separately.',
      '3. The customer shall provide safe access, required shutdowns, permits and site facilities for the agreed work.',
      '4. Warranty, if stated, applies only to the specified work and is subject to the agreed scope and exclusions.',
      '5. Any concern regarding this bill should be notified in writing within seven days of receipt.',
      '6. This document is subject to applicable laws and the jurisdiction agreed between the parties.',
    ]
}

function quotationTerms() {
  return [
    '1. This quotation is valid for 15 days from the date of issue.',
    '2. The scope of work shall be as specified in this quotation.',
    '3. Any additional work or materials required beyond the stated scope shall be quoted separately.',
    '4. Warranty, wherever applicable, shall be as specified for the respective work.',
    '5. Payment terms shall be as mutually agreed between the parties.',
  ]
}

function numberWords(value) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const scales = [[1e11, 'Kharab'], [1e9, 'Arab'], [1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']]
  const underThousand = amount => {
    const parts = []
    if (amount >= 100) {
      parts.push(`${ones[Math.floor(amount / 100)]} Hundred`)
      amount %= 100
    }
    if (amount >= 20) parts.push(`${tens[Math.floor(amount / 10)]}${amount % 10 ? ` ${ones[amount % 10]}` : ''}`)
    else if (amount >= 10) parts.push(teens[amount - 10])
    else if (amount > 0) parts.push(ones[amount])
    return parts.join(' ')
  }
  if (value === 0) return 'Zero'
  const parts = []
  let remaining = value
  for (const [divisor, label] of scales) {
    const group = Math.floor(remaining / divisor)
    if (group > 0) {
      parts.push(`${group < 1000 ? underThousand(group) : numberWords(group)} ${label}`)
      remaining %= divisor
    }
  }
  if (remaining > 0) parts.push(underThousand(remaining))
  return parts.join(' ')
}

function currencyWords(amount) {
  const paiseTotal = Math.round(Number(amount) * 100)
  const rupees = Math.floor(paiseTotal / 100)
  const paise = paiseTotal % 100
  return `Rupees ${numberWords(rupees)}${paise ? ` and ${numberWords(paise)} Paise` : ''} Only`
}

function serviceDescription(item) {
  const service = String(item.service || '')
  const description = String(item.description || service)
  return description === service ? service : `${service}: ${description}`
}

function displayDate(value) {
  if (!value) return ''
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-GB').format(date)
}

function layoutPage(quotation, rows, size, fonts) {
  const { regular, semibold, bold } = fonts
  const width = A4.width
  const contentWidth = width - PAGE_MARGIN * 2
  const isBill = quotation.documentType === 'BILL'
  const detailSize = size - 0.25
  const regularCurrency = fallbackCurrencyFont(regular, fonts)
  const semiboldCurrency = fallbackCurrencyFont(semibold, fonts)
  const boldCurrency = fallbackCurrencyFont(bold, fonts)
  const termsSize = Math.max(7, size - 1)
  const headingSize = size + 1
  const lineHeight = size * 1.28
  const infoLineHeight = detailSize * 1.25
  const serviceRows = rows.map(item => ({
    item,
    description: serviceDescription(item),
    amount: (isBill ? Number(item.quantity || 0) : 1) * Number(item.rate || 0),
  }))
  const subtotal = Math.round(serviceRows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100
  const gstApplicable = isBill && Boolean(quotation.gstApplicable)
  const gstRate = gstApplicable ? Number(quotation.gstRate || 19) : 0
  const gstAmount = gstApplicable ? Math.round(subtotal * gstRate) / 100 : 0
  const grandTotal = Math.round((subtotal + gstAmount) * 100) / 100
  let cursor = CONTENT_TOP
  const operations = []
  const pushText = (text, x, top, font, fontSize, maxWidth, align = 'left') => {
    const currencyFont = fallbackCurrencyFont(font, fonts)
    const lines = textLines(text, font, fontSize, maxWidth, currencyFont)
    operations.push({ type: 'text', lines, x, top, font, currencyFont, fontSize, maxWidth, align })
    return lines.length * fontSize * 1.22
  }
  const pushRect = (x, top, rectWidth, height, fill = null, stroke = BORDER) => {
    operations.push({ type: 'rect', x, top, width: rectWidth, height, fill, stroke })
  }
  const pushVerticalLine = (x, top, bottom, thickness = 0.6, color = BORDER) => {
    operations.push({ type: 'vline', x, top, bottom, thickness, color })
  }

  const documentTitle = isBill ? 'SERVICE BILL' : 'QUOTATION'
  pushText(documentTitle, PAGE_MARGIN, cursor, bold, headingSize + 4, contentWidth, 'center')
  cursor += (headingSize + 4) * 1.5
  pushText(
    `${isBill ? 'Bill' : 'Quotation'} No.: ${quotation.quotationNo}     Date: ${displayDate(quotation.quotationDate)}`,
    PAGE_MARGIN,
    cursor,
    semibold,
    detailSize,
    contentWidth,
    'center',
  )
  cursor += detailSize * 1.7
  const subject = `${isBill ? 'Bill' : 'Quotation'} for ${quotation.transformerCapacity || ''} Transformer${quotation.transformerMake ? ` - ${quotation.transformerMake}` : ''}`
  pushText(subject, PAGE_MARGIN, cursor, semibold, detailSize + 0.25, contentWidth)
  cursor += infoLineHeight + 4

  const gap = 10
  const panelWidth = (contentWidth - gap) / 2
  const detailCards = [
    {
      title: 'CUSTOMER DETAILS',
      entries: [
        ['Name', quotation.customerName],
        ['Address', quotation.customerAddress],
        ['Contact', quotation.contactPerson],
        ['Mobile', quotation.mobile],
        ['Email', quotation.email],
      ],
    },
    {
      title: 'TRANSFORMER DETAILS',
      entries: [
        ['Make', quotation.transformerMake],
        ['Capacity', quotation.transformerCapacity],
        ['Serial No.', quotation.transformerSerialNo],
        ['Location', quotation.transformerLocation],
      ],
    },
  ]
  const cardLayouts = detailCards.map((card, index) => {
    const x = PAGE_MARGIN + index * (panelWidth + gap)
    let cardCursor = cursor + 6
    let textHeight = 0
    for (const [label, value] of card.entries) {
      const lines = textLines(`${label}: ${value || '—'}`, regular, detailSize, panelWidth - 14, regularCurrency)
      textHeight += lines.length * infoLineHeight + 2
    }
    const height = Math.max(62, 21 + textHeight)
    return { card, x, height }
  })
  const cardHeight = Math.max(...cardLayouts.map(card => card.height))
  for (const { card, x } of cardLayouts) {
    pushRect(x, cursor, panelWidth, cardHeight, LIGHT_BLUE)
    pushText(card.title, x + 7, cursor + 6, bold, Math.max(7, size - 0.5), panelWidth - 14)
    let textTop = cursor + 19
    for (const [label, value] of card.entries) {
      const text = `${label}: ${value || '—'}`
      const lines = textLines(text, regular, detailSize, panelWidth - 14, regularCurrency)
      operations.push({ type: 'text', lines, x: x + 7, top: textTop, font: regular, currencyFont: regularCurrency, fontSize: detailSize, maxWidth: panelWidth - 14, align: 'left' })
      textTop += lines.length * infoLineHeight + 2
    }
  }
  cursor += cardHeight + 8
  pushText(isBill ? 'SERVICE DETAILS' : 'SERVICES / RATES', PAGE_MARGIN, cursor, bold, headingSize, contentWidth)
  cursor += headingSize * 1.45

  const columns = isBill
    ? [
      { key: 'number', title: '#', width: 24, align: 'center' },
      { key: 'description', title: 'Description of Work / Service', width: 215, align: 'left' },
      { key: 'quantity', title: 'Qty', width: 34, align: 'center' },
      { key: 'unit', title: 'Unit', width: 43, align: 'center' },
      { key: 'rate', title: 'Rate (₹)', width: 82, align: 'right' },
      { key: 'amount', title: 'Amount (₹)', width: contentWidth - 398, align: 'right' },
    ]
    : [
      { key: 'number', title: '#', width: 26, align: 'center' },
      { key: 'description', title: 'Description of Work / Service', width: contentWidth - 146, align: 'left' },
      { key: 'rate', title: 'Rate (₹)', width: 120, align: 'right' },
    ]
  const tableX = PAGE_MARGIN
  const tableTop = cursor
  const tableHeaderHeight = lineHeight + 7
  pushRect(tableX, cursor, contentWidth, tableHeaderHeight, LIGHT_BLUE)
  let columnX = tableX
  columns.forEach(column => {
    pushText(column.title, columnX + 3, cursor + 4, bold, size, column.width - 6, column.align)
    columnX += column.width
  })
  cursor += tableHeaderHeight

  const rowLayouts = []
  serviceRows.forEach((row, index) => {
    const values = isBill
      ? [
        String(index + 1),
        row.description,
        String(Number(row.item.quantity || 0)),
        String(row.item.unit || 'unit'),
        `₹${Number(row.item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `₹${row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ]
      : [
        String(index + 1),
        row.description,
        `₹${Number(row.item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ]
    const cells = values.map((value, columnIndex) => {
      const column = columns[columnIndex]
      return {
        column,
        lines: textLines(value, regular, size, column.width - 6, regularCurrency),
        value,
      }
    })
    const rowHeight = Math.max(20, ...cells.map(cell => cell.lines.length * lineHeight + 7))
    rowLayouts.push({ cells, rowHeight })
  })

  const terms = isBill ? billTerms(quotation) : quotationTerms()
  const termsLines = terms.flatMap(term => textLines(term, regular, termsSize, contentWidth - 12, regularCurrency).map((line, index) => index === 0 ? line : `  ${line}`))
  const termsHeight = 18 + termsLines.length * (termsSize * 1.2)
  const warrantyText = isBill && quotation.warrantyMonths
    ? `Warranty valid for ${quotation.warrantyMonths} months from completion / commissioning, limited to the specified work.`
    : 'Warranty, wherever applicable, will be as specified for the respective work.'
  const warrantyLines = textLines(warrantyText, regular, termsSize, contentWidth - 12, regularCurrency)
  const warrantyHeight = 17 + warrantyLines.length * (termsSize * 1.2)
  const signatoryHeight = 38
  const totalsHeight = isBill ? 58 : 0
  const finalContentHeight = totalsHeight + warrantyHeight + termsHeight + signatoryHeight + 24
  const rowHeightTotal = rowLayouts.reduce((sum, row) => sum + row.rowHeight, 0)
  const usedHeight = cursor + rowHeightTotal + finalContentHeight
  if (usedHeight > CONTENT_BOTTOM || rows.length === 0) {
    return { fits: usedHeight <= CONTENT_BOTTOM && rows.length > 0, usedHeight, size, rows }
  }

  let rowTop = cursor
  rowLayouts.forEach(({ cells, rowHeight }) => {
    pushRect(tableX, rowTop, contentWidth, rowHeight, null)
    let cellX = tableX
    cells.forEach(({ column, lines, value }) => {
      const font = column.key === 'description' ? regular : regular
      const textWidth = column.width - 6
      const currencyFont = fallbackCurrencyFont(font, fonts)
      const lineContentWidth = Math.min(textWidth, Math.max(...lines.map(line => measureText(line, font, currencyFont, size)), 1))
      const textX = column.align === 'center'
        ? cellX + column.width / 2 - lineContentWidth / 2
        : column.align === 'right'
          ? cellX + column.width - 3 - lineContentWidth
          : cellX + 3
      operations.push({
        type: 'text',
        lines,
        x: textX,
        top: rowTop + 3,
        font,
        currencyFont,
        fontSize: size,
        maxWidth: textWidth,
        align: 'left',
      })
      cellX += column.width
    })
    rowTop += rowHeight
  })
  let dividerX = tableX
  columns.slice(0, -1).forEach(column => {
    dividerX += column.width
    pushVerticalLine(dividerX, tableTop, rowTop)
  })
  cursor = rowTop + 6

  if (isBill) {
    pushRect(PAGE_MARGIN, cursor, contentWidth, totalsHeight, LIGHT_BLUE)
    const currency = amount => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    const totalRows = [
      `Subtotal: ${currency(subtotal)}`,
      ...(gstApplicable ? [`GST (${gstRate}%): ${currency(gstAmount)}`] : []),
      `TOTAL AMOUNT: ${currency(grandTotal)}`,
      `Amount in words: ${currencyWords(grandTotal)}`,
    ]
    const totalLineHeight = Math.max(size * 1.2, 10)
    totalRows.forEach((line, index) => {
      const strong = line.startsWith('TOTAL ')
      pushText(line, PAGE_MARGIN + 8, cursor + 5 + index * totalLineHeight, strong ? bold : regular, strong ? size + 0.25 : size, contentWidth - 16, 'right')
    })
    cursor += totalsHeight + 5
  }

  pushText('WARRANTY', PAGE_MARGIN, cursor, bold, termsSize + 0.5, contentWidth)
  cursor += termsSize * 1.45
  warrantyLines.forEach(line => {
    pushText(line, PAGE_MARGIN, cursor, regular, termsSize, contentWidth)
    cursor += termsSize * 1.2
  })
  cursor += 3
  pushText('TERMS & CONDITIONS', PAGE_MARGIN, cursor, bold, termsSize + 0.5, contentWidth)
  cursor += termsSize * 1.45
  termsLines.forEach(line => {
    pushText(line, PAGE_MARGIN, cursor, regular, termsSize, contentWidth)
    cursor += termsSize * 1.2
  })
  cursor += 4
  pushText('Digitally Authorized Signatory', PAGE_MARGIN, cursor, bold, size, contentWidth, 'right')
  cursor += size * 1.35
  pushText('M/s D.S. Transformers & Electrical Contractor', PAGE_MARGIN, cursor, semibold, size, contentWidth, 'right')

  return {
    fits: cursor + size * 1.4 <= CONTENT_BOTTOM,
    usedHeight,
    size,
    rows,
    operations,
    subtotal,
    gstAmount,
    grandTotal,
  }
}

function createDocumentPages(quotation, forcedSplit) {
  const items = quotation.lineItems || []
  if (items.length === 0) throw new Error('Add at least one service before generating the document.')

  for (const size of FONT_SIZES) {
    const fullPage = layoutPage(quotation, items, size, quotation._fonts)
    if (fullPage.fits && !forcedSplit) return [{ ...quotation, _layout: fullPage }]
    if (items.length < 2) continue
    let bestSplit = null
    for (let splitIndex = 1; splitIndex < items.length; splitIndex += 1) {
      const first = layoutPage(quotation, items.slice(0, splitIndex), size, quotation._fonts)
      if (!first.fits) continue
      const second = layoutPage(quotation, items.slice(splitIndex), size, quotation._fonts)
      if (!second.fits) continue
      const balance = Math.abs(first.usedHeight - second.usedHeight)
      if (!bestSplit || balance < bestSplit.balance) {
        bestSplit = { balance, pages: [first, second] }
      }
    }
    if (bestSplit) {
      return bestSplit.pages.map((layout, index) => ({
        ...quotation,
        lineItems: items.slice(index === 0 ? 0 : bestSplit.pages[0].rows.length, index === 0 ? bestSplit.pages[0].rows.length : items.length),
        _layout: layout,
        _groupPosition: index + 1,
      }))
    }
  }
  throw new Error('The document cannot fit in the maximum two-page layout without clipping. Shorten an individual service description or the bill terms.')
}

async function loadFonts(document) {
  document.registerFontkit(fontkit)
  const fetchFont = async url => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Unable to load quotation font (${response.status}).`)
    return new Uint8Array(await response.arrayBuffer())
  }
  const [regularBytes, semiboldBytes, boldBytes] = await Promise.all([
    fetchFont(regularFontUrl),
    fetchFont(semiboldFontUrl),
    fetchFont(boldFontUrl),
  ])
  const [currencyRegularBytes, currencySemiboldBytes, currencyBoldBytes] = await Promise.all([
    fetchFont(currencyRegularFontUrl),
    fetchFont(currencySemiboldFontUrl),
    fetchFont(currencyBoldFontUrl),
  ])
  const [regular, semibold, bold, currencyRegular, currencySemibold, currencyBold] = await Promise.all([
    document.embedFont(regularBytes, { subset: true }),
    document.embedFont(semiboldBytes, { subset: true }),
    document.embedFont(boldBytes, { subset: true }),
    document.embedFont(currencyRegularBytes, { subset: true }),
    document.embedFont(currencySemiboldBytes, { subset: true }),
    document.embedFont(currencyBoldBytes, { subset: true }),
  ])
  return { regular, semibold, bold, currencyRegular, currencySemibold, currencyBold }
}

function drawTextWithCurrencyFallback(page, line, x, y, font, currencyFont, size) {
  const parts = String(line).split(RUPEE)
  let nextX = x
  parts.forEach((part, index) => {
    if (part) {
      page.drawText(part, { x: nextX, y, font, size, color: BLACK })
      nextX += font.widthOfTextAtSize(part, size)
    }
    if (index < parts.length - 1) {
      page.drawText(RUPEE, { x: nextX, y, font: currencyFont, size, color: BLACK })
      nextX += currencyFont.widthOfTextAtSize(RUPEE, size)
    }
  })
}

function drawPageOperations(page, operations) {
  for (const operation of operations) {
    if (operation.type === 'rect') {
      page.drawRectangle({
        x: operation.x,
        y: A4.height - operation.top - operation.height,
        width: operation.width,
        height: operation.height,
        color: operation.fill || rgb(1, 1, 1),
        borderColor: operation.stroke,
        borderWidth: 0.5,
      })
    } else if (operation.type === 'line') {
      page.drawLine({
        start: { x: operation.x1, y: A4.height - operation.top },
        end: { x: operation.x2, y: A4.height - operation.top },
        thickness: operation.thickness,
        color: operation.color,
      })
    } else if (operation.type === 'vline') {
      page.drawLine({
        start: { x: operation.x, y: A4.height - operation.top },
        end: { x: operation.x, y: A4.height - operation.bottom },
        thickness: operation.thickness,
        color: operation.color,
      })
    } else if (operation.type === 'text') {
      operation.lines.forEach((line, index) => {
        const textWidth = measureText(line, operation.font, operation.currencyFont, operation.fontSize)
        const x = operation.align === 'center'
          ? operation.x + (operation.maxWidth - textWidth) / 2
          : operation.align === 'right'
            ? operation.x + operation.maxWidth - textWidth
            : operation.x
        drawTextWithCurrencyFallback(
          page,
          line,
          x,
          A4.height - operation.top - operation.fontSize - index * operation.fontSize * 1.22,
          operation.font,
          operation.currencyFont,
          operation.fontSize,
        )
      })
    }
  }
}

async function rasterizeSinglePage(pdfBytes) {
  const pdfDocument = await pdfjs.getDocument({ data: pdfBytes }).promise
  if (pdfDocument.numPages !== 1) throw new Error('A PNG output can contain one page only.')
  const page = await pdfDocument.getPage(1)
  const viewport = page.getViewport({ scale: 300 / 72 })
  const canvas = globalThis.document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Unable to create the high-resolution quotation PNG canvas.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: context, viewport }).promise
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('Unable to encode the quotation PNG.')), 'image/png')
  })
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Unable to read the generated quotation PNG.'))
    reader.readAsDataURL(blob)
  })
  canvas.width = 0
  canvas.height = 0
  return dataUrl
}

export async function generateQuotationOutput({
  quotation,
  pages,
  templateUrl = letterheadUrl,
  requestedFormat = quotation.outputFormat || 'PDF',
}) {
  const sourceUrl = templateUrl
  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error(`Unable to load the quotation letterhead (${response.status}).`)
  const templateBytes = await response.arrayBuffer()
  const sourcePdf = await PDFDocument.load(templateBytes)
  if (sourcePdf.getPageCount() !== 1) throw new Error('The quotation letterhead template must contain exactly one page.')
  const sourcePage = sourcePdf.getPage(0)
  if (Math.abs(sourcePage.getWidth() - LETTERHEAD.width) > 1 || Math.abs(sourcePage.getHeight() - LETTERHEAD.height) > 1) {
    throw new Error('The quotation letterhead page dimensions changed; review the PDF layout before generating documents.')
  }

  const document = await PDFDocument.create()
  const [letterhead] = await document.embedPdf(templateBytes, [0])
  const fonts = await loadFonts(document)
  const layoutQuotation = { ...quotation, _fonts: fonts }
  const splitPages = pages || createDocumentPages(layoutQuotation, false)
  if (splitPages.length < 1 || splitPages.length > 2) {
    throw new Error('A quotation or bill must contain one document or a linked two-document group.')
  }
  const documentNumbers = new Set()
  const preparedPages = splitPages.map((part, index) => {
    const quotationNo = String(part.quotationNo || quotation.quotationNo || '').trim()
    if (!quotationNo) throw new Error(`Document ${index + 1} is missing its reserved number.`)
    if (documentNumbers.has(quotationNo)) {
      throw new Error('Each document in an overflow group must have a different number.')
    }
    documentNumbers.add(quotationNo)
    const pageQuotation = { ...layoutQuotation, ...part, quotationNo, _fonts: fonts }
    const documentPage = document.addPage([A4.width, A4.height])
    documentPage.drawPage(letterhead, {
      x: (A4.width - LETTERHEAD.width) / 2,
      y: (A4.height - LETTERHEAD.height) / 2,
      width: LETTERHEAD.width,
      height: LETTERHEAD.height,
    })
    const layout = layoutPage(
      pageQuotation,
      part.lineItems,
      part.layoutSize || FONT_SIZES[0],
      fonts,
    )
    if (!layout.fits) throw new Error('A quotation page does not fit the letterhead layout.')
    drawPageOperations(documentPage, layout.operations)
    return {
      ...part,
      quotationNo,
      _layout: layout,
      subtotal: layout.subtotal,
      gstAmount: layout.gstAmount,
      grandTotal: layout.grandTotal,
    }
  })
  const pdfBytes = await document.save()
  const isOverflow = preparedPages.length > 1
  const format = isOverflow ? 'PDF' : String(requestedFormat).toUpperCase()
  if (format !== 'PDF' && format !== 'PNG') throw new Error('Choose PDF or PNG as the quotation output format.')
  const fileName = `${String(quotation.quotationNo || 'DOCUMENT').replace(/[^A-Za-z0-9_-]/g, '_')}.${format.toLowerCase()}`
  const dataUrl = format === 'PNG'
    ? await rasterizeSinglePage(pdfBytes)
    : `data:application/pdf;base64,${escapeBase64(pdfBytes)}`
  return {
    dataUrl,
    fileName,
    format,
    pages: preparedPages.map(({ _layout, _fonts, ...part }) => part),
    overflowed: isOverflow,
  }
}

export async function planQuotationPages(quotation, forceTwoPages = false, existingNumbers = []) {
  const measurementDocument = await PDFDocument.create()
  const fonts = await loadFonts(measurementDocument)
  const pages = createDocumentPages({ ...quotation, _fonts: fonts }, forceTwoPages)
  return pages.map((page, index) => ({
    ...quotation,
    lineItems: page.lineItems,
    quotationNo: existingNumbers[index] || '',
    groupPosition: index + 1,
    groupCount: pages.length,
    layoutSize: page._layout.size,
  }))
}
