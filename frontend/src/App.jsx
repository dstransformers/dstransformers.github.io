import { Fragment, useEffect, useState, useSyncExternalStore } from 'react'
import LandingPage from './LandingPage'
import { signOut } from 'firebase/auth'
import { auth, getAuthSnapshot, subscribeToAuth } from './firebase'
import { apiFetch } from './api'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import ExcelJS from 'exceljs'
import deliveryChallanTemplateUrl from '../../PhotoGallery/delivery_challan_template.pdf?url'
import { generateQuotationOutput, planQuotationPages } from './quotationPdf'
import './App.css'

const STATUS_ORDER = [
  'Recieved',
  'Assesment',
  'Repair In Progress',
  'Repaired',
  'Delivered',
  'Billed',
]

const MAX_ATTACHMENTS = 5
const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024
const ATTACHMENT_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.bmp,.heic,.heif,.avif,.pdf'
const DELIVERY_CHALLAN_TRANSFORMERS_PER_PAGE = 9

function wrapPdfText(text, font, fontSize, maxWidth, maxLines = 2) {
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
    line = word
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const lastLine = lines[maxLines - 1]
    let truncated = lastLine
    while (truncated && font.widthOfTextAtSize(`${truncated}...`, fontSize) > maxWidth) {
      truncated = truncated.slice(0, -1)
    }
    lines.length = maxLines
    lines[maxLines - 1] = `${truncated.trimEnd()}...`
  }
  return lines
}

function encodeBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

async function generateDeliveryChallanPdf(dc, templateUrl) {
  const templateResponse = await fetch(templateUrl)
  if (!templateResponse.ok) throw new Error(`Unable to load the delivery challan template (${templateResponse.status}).`)
  const templateBytes = await templateResponse.arrayBuffer()
  const templatePdf = await PDFDocument.load(templateBytes)
  const document = await PDFDocument.create()
  const templatePages = await document.embedPdf(templateBytes, [0])
  const regularFont = await document.embedFont(StandardFonts.Helvetica)
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold)
  const transformers = Array.isArray(dc.transformerDetails) ? dc.transformerDetails : []
  const pages = []
  for (let index = 0; index < transformers.length; index += DELIVERY_CHALLAN_TRANSFORMERS_PER_PAGE) {
    pages.push(transformers.slice(index, index + DELIVERY_CHALLAN_TRANSFORMERS_PER_PAGE))
  }
  if (pages.length === 0) pages.push([])

  const dateLabel = value => {
    if (!value) return ''
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
    return Number.isNaN(date.getTime())
      ? String(value)
      : new Intl.DateTimeFormat('en-GB').format(date)
  }
  const drawText = (page, text, x, y, font, size, maxWidth, maxLines = 2) => {
    const lines = wrapPdfText(text, font, size, maxWidth, maxLines)
    lines.forEach((line, index) => page.drawText(line, {
      x,
      y: y - index * (size + 2),
      font,
      size,
      color: rgb(0, 0, 0),
    }))
  }

  pages.forEach((pageTransformers, pageIndex) => {
    const page = document.addPage([templatePdf.getPage(0).getWidth(), templatePdf.getPage(0).getHeight()])
    const background = templatePages[0]
    page.drawPage(background, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })

    drawText(page, dc.customerName, 52, 676, boldFont, 9, 317, 1)
    drawText(page, dc.customerAddress, 70, 649, boldFont, 8.5, 296, 2)
    drawText(page, dc.customerGstin, 105, 587, boldFont, 8.5, 270, 1)
    drawText(page, dc.dcNo, 423, 658, boldFont, 8.5, 65, 1)
    drawText(page, dateLabel(dc.date), 520, 658, boldFont, 8.5, 62, 1)

    pageTransformers.forEach((transformer, rowIndex) => {
      const rowY = 527 - rowIndex * 34
      const transformerName = String(transformer.transformerName || '').replace(/\s*·\s*/g, ' | ')
      const description = transformerName || [
        transformer.dtrNo && `DTR No: ${transformer.dtrNo}`,
        transformer.sNo && `Serial No: ${transformer.sNo}`,
        transformer.capacity && `${transformer.capacity} kVA`,
        transformer.type,
      ].filter(Boolean).join(' | ')
      const references = (Array.isArray(transformer.tNotes) ? transformer.tNotes : [])
        .map(note => `${note.tNoteNo || ''}${note.date ? ` / ${dateLabel(note.date)}` : ''}`.trim())
        .filter(Boolean)
      drawText(page, rowIndex + 1 + pageIndex * DELIVERY_CHALLAN_TRANSFORMERS_PER_PAGE, 18, rowY, boldFont, 8.5, 22, 1)
      drawText(page, description, 44, rowY, boldFont, 9, 326, 2)
      drawText(
        page,
        '1',
        430 - boldFont.widthOfTextAtSize('1', 9) / 2,
        rowY,
        boldFont,
        9,
        46,
        1,
      )
      drawText(page, references.join('; ') || '-', 482, rowY, boldFont, 8, 96, 3)
    })

    const totalY = 527 - pageTransformers.length * 34 - 12
    page.drawText('TOTAL NO. OF TRANSFORMERS', {
      x: 44, y: totalY, font: boldFont, size: 9, color: rgb(0, 0, 0),
    })
    const transformerTotal = String(pageTransformers.length)
    page.drawText(String(pageTransformers.length), {
      x: 430 - boldFont.widthOfTextAtSize(transformerTotal, 9) / 2,
      y: totalY, font: boldFont, size: 9, color: rgb(0, 0, 0),
    })

    if (pageIndex === pages.length - 1) {
      page.drawText('EMPTY OIL DRUMS RETURNED', {
        x: 44, y: totalY - 22, font: boldFont, size: 9, color: rgb(0, 0, 0),
      })
      const emptyDrumTotal = String(dc.emptyDrumsAvailable ? Number(dc.emptyDrumCount || 0) : 0)
      page.drawText(emptyDrumTotal, {
        x: 430 - regularFont.widthOfTextAtSize(emptyDrumTotal, 9) / 2,
        y: totalY - 22, font: regularFont, size: 9, color: rgb(0, 0, 0),
      })
    }
  })

  const pdfBytes = await document.save()
  const fileName = `${String(dc.dcNo || 'Delivery-Challan').replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`
  return {
    fileName,
    dataUrl: `data:application/pdf;base64,${encodeBase64(pdfBytes)}`,
  }
}

function AttachmentUploadField({ id, attachments, onChange, onUploadingChange, label = 'Attachments (photos or PDFs)', disabled = false, maxAttachments = MAX_ATTACHMENTS }) {
  const [error, setError] = useState('')

  const handleSelection = async (event) => {
    const input = event.currentTarget
    const files = Array.from(input.files || [])
    input.value = ''
    setError('')

    if (attachments.length + files.length > maxAttachments) {
      setError(`Select no more than ${maxAttachments} attachments.`)
      return
    }

    const invalidFile = files.find((file) =>
      file.size > MAX_ATTACHMENT_SIZE ||
      (file.type !== 'application/pdf' && !/^image\/(jpeg|png|gif|webp|bmp|heic|heif|avif)$/i.test(file.type))
    )
    if (invalidFile) {
      setError(invalidFile.size > MAX_ATTACHMENT_SIZE
        ? `${invalidFile.name} is larger than 2 MB.`
        : `${invalidFile.name} is not a supported photo or PDF.`)
      return
    }

    onUploadingChange(true)
    try {
      const selectedAttachments = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result,
        })
        reader.onerror = () => reject(new Error(`Unable to read ${file.name}. Please select it again.`))
        reader.readAsDataURL(file)
      })))
      onChange([...attachments, ...selectedAttachments])
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'Unable to read the selected attachments.')
    } finally {
      onUploadingChange(false)
    }
  }

  return (
    <div className="form-group attachment-upload">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        onChange={handleSelection}
        disabled={disabled || attachments.length >= maxAttachments}
      />
      <small>Up to {maxAttachments} files, 2 MB each. Supported photos and PDF documents.</small>
      {error && <p className="status status--error" role="alert">{error}</p>}
      {attachments.length > 0 && (
        <ul className="attachment-preview-list">
          {attachments.map((attachment, index) => (
            <li key={`${attachment.name}-${index}`}>
              {attachment.type === 'application/pdf'
                ? <a href={attachment.dataUrl} target="_blank" rel="noreferrer">Preview PDF</a>
                : <img src={attachment.dataUrl} alt={`Preview of ${attachment.name}`} />}
              <span title={attachment.name}>{attachment.name}</span>
              <button
                type="button"
                className="btn btn--danger btn--small"
                onClick={() => onChange(attachments.filter((_, attachmentIndex) => attachmentIndex !== index))}
                disabled={disabled}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AttachmentViewerModal({ title, attachments, onClose }) {
  return (
    <div className="modal-overlay attachment-viewer-overlay" onClick={onClose}>
      <div className="modal-content attachment-viewer-modal" role="dialog" aria-modal="true" aria-labelledby="attachment-viewer-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2 id="attachment-viewer-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close attachments">×</button>
        </div>
        <ul className="attachment-viewer-list">
          {attachments.map((attachment, index) => (
            <li key={`${attachment.url}-${index}`}>
              <span>{attachment.name || `Attachment ${index + 1}`}</span>
              <a href={attachment.url} target="_blank" rel="noreferrer">Open</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function DefaultSelect({ value, onChange, options = [], placeholder, required = false, disabled = false, className, id, name }) {
  const normalizedOptions = options.map(option =>
    typeof option === 'string' ? { value: option, label: option } : option
  )
  const hasCurrentValue = value !== '' && value !== null && value !== undefined
    && !normalizedOptions.some(option => String(option.value) === String(value))

  return (
    <select
      id={id}
      name={name}
      value={value ?? ''}
      onChange={onChange}
      required={required}
      disabled={disabled}
      className={className}
    >
      <option value="">{placeholder}</option>
      {hasCurrentValue && <option value={value}>{value}</option>}
      {normalizedOptions.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}

const indianCurrencyWords = (amount) => {
  const roundedPaise = Math.round(Number(amount) * 100)
  const rupees = Math.floor(roundedPaise / 100)
  const paise = roundedPaise % 100
  const underThousand = (value) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    const words = []
    if (value >= 100) {
      words.push(`${ones[Math.floor(value / 100)]} Hundred`)
      value %= 100
    }
    if (value >= 20) words.push(`${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ''}`)
    else if (value >= 10) words.push(teens[value - 10])
    else if (value > 0) words.push(ones[value])
    return words.join(' ')
  }
  const scales = [[1e11, 'Kharab'], [1e9, 'Arab'], [1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']]
  const toIndianWords = (value) => {
    if (value === 0) return 'Zero'
    const parts = []
    scales.forEach(([divisor, label]) => {
      const group = Math.floor(value / divisor)
      if (group > 0) {
        parts.push(`${group < 1000 ? underThousand(group) : toIndianWords(group)} ${label}`)
        value %= divisor
      }
    })
    if (value > 0) parts.push(underThousand(value))
    return parts.join(' ')
  }
  const words = `Rupees ${toIndianWords(rupees)}`
  return paise ? `${words} and ${toIndianWords(paise)} Paise Only` : `${words} Only`
}

function App() {
  const [showPublicSite, setShowPublicSite] = useState(false)
  const authUser = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, getAuthSnapshot)
  const adminLoginOnly = window.location.pathname.replace(/\/+$/, '') === '/admin'
  const [currentTab, setCurrentTab] = useState('quotations')
  const [transformers, setTransformers] = useState([])
  const [transformersLoading, setTransformersLoading] = useState(false)
  const [transformerExportLoading, setTransformerExportLoading] = useState(false)
  const [transformersError, setTransformersError] = useState('')
  const [assessmentTransformer, setAssessmentTransformer] = useState(null)
  const [assessmentMode, setAssessmentMode] = useState('create')
  const [assessmentForm, setAssessmentForm] = useState({
    windingMaterial: '',
    firstInspectionDate: '',
    hvDamagedCoils: '',
    hvOldCoilWeight: '',
    hvNewCoilWeight: '',
    lvReinsulatedCoils: '',
    lvOldCoilWeight: '',
    lvNewCoilWeight: '',
    bushingsLv: '',
    bushingsHv: '',
    bushRodsLv: '',
    bushRodsHv: '',
    metalPartsHv: '',
    metalPartsLv: '',
    breakers: '',
    oilCapacity: '',
    oilLess: '',
    remarks: '',
  })
  const [assessmentError, setAssessmentError] = useState('')
  const [assessmentSaving, setAssessmentSaving] = useState(false)
  const [tnoteAssessmentExporting, setTnoteAssessmentExporting] = useState(null)
  const [statusFilter, setStatusFilter] = useState([])
  const [spmCenterFilter, setSpmCenterFilter] = useState([])
  const [dtrNoFilter, setDtrNoFilter] = useState([])
  const [sNoFilter, setSNoFilter] = useState([])
  const [tNoteFilter, setTNoteFilter] = useState([])
  const [typeFilter, setTypeFilter] = useState([])
  const [capacityFilter, setCapacityFilter] = useState([])
  const [tnoteDateFilter, setTnoteDateFilter] = useState([])
  const [tnoteCountFilter, setTnoteCountFilter] = useState([])
  const [tnoteNoFilter, setTnoteNoFilter] = useState([])
  const [tnoteSpmCenterFilter, setTnoteSpmCenterFilter] = useState([])
  const [tnotePage, setTnotePage] = useState(0)
  const [tnotePageSize, setTnotePageSize] = useState(10)
  const [dcNoFilter, setDcNoFilter] = useState([])
  const [dcDateFilter, setDcDateFilter] = useState([])
  const [dcSpmCenterFilter, setDcSpmCenterFilter] = useState([])
  const [dcPage, setDcPage] = useState(0)
  const [dcPageSize, setDcPageSize] = useState(10)
  const [billSapFilter, setBillSapFilter] = useState([])
  const [billDateFilter, setBillDateFilter] = useState([])
  const [billSpmCenterFilter, setBillSpmCenterFilter] = useState([])
  const [openFilterColumn, setOpenFilterColumn] = useState(null)
  const [filterSearchText, setFilterSearchText] = useState({})
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [summary, setSummary] = useState({
    recieve: 0,
    assesment: 0,
    repairInProgress: 0,
    repaired: 0,
    delivered: 0,
    billed: 0,
  })
  const [tnotes, setTnotes] = useState([])
  const [tnoteLoading, setTnoteLoading] = useState(false)
  const [tnoteError, setTnoteError] = useState('')
  const [showTNoteModal, setShowTNoteModal] = useState(false)
  const [showTNoteDetails, setShowTNoteDetails] = useState(false)
  const [activeTNote, setActiveTNote] = useState(null)
  const [activeTNoteTransformer, setActiveTNoteTransformer] = useState(null)
  const [tnoteTransformerError, setTnoteTransformerError] = useState('')
  const [showAddTNoteTransformer, setShowAddTNoteTransformer] = useState(false)
  const [tNoteIntakeMode, setTNoteIntakeMode] = useState('NEW')
  const [rgpLookupField, setRgpLookupField] = useState('dtrNo')
  const [rgpLookupValue, setRgpLookupValue] = useState('')
  const [rgpLookupResults, setRgpLookupResults] = useState([])
  const [rgpLookupLoading, setRgpLookupLoading] = useState(false)
  const [rgpLookupPerformed, setRgpLookupPerformed] = useState(false)
  const [rgpManualEntry, setRgpManualEntry] = useState(false)
  const [addingTNoteTransformer, setAddingTNoteTransformer] = useState(false)
  const [newTNoteTransformerError, setNewTNoteTransformerError] = useState('')
  const [newTNoteTransformer, setNewTNoteTransformer] = useState({
    spmCenter: '',
    dtrNo: '',
    sNo: '',
    capacity: '',
    type: '',
    oilCapacity: '',
  })
  const [tnoteAttachments, setTnoteAttachments] = useState([])
  const [tnoteAttachmentReading, setTnoteAttachmentReading] = useState(false)
  const [tnoteCreateLoading, setTnoteCreateLoading] = useState(false)
  const [tnoteAttachmentTarget, setTnoteAttachmentTarget] = useState(null)
  const [tnoteAdditionalAttachments, setTnoteAdditionalAttachments] = useState([])
  const [tnoteAdditionalAttachmentReading, setTnoteAdditionalAttachmentReading] = useState(false)
  const [tnoteAttachmentSaveLoading, setTnoteAttachmentSaveLoading] = useState(false)
  const [tnoteAttachmentUploadError, setTnoteAttachmentUploadError] = useState('')
  const [dcs, setDcs] = useState([])
  const [dcLoading, setDcLoading] = useState(false)
  const [showDCModal, setShowDCModal] = useState(false)
  const [dcFormError, setDcFormError] = useState('')
  const [dcSuccessMessage, setDcSuccessMessage] = useState('')
  const [showDCDetails, setShowDCDetails] = useState(false)
  const [activeDC, setActiveDC] = useState(null)
  const [dcDetailTransformers, setDcDetailTransformers] = useState([])
  const [dcTargetTransformerCount, setDcTargetTransformerCount] = useState('')
  const [dcTransformerUpdateId, setDcTransformerUpdateId] = useState(null)
  const [dcDetailError, setDcDetailError] = useState('')
  const [dcDeliveryAttachments, setDcDeliveryAttachments] = useState([])
  const [dcDeliveryAttachmentReading, setDcDeliveryAttachmentReading] = useState(false)
  const [dcMarkDeliveredLoading, setDcMarkDeliveredLoading] = useState(false)
  const [dcEditMode, setDcEditMode] = useState(false)
  const [editDCDate, setEditDCDate] = useState(new Date().toISOString().split('T')[0])
  const [editingTransformer, setEditingTransformer] = useState(null)
  const [showEditTransformerModal, setShowEditTransformerModal] = useState(false)
  const [dcCandidates, setDcCandidates] = useState([])
  const [selectedDCTransformers, setSelectedDCTransformers] = useState([])
  const [dcTnoteLoading, setDcTnoteLoading] = useState(false)
  const [dcCreateLoading, setDcCreateLoading] = useState(false)
  const [dcPdfGeneratingNo, setDcPdfGeneratingNo] = useState('')
  const [dcGenerationError, setDcGenerationError] = useState('')
  const [bills, setBills] = useState([])
  const [billLoading, setBillLoading] = useState(false)
  const [showBillModal, setShowBillModal] = useState(false)
  const [billAttachments, setBillAttachments] = useState([])
  const [billAttachmentReading, setBillAttachmentReading] = useState(false)
  const [billFormError, setBillFormError] = useState('')
  const [attachmentViewer, setAttachmentViewer] = useState(null)
  const [showBillDetails, setShowBillDetails] = useState(false)
  const [activeBill, setActiveBill] = useState(null)
  const [billDetailTransformers, setBillDetailTransformers] = useState([])
  const [billEditMode, setBillEditMode] = useState(false)
  const [billEditDraft, setBillEditDraft] = useState(null)
  const [billReceiptAmount, setBillReceiptAmount] = useState('')
  const [billReceiptDate, setBillReceiptDate] = useState(new Date().toISOString().split('T')[0])
  const [billGstFilingMonth, setBillGstFilingMonth] = useState('')
  const [billInvoiceNo, setBillInvoiceNo] = useState('')
  const [billStatusSaving, setBillStatusSaving] = useState(false)
  const [billStatusError, setBillStatusError] = useState('')
  const [billExportingSapNo, setBillExportingSapNo] = useState('')
  const [billExportError, setBillExportError] = useState('')
  const [billCandidates, setBillCandidates] = useState([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Enquiries state
  const [enquiries, setEnquiries] = useState([])
  const [enquiriesLoading, setEnquiriesLoading] = useState(false)
  const [enquiriesError, setEnquiriesError] = useState('')
  const [expandedEnquiryId, setExpandedEnquiryId] = useState(null)
  const [showEnquiryForm, setShowEnquiryForm] = useState(false)
  const [quotations, setQuotations] = useState([])
  const [dropdownDefaults, setDropdownDefaults] = useState({
    capacities: [],
    makes: [],
    spmCenters: [],
    services: [],
    businessGstin: '',
  })
  const [dropdownDefaultsError, setDropdownDefaultsError] = useState('')
  const [quotationConfig, setQuotationConfig] = useState({ settings: {}, capacities: [], services: [], rates: {} })
  const [quotationsLoading, setQuotationsLoading] = useState(false)
  const [quotationsError, setQuotationsError] = useState('')
  const [quotationsSuccess, setQuotationsSuccess] = useState('')
  const [showQuotationModal, setShowQuotationModal] = useState(false)
  const [quotationModalMode, setQuotationModalMode] = useState('create')
  const [activeQuotation, setActiveQuotation] = useState(null)
  const [activeQuotationGroup, setActiveQuotationGroup] = useState([])
  const [quotationRegeneratingNo, setQuotationRegeneratingNo] = useState('')
  const [quotationDraft, setQuotationDraft] = useState(null)
  const [quotationModalError, setQuotationModalError] = useState('')
  const [selectedQuotationService, setSelectedQuotationService] = useState('')
  const [quotationSaving, setQuotationSaving] = useState(false)
  const [enquiryColumnFilters, setEnquiryColumnFilters] = useState({})
  const [quotationColumnFilters, setQuotationColumnFilters] = useState({})
  const [newEnquiry, setNewEnquiry] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    servicesRequired: '',
    transformerCapacity: '',
    transformerMake: '',
    transformerLocation: '',
    leakageLocation: '',
    breakdownTiming: '',
    siteLocation: '',
  })

  const navItems = [
    {
      id: 'enquiries',
      label: 'Enquiries',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V6c0-1.1-.9-2-2-2zm0 12h-2v2h-2v-2h-2v2h-2v-2h-2v2H8v-2H6v2H4V4h16v12z" />
        </svg>
      ),
    },
    {
      id: 'quotations',
      label: 'Quotations',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 2v4h4M8 12h8v2H8zm0 4h8v2H8z" />
        </svg>
      ),
    },
    {
      id: 'tnotes',
      label: 'TNotes',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M6 4h10l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm10 2H6v14h12V8h-2V4z" />
        </svg>
      ),
    },
    {
      id: 'transformers',
      label: 'Transformers',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M5 4h2v16H5V4zm12 0h2v16h-2V4zM8 7h8v2H8V7zm0 8h8v2H8v-2zm-2 2h12v2H6v-2z" />
        </svg>
      ),
    },
    {
      id: 'dcs',
      label: 'Delivery Challans',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M3 6h14v9H3V6zm16 0h2v9h-2V6zm-3 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      ),
    },
    {
      id: 'bills',
      label: 'Bills',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M5 4h14v16H5V4zm2 2v12h10V6H7zm2 2h6v2H9V8zm0 4h6v2H9v-2z" />
        </svg>
      ),
    },
  ]
  const [selectedBillTransformers, setSelectedBillTransformers] = useState([])
  const [billCreateLoading, setBillCreateLoading] = useState(false)

  const getTNoteSpmCenter = (tnote) => {
    if (!tnote || !Array.isArray(tnote.transformers)) return '-'
    const centers = [...new Set(tnote.transformers.map((transformer) => transformer.spmCenter).filter(Boolean))]
    return centers.length === 0 ? '-' : centers.join(', ')
  }

  const hasValidTransformerId = (transformer) =>
    Number.isInteger(Number(transformer?.id)) && Number(transformer.id) > 0

  const [newTNote, setNewTNote] = useState({
    tNoteNo: '',
    date: new Date().toISOString().split('T')[0],
    numberOfTransformers: 1,
  })
  const [tnoteTransformers, setTnoteTransformers] = useState([
    { spmCenter: '', dtrNo: '', sNo: '', capacity: '', type: '', oilCapacity: '' },
  ])
  const [newDC, setNewDC] = useState({
    date: new Date().toISOString().split('T')[0],
    spmCenter: '',
    totalTransformers: 0,
    customerName: '',
    customerAddress: '',
    customerGstin: '',
    sentToTgspdcl: '',
    emptyDrumsAvailable: '',
    emptyDrumCount: '',
  })
  const [newBill, setNewBill] = useState({ sapNo: '', agreementNo: '', date: new Date().toISOString().split('T')[0], spmCenter: '', totalTransformers: 0, billAmount: 0, gstAmount: 0 })
  const transformerCapacityOptions = dropdownDefaults.capacities
    .map(capacity => {
      const match = String(capacity).trim().match(/^(\d+)(?:\s*kva)?$/i)
      return match ? { value: match[1], label: String(capacity) } : null
    })
    .filter(Boolean)
  const visibleDCCandidates = dcCandidates.filter(transformer =>
    Boolean(newDC.spmCenter) &&
    transformer.status === 'Repaired' &&
    String(transformer.spmCenter || '').trim() === newDC.spmCenter.trim()
  )
  const visibleBillCandidates = billCandidates.filter(transformer =>
    Boolean(newBill.spmCenter) &&
    String(transformer.spmCenter || '').trim() === newBill.spmCenter.trim()
  )
  const availableDCTransformerCandidates = dcCandidates.filter(transformer =>
    transformer.status === 'Repaired' &&
    !dcDetailTransformers.some(assigned => String(assigned.id) === String(transformer.id))
  )
  const parsedDCTargetCount = Number(dcTargetTransformerCount)
  const getTransformerTNoteDetails = (transformer) => {
    const linkedNotes = tnotes.flatMap(tnote =>
      (tnote.transformers || [])
        .filter(linkedTransformer => String(linkedTransformer.id) === String(transformer.id))
        .map(linkedTransformer => ({
          tNoteNo: tnote.tNoteNo || String(tnote.id),
          date: tnote.date || '',
          intakeType: String(linkedTransformer.intakeType || 'NEW').toUpperCase(),
        }))
    )
    if (linkedNotes.length > 0) return linkedNotes
    const legacyTnote = tnotes.find(tnote => String(tnote.id) === String(transformer.tNoteId))
    return legacyTnote
      ? [{ tNoteNo: legacyTnote.tNoteNo || String(legacyTnote.id), date: legacyTnote.date || '', intakeType: String(transformer.intakeType || 'NEW').toUpperCase() }]
      : []
  }
  const getDCSpmCenter = (dc) => {
    const customerName = String(dc.customerName || '')
    const match = customerName.match(/AE\s*\/\s*SPM\s*\/\s*(.+?)\s*\/?\s*TGSPDCL/i)
    return match?.[1]?.trim() || dc.spmCenter || '—'
  }
  const getDCTNoteNumbers = (dc) => {
    const tNoteNumbers = [
      ...(String(dc.tNoteNo || '').split(',').map(value => value.trim()).filter(Boolean)),
      ...(Array.isArray(dc.transformerDetails)
        ? dc.transformerDetails.flatMap(detail =>
          Array.isArray(detail.tNotes) ? detail.tNotes.map(note => String(note.tNoteNo || '').trim()).filter(Boolean) : [],
        )
        : []),
    ]
    return [...new Set(tNoteNumbers)].join(', ')
  }
  const eligibleDCTransformerCandidates = availableDCTransformerCandidates.filter(transformer => {
    const notes = getTransformerTNoteDetails(transformer)
    const hasValidTNote = notes.length > 0 && notes.every(note => note.tNoteNo && note.date)
    const matchesTgspdclCenter = activeDC?.sentToTgspdcl !== true ||
      String(transformer.spmCenter || '').trim() === String(getDCSpmCenter(activeDC) === '—' ? '' : getDCSpmCenter(activeDC)).trim()
    return hasValidTNote && matchesTgspdclCenter
  })
  const maxDCTargetCount = dcDetailTransformers.length + eligibleDCTransformerCandidates.length
  const isDCTargetCountValid =
    dcTargetTransformerCount !== '' &&
    Number.isInteger(parsedDCTargetCount) &&
    parsedDCTargetCount >= 0 &&
    parsedDCTargetCount <= maxDCTargetCount
  const selectedDCTransformerDetails = selectedDCTransformers
    .map(id => visibleDCCandidates.find(transformer => String(transformer.id) === String(id)))
    .filter(Boolean)
    .map(transformer => {
      const tNotesForTransformer = getTransformerTNoteDetails(transformer)
      const isRgp = tNotesForTransformer.some(note => note.intakeType === 'RGP')
      const transformerName = [
        transformer.dtrNo && `DTR ${transformer.dtrNo}`,
        transformer.sNo && `SNo ${transformer.sNo}`,
        transformer.capacity && `${transformer.capacity} kVA`,
        transformer.type,
      ].filter(Boolean).join(' · ')
      return {
        transformerId: transformer.id,
        transformerName: `${transformerName || `Transformer ${transformer.id}`}${isRgp ? ' (RGP)' : ''}`,
        spmCenter: transformer.spmCenter || '',
        dtrNo: transformer.dtrNo || '',
        sNo: transformer.sNo || '',
        capacity: transformer.capacity || '',
        type: transformer.type || '',
        intakeType: isRgp ? 'RGP' : 'NEW',
        tNotes: tNotesForTransformer,
      }
    })

  useEffect(() => {
    if (!authUser) return
    fetchDropdownDefaults()
  }, [authUser])

  useEffect(() => {
    if (!authUser) return
    fetchTransformers()
    fetchSummary()
  }, [authUser, page, pageSize, statusFilter, spmCenterFilter, dtrNoFilter, sNoFilter, typeFilter, capacityFilter])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openFilterColumn && !event.target.closest('.filter-header')) {
        setOpenFilterColumn(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [openFilterColumn])

  useEffect(() => {
    if (!authUser) return
    if (currentTab === 'enquiries') fetchEnquiries()
    if (currentTab === 'quotations') fetchQuotations()
    if (currentTab === 'tnotes') fetchTNotes()
    if (currentTab === 'dcs') fetchDCs()
    if (currentTab === 'bills') fetchBills()
  }, [authUser, currentTab])

  const uniqueValues = (items, accessor) =>
    [...new Set(items.map(accessor).filter((value) => value !== undefined && value !== null && value !== ''))]
      .sort((a, b) => a < b ? -1 : a > b ? 1 : 0)

  const formattedDate = (value) => {
    if (!value) return ''
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()
  }

  const sortByDateDescending = (rows, dateAccessor, tieBreaker = () => '') =>
    [...rows].sort((a, b) => {
      const parsedA = dateAccessor(a) ? new Date(dateAccessor(a)).getTime() : Number.NaN
      const parsedB = dateAccessor(b) ? new Date(dateAccessor(b)).getTime() : Number.NaN
      const dateA = Number.isNaN(parsedA) ? null : parsedA
      const dateB = Number.isNaN(parsedB) ? null : parsedB
      if (dateA !== dateB) {
        if (dateA === null) return 1
        if (dateB === null) return -1
        return dateB - dateA
      }
      return String(tieBreaker(b) || '').localeCompare(String(tieBreaker(a) || ''), undefined, { numeric: true })
    })

  const filteredTNotes = tnotes.filter((tnote) => {
    const dateValue = formattedDate(tnote.date)
    const centers = [...new Set((tnote.transformers || []).map(transformer => transformer.spmCenter).filter(Boolean))]
    return (
      (tnoteNoFilter.length === 0 || tnoteNoFilter.includes(String(tnote.tNoteNo || tnote.id))) &&
      (tnoteDateFilter.length === 0 || tnoteDateFilter.includes(dateValue)) &&
      (tnoteCountFilter.length === 0 || tnoteCountFilter.includes(String(tnote.numberOfTransformers))) &&
      (tnoteSpmCenterFilter.length === 0 ||
        (centers.length === 0
          ? tnoteSpmCenterFilter.includes('-')
          : centers.some(center => tnoteSpmCenterFilter.includes(center))))
    )
  })
  const sortedTNotes = sortByDateDescending(filteredTNotes, (tnote) => tnote.date, (tnote) => tnote.id)
  const tnoteTotalPages = Math.ceil(sortedTNotes.length / tnotePageSize)
  const safeTnotePage = Math.min(tnotePage, Math.max(0, tnoteTotalPages - 1))
  const visibleTNotes = sortedTNotes.slice(safeTnotePage * tnotePageSize, (safeTnotePage + 1) * tnotePageSize)

  const filteredDcs = dcs.filter((dc) => {
    const dateValue = formattedDate(dc.date)
    return (
      (dcNoFilter.length === 0 || dcNoFilter.some(filter => dc.dcNo.toLowerCase().includes(filter.toLowerCase()))) &&
      (dcDateFilter.length === 0 || dcDateFilter.includes(dateValue)) &&
      (dcSpmCenterFilter.length === 0 || dcSpmCenterFilter.some(filter => getDCSpmCenter(dc).toLowerCase().includes(filter.toLowerCase())))
    )
  })
  const sortedDcs = sortByDateDescending(filteredDcs, (dc) => dc.date, (dc) => dc.dcNo)
  const dcTotalPages = Math.ceil(sortedDcs.length / dcPageSize)
  const safeDcPage = Math.min(dcPage, Math.max(0, dcTotalPages - 1))
  const visibleDcs = sortedDcs.slice(safeDcPage * dcPageSize, (safeDcPage + 1) * dcPageSize)

  const filteredBills = bills.filter((bill) => {
    const dateValue = formattedDate(bill.date)
    return (
      (billSapFilter.length === 0 || billSapFilter.some(filter => bill.sapNo.toLowerCase().includes(filter.toLowerCase()))) &&
      (billDateFilter.length === 0 || billDateFilter.includes(dateValue)) &&
      (billSpmCenterFilter.length === 0 || billSpmCenterFilter.some(filter => (bill.spmCenter || '').toLowerCase().includes(filter.toLowerCase())))
    )
  })
  const sortedBills = sortByDateDescending(filteredBills, (bill) => bill.date, (bill) => bill.sapNo)

  const enquiryColumns = [
    { key: 'id', label: 'ID', value: enquiry => String(enquiry.ID || '—') },
    { key: 'date', label: 'Date', value: enquiry => formattedDate(enquiry.Date) || '—' },
    { key: 'company', label: 'Company', value: enquiry => enquiry.CustomerName || '—' },
    { key: 'contact', label: 'Contact Person', value: enquiry => enquiry.ContactPerson || '—' },
    { key: 'mobile', label: 'Mobile', value: enquiry => enquiry.CustomerPhone || '—' },
    { key: 'capacity', label: 'Capacity', value: enquiry => enquiry.TransformerCapacity || '—' },
    { key: 'make', label: 'Make', value: enquiry => enquiry.TransformerMake || '—' },
    { key: 'services', label: 'Services Required', value: enquiry => enquiry.ServicesRequired || '—' },
    { key: 'status', label: 'Status', value: enquiry => enquiry.Status || 'NEW' },
  ]
  const filteredEnquiries = sortByDateDescending(enquiries.filter(enquiry =>
    enquiryColumns.every(({ key, value }) => {
      const selected = enquiryColumnFilters[key] || []
      return selected.length === 0 || selected.includes(value(enquiry))
    })
  ), (enquiry) => enquiry.CreatedAt || enquiry.Date, (enquiry) => enquiry.ID)

  const quotationColumns = [
    { key: 'documentType', label: 'Document Type', value: quotation => quotation.documentType === 'BILL' ? 'Bill' : 'Quotation' },
    { key: 'number', label: 'Document No.', value: quotation => quotation.quotationNo || '—' },
    { key: 'date', label: 'Date', value: quotation => formattedDate(quotation.quotationDate) || '—' },
    { key: 'customer', label: 'Customer', value: quotation => quotation.customerName || '—' },
    { key: 'mobile', label: 'Mobile', value: quotation => quotation.mobile || '—' },
    { key: 'capacity', label: 'Capacity', value: quotation => quotation.transformerCapacity || '—' },
    { key: 'output', label: 'Output', value: quotation => quotation.outputFormat || (quotation.pdfUrl ? 'PDF' : 'PNG') },
  ]
  const filteredQuotations = sortByDateDescending(quotations.filter(quotation =>
    quotationColumns.every(({ key, value }) => {
      const selected = quotationColumnFilters[key] || []
      return selected.length === 0 || selected.includes(value(quotation))
    })
  ), (quotation) => quotation.quotationDate, (quotation) => quotation.createdAt || quotation.quotationNo)

  const onEnquiryColumnFilter = (key) => (value) =>
    setEnquiryColumnFilters(current => ({ ...current, [key]: value }))
  const onQuotationColumnFilter = (key) => (value) =>
    setQuotationColumnFilters(current => ({ ...current, [key]: value }))

  const openTransformersByStatus = (status) => {
    setStatusFilter([status])
    setSpmCenterFilter([])
    setDtrNoFilter([])
    setSNoFilter([])
    setTNoteFilter([])
    setTypeFilter([])
    setCapacityFilter([])
    setPage(0)
    setCurrentTab('transformers')
  }

  const columnOptions = (rows, column) => uniqueValues(rows, column.value)

  const transformerOptions = {
    spmCenter: uniqueValues(transformers, (transformer) => transformer.spmCenter),
    dtrNo: uniqueValues(transformers, (transformer) => transformer.dtrNo),
    sNo: uniqueValues(transformers, (transformer) => transformer.sNo),
    tNote: uniqueValues(transformers, (transformer) => transformer.tNoteId || ''),
    capacity: uniqueValues(transformers, (transformer) => transformer.capacity),
    type: uniqueValues(transformers, (transformer) => transformer.type),
  }

  const tnoteOptions = {
    tnoteNo: uniqueValues(tnotes, (tnote) => String(tnote.tNoteNo || tnote.id)),
    date: uniqueValues(tnotes, (tnote) => formattedDate(tnote.date)),
    count: uniqueValues(tnotes, (tnote) => String(tnote.numberOfTransformers)),
    spmCenter: uniqueValues(
      tnotes.flatMap(tnote => (tnote.transformers || []).map(transformer => transformer.spmCenter).filter(Boolean)),
      center => center
    ),
  }
  if (tnotes.some(tnote => !tnote.transformers?.some(transformer => transformer.spmCenter))) {
    tnoteOptions.spmCenter = [...new Set([...tnoteOptions.spmCenter, '-'])].sort()
  }

  const dcOptions = {
    dcNo: uniqueValues(dcs, (dc) => dc.dcNo),
    date: uniqueValues(dcs, (dc) => formattedDate(dc.date)),
    spmCenter: uniqueValues(dcs, (dc) => getDCSpmCenter(dc)),
  }

  const billOptions = {
    sapNo: uniqueValues(bills, (bill) => bill.sapNo),
    date: uniqueValues(bills, (bill) => formattedDate(bill.date)),
    spmCenter: uniqueValues(bills, (bill) => bill.spmCenter || ''),
  }

  const fetchTransformers = async () => {
    setTransformersLoading(true)
    setTransformersError('')
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(pageSize),
        status: Array.isArray(statusFilter) && statusFilter.length > 0 ? statusFilter.join(',') : '',
        spmCenter: Array.isArray(spmCenterFilter) && spmCenterFilter.length > 0 ? spmCenterFilter.join(',') : '',
        dtrNo: Array.isArray(dtrNoFilter) && dtrNoFilter.length > 0 ? dtrNoFilter.join(',') : '',
        sNo: Array.isArray(sNoFilter) && sNoFilter.length > 0 ? sNoFilter.join(',') : '',
        tNoteId: Array.isArray(tNoteFilter) && tNoteFilter.length > 0 ? tNoteFilter.join(',') : '',
        type: Array.isArray(typeFilter) && typeFilter.length > 0 ? typeFilter.join(',') : '',
        capacity: Array.isArray(capacityFilter) && capacityFilter.length > 0 ? capacityFilter.join(',') : '',
      })
      const response = await apiFetch(`/api/transformers?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch transformers (${response.status})`)
      }
      const data = await response.json()
      const fetchedTransformers = data.content ?? []
      const invalidIdCount = fetchedTransformers.filter(transformer => !hasValidTransformerId(transformer)).length
      setTransformers(fetchedTransformers)
      if (invalidIdCount > 0) {
        setTransformersError(
          `${invalidIdCount} transformer record(s) on this page have missing or invalid IDs. ` +
          'Stage changes are disabled until their spreadsheet records are corrected.'
        )
      }
      setTotalPages(data.totalPages ?? 0)
      setTotalElements(data.totalElements ?? 0)
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to fetch transformers')
    } finally {
      setTransformersLoading(false)
    }
  }

  const exportFilteredTransformers = async () => {
    setTransformerExportLoading(true)
    setTransformersError('')
    try {
      const filters = new URLSearchParams({
        size: '50',
        status: statusFilter.join(','),
        spmCenter: spmCenterFilter.join(','),
        dtrNo: dtrNoFilter.join(','),
        sNo: sNoFilter.join(','),
        tNoteId: tNoteFilter.join(','),
        type: typeFilter.join(','),
        capacity: capacityFilter.join(','),
      })
      const fetchPage = async (pageNumber) => {
        const params = new URLSearchParams(filters)
        params.set('page', String(pageNumber))
        const response = await apiFetch(`/api/transformers?${params.toString()}`)
        if (!response.ok) throw new Error(`Failed to export transformer records (${response.status})`)
        return response.json()
      }

      const firstPage = await fetchPage(0)
      const rows = [...(firstPage.content ?? [])]
      for (let pageNumber = 1; pageNumber < (firstPage.totalPages ?? 0); pageNumber += 1) {
        const result = await fetchPage(pageNumber)
        rows.push(...(result.content ?? []))
      }
      const tnotesResponse = await apiFetch('/api/tnotes')
      if (!tnotesResponse.ok) throw new Error(`Failed to load TNote details for export (${tnotesResponse.status})`)
      const tnotes = await tnotesResponse.json()
      const tnoteReferences = new Map()
      const exportedTransformerIds = new Set(rows.map(row => row.id))
      tnotes.forEach(tnote => {
        (tnote.transformers || []).forEach(transformer => {
          if (!exportedTransformerIds.has(transformer.id)) return
          const references = tnoteReferences.get(transformer.id) || []
          references.push({
            tNoteNo: tnote.tNoteNo || tnote.id,
            intakeType: transformer.intakeType || 'NEW',
            visitStatus: transformer.visitStatus || '',
          })
          tnoteReferences.set(transformer.id, references)
        })
      })
      const columns = [
        ['Sl. No.', row => row.exportSerial],
        ['DTR No.', row => row.dtrNo],
        ['Serial No.', row => row.sNo],
        ['SPM Center', row => row.spmCenter],
        ['Capacity (kVA)', row => row.capacity],
        ['Transformer Type', row => row.type],
        ['Oil Capacity', row => row.oilCapacity],
        ['TNote No(s)', row => (tnoteReferences.get(row.id) || [])
          .map(reference => reference.tNoteNo)
          .filter((value, index, all) => all.indexOf(value) === index)
          .join(', ')],
        ['Intake Type', row => [...new Set((tnoteReferences.get(row.id) || []).map(reference =>
          reference.intakeType === 'RGP' ? 'RGP Return' : 'New Transformer'
        ))].join(', ') || 'New Transformer'],
        ['RGP Visit Stage', row => [...new Set((tnoteReferences.get(row.id) || [])
          .filter(reference => reference.intakeType === 'RGP')
          .map(reference => reference.visitStatus)
          .filter(Boolean))].join(', ')],
        ['Delivery Challan No.', row => row.dcNo],
        ['SAP Bill No.', row => row.sapNo],
        ['Received / Created', row => row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN') : ''],
      ]
      const escapeXml = value => String(value ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
      const xmlCell = (value, styleId = '') => {
        const isNumber = typeof value === 'number' && Number.isFinite(value)
        const style = styleId ? ` ss:StyleID="${styleId}"` : ''
        return `<Cell${style}><Data ss:Type="${isNumber ? 'Number' : 'String'}">${escapeXml(value)}</Data></Cell>`
      }
      const columnWidths = [45, 100, 105, 125, 85, 130, 85, 125, 105, 105, 125, 100, 105]
      const count = columns.length
      const filterDescription = [
        statusFilter.length && `Status: ${statusFilter.join(', ')}`,
        spmCenterFilter.length && `SPM Center: ${spmCenterFilter.join(', ')}`,
        dtrNoFilter.length && `DTR No.: ${dtrNoFilter.join(', ')}`,
        sNoFilter.length && `Serial No.: ${sNoFilter.join(', ')}`,
        tNoteFilter.length && `TNote: ${tNoteFilter.join(', ')}`,
        typeFilter.length && `Type: ${typeFilter.join(', ')}`,
        capacityFilter.length && `Capacity: ${capacityFilter.join(', ')}`,
      ].filter(Boolean).join('  |  ') || 'All transformer records'
      const exportedRows = rows.map((row, index) => ({ ...row, exportSerial: index + 1 }))
      const headingsRow = `<Row ss:AutoFitHeight="1" ss:Height="32">${columns.map(([heading]) => xmlCell(heading, 'ColumnHeader')).join('')}</Row>`
      const dataRows = exportedRows.map((row, index) => {
        const rowStyle = index % 2 === 0 ? 'DataEven' : 'DataOdd'
        return `<Row ss:AutoFitHeight="1">${columns.map(([, value]) => xmlCell(value(row), rowStyle)).join('')}</Row>`
      }).join('')
      const worksheetRows = [
        `<Row ss:Height="34"><Cell ss:StyleID="Title" ss:MergeAcross="${count - 1}"><Data ss:Type="String">D.S. TRANSFORMERS &amp; ELECTRICAL CONTRACTOR</Data></Cell></Row>`,
        `<Row ss:Height="25"><Cell ss:StyleID="Subtitle" ss:MergeAcross="${count - 1}"><Data ss:Type="String">TRANSFORMER ASSET &amp; SERVICE STATUS REGISTER</Data></Cell></Row>`,
        `<Row ss:Height="22"><Cell ss:StyleID="Meta" ss:MergeAcross="${count - 1}"><Data ss:Type="String">Prepared for official review  |  Generated: ${escapeXml(new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}  |  Records: ${rows.length}</Data></Cell></Row>`,
        `<Row ss:Height="22"><Cell ss:StyleID="FilterSummary" ss:MergeAcross="${count - 1}"><Data ss:Type="String">Applied filters: ${escapeXml(filterDescription)}</Data></Cell></Row>`,
        '<Row ss:Height="8"/>',
        headingsRow,
        dataRows,
        `<Row ss:Height="26"><Cell ss:StyleID="TotalLabel" ss:MergeAcross="${count - 2}"><Data ss:Type="String">TOTAL TRANSFORMERS</Data></Cell>${xmlCell(rows.length, 'TotalValue')}</Row>`,
      ].join('')
      const styles = `<Styles>
<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="10" ss:Color="#243247"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
<Style ss:ID="Title"><Alignment ss:Vertical="Center" ss:Horizontal="Left"/><Font ss:FontName="Aptos Display" ss:Size="18" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#16324F" ss:Pattern="Solid"/></Style>
<Style ss:ID="Subtitle"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#24577A" ss:Pattern="Solid"/></Style>
<Style ss:ID="Meta"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="10" ss:Color="#FFFFFF"/><Interior ss:Color="#337A8A" ss:Pattern="Solid"/></Style>
<Style ss:ID="FilterSummary"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Aptos" ss:Size="9" ss:Italic="1" ss:Color="#334155"/><Interior ss:Color="#EAF0F5" ss:Pattern="Solid"/></Style>
<Style ss:ID="ColumnHeader"><Alignment ss:Vertical="Center" ss:Horizontal="Center" ss:WrapText="1"/><Font ss:FontName="Aptos" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#244A64" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#337A8A"/></Borders></Style>
<Style ss:ID="DataEven"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#F3F7FA" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE5EC"/></Borders></Style>
<Style ss:ID="DataOdd"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE5EC"/></Borders></Style>
<Style ss:ID="TotalLabel"><Alignment ss:Vertical="Center" ss:Horizontal="Right"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#16324F" ss:Pattern="Solid"/></Style>
<Style ss:ID="TotalValue"><Alignment ss:Vertical="Center" ss:Horizontal="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#16324F" ss:Pattern="Solid"/></Style>
</Styles>`
      const columnsXml = columnWidths.map(width => `<Column ss:Width="${width}"/>`).join('')
      const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
${styles}
<Worksheet ss:Name="Transformer Register">
<Names><NamedRange ss:Name="_FilterDatabase" ss:RefersTo="=&#39;Transformer Register&#39;!R6C1:R${rows.length + 6}C${count}" ss:Hidden="1"/></Names>
<Table ss:ExpandedColumnCount="${count}" ss:ExpandedRowCount="${rows.length + 7}" x:FullColumns="1" x:FullRows="1">${columnsXml}${worksheetRows}</Table>
<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><PageSetup><Layout x:Orientation="Landscape" x:CenterHorizontal="1"/><PageMargins x:Bottom="0.5" x:Left="0.25" x:Right="0.25" x:Top="0.5"/></PageSetup><Print><FitWidth>1</FitWidth><FitHeight>0</FitHeight><PaperSizeIndex>9</PaperSizeIndex></Print><FreezePanes/><FrozenNoSplit/><SplitHorizontal>6</SplitHorizontal><TopRowBottomPane>6</TopRowBottomPane><ActivePane>2</ActivePane><Panes><Pane><Number>3</Number></Pane><Pane><Number>2</Number><ActiveRow>6</ActiveRow><ActiveCol>1</ActiveCol></Pane></Panes></WorksheetOptions>
<AutoFilter x:Range="R6C1:R${rows.length + 6}C${count}" xmlns="urn:schemas-microsoft-com:office:excel"/>
</Worksheet>
</Workbook>`
      const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `DS-Transformers-Status-Register-${new Date().toISOString().slice(0, 10)}.xls`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to export transformer records')
    } finally {
      setTransformerExportLoading(false)
    }
  }

  const fetchSummary = async () => {
    try {
      const response = await apiFetch('/api/transformers/summary')
      if (!response.ok) {
        throw new Error(`Failed to fetch summary (${response.status})`)
      }
      const data = await response.json()
      setSummary(data)
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to fetch summary')
    }
  }

  const fetchEnquiries = async () => {
    setEnquiriesLoading(true)
    setEnquiriesError('')
    try {
      const response = await apiFetch('/api/enquiries')
      if (!response.ok) {
        throw new Error(`Failed to fetch enquiries (${response.status})`)
      }
      const data = await response.json()
      setEnquiries(data.data || [])
    } catch (err) {
      setEnquiriesError(err instanceof Error ? err.message : 'Failed to fetch enquiries')
    } finally {
      setEnquiriesLoading(false)
    }
  }

  const fetchDropdownDefaults = async () => {
    setDropdownDefaultsError('')
    try {
      const response = await apiFetch('/api/defaults')
      if (!response.ok) throw new Error(`Failed to load dropdown defaults (${response.status})`)
      const result = await response.json()
      if (result.status !== 'SUCCESS' || !result.data) {
        throw new Error(result.message || 'Failed to load dropdown defaults')
      }
      setDropdownDefaults({
        capacities: Array.isArray(result.data.capacities) ? result.data.capacities : [],
        makes: Array.isArray(result.data.makes) ? result.data.makes : [],
        spmCenters: Array.isArray(result.data.spmCenters) ? result.data.spmCenters : [],
        services: Array.isArray(result.data.services) ? result.data.services : [],
        businessGstin: result.data.businessGstin || '',
      })
    } catch (err) {
      setDropdownDefaultsError(err instanceof Error ? err.message : 'Failed to load dropdown defaults')
    }
  }

  const submitEnquiry = async (event) => {
    event.preventDefault()
    setEnquiriesError('')
    try {
      const response = await apiFetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEnquiry),
      })
      if (!response.ok) throw new Error('Failed to submit enquiry')
      setNewEnquiry({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        servicesRequired: '',
        transformerCapacity: '',
        transformerMake: '',
        transformerLocation: '',
        leakageLocation: '',
        breakdownTiming: '',
        siteLocation: '',
      })
      setShowEnquiryForm(false)
      await fetchEnquiries()
    } catch (err) {
      setEnquiriesError(err instanceof Error ? err.message : 'Failed to submit enquiry')
    }
  }

  const fetchTNotes = async () => {
    setTnoteLoading(true)
    setTnoteError('')
    try {
      const response = await apiFetch('/api/tnotes')
      if (!response.ok) {
        throw new Error(`Failed to fetch tnotes (${response.status})`)
      }
      const data = await response.json()
      setTnotes(Array.isArray(data) ? data : [])
      return Array.isArray(data) ? data : []
    } catch (err) {
      setTnoteError(err instanceof Error ? err.message : 'Failed to load TNotes')
      return null
    } finally {
      setTnoteLoading(false)
    }
  }

  const fetchDCs = async () => {
    setDcLoading(true)
    try {
      const response = await apiFetch('/api/dcs')
      if (!response.ok) throw new Error('Failed to fetch dcs')
      const data = await response.json()
      setDcs(Array.isArray(data) ? data : [])
    } catch (err) {
      setTransformersError('Failed to load DCs')
    } finally {
      setDcLoading(false)
    }
  }

  const fetchBills = async () => {
    setBillLoading(true)
    try {
      const response = await apiFetch('/api/bills')
      if (!response.ok) throw new Error('Failed to fetch bills')
      const data = await response.json()
      setBills(Array.isArray(data) ? data : [])
    } catch (err) {
      setTransformersError('Failed to load Bills')
    } finally {
      setBillLoading(false)
    }
  }

  const fetchQuotations = async () => {
    setQuotationsLoading(true)
    setQuotationsError('')
    try {
      const [configResponse, quotationsResponse] = await Promise.all([
        apiFetch('/api/quotations/config'),
        apiFetch('/api/quotations'),
      ])
      if (!configResponse.ok) throw new Error(`Failed to load quotation defaults (${configResponse.status})`)
      if (!quotationsResponse.ok) throw new Error(`Failed to load quotations (${quotationsResponse.status})`)

      const [configResult, quotationsResult] = await Promise.all([
        configResponse.json(),
        quotationsResponse.json(),
      ])
      if (configResult.status !== 'SUCCESS') {
        throw new Error(configResult.message || 'Failed to load quotation defaults')
      }
      if (quotationsResult.status !== 'SUCCESS') {
        throw new Error(quotationsResult.message || 'Failed to load quotations')
      }
      setQuotationConfig(configResult.data)
      setQuotations(Array.isArray(quotationsResult.data) ? quotationsResult.data : [])
    } catch (err) {
      setQuotationsError(err instanceof Error ? err.message : 'Failed to load quotations')
    } finally {
      setQuotationsLoading(false)
    }
  }

  const openNewQuotation = (documentType = 'QUOTATION') => {
    setQuotationsSuccess('')
    setQuotationDraft({
      documentType,
      quotationNo: '',
      customerName: '',
      customerAddress: '',
      contactPerson: '',
      mobile: '',
      transformerMake: '',
      transformerCapacity: '',
      transformerSerialNo: '',
      transformerLocation: '',
      quotationDate: new Date().toISOString().split('T')[0],
      financialYear: quotationConfig.settings['Financial Year'] || '',
      outputFormat: 'PDF',
      gstApplicable: false,
      gstRate: 19,
      warrantyMonths: '',
      terms: '',
      lineItems: [],
    })
    setActiveQuotation(null)
    setActiveQuotationGroup([])
    setQuotationModalError('')
    setSelectedQuotationService('')
    setQuotationModalMode('create')
    setShowQuotationModal(true)
  }

  const openQuotationFromEnquiry = (enquiry) => {
    const requestedServices = String(enquiry.ServicesRequired || '').toLocaleLowerCase()
    const transformerCapacity = quotationConfig.capacities.find(
      capacity => capacity.toLocaleLowerCase() === String(enquiry.TransformerCapacity || '').trim().toLocaleLowerCase()
    ) || ''
    const matchingServices = quotationConfig.services.filter(
      service => requestedServices.includes(service.toLocaleLowerCase())
    )
    const problemDescription = String(enquiry.ProblemDescription || enquiry.Notes || '').trim()

    openNewQuotation()
    setCurrentTab('quotations')
    setQuotationDraft(current => ({
      ...current,
      customerName: enquiry.CustomerName || '',
      customerAddress: enquiry.SiteLocation || '',
      contactPerson: enquiry.ContactPerson || '',
      mobile: enquiry.CustomerPhone || '',
      email: enquiry.CustomerEmail || '',
      transformerMake: enquiry.TransformerMake || '',
      transformerCapacity,
      transformerLocation: enquiry.TransformerLocation || enquiry.SiteLocation || '',
      lineItems: matchingServices.map((service, index) => ({
        service,
        description: index === 0 && problemDescription ? problemDescription : service,
        rate: quotationConfig.rates[transformerCapacity]?.[service] ?? '',
      })),
    }))
  }

  const openQuotation = (quotation, mode) => {
    const relatedDocuments = quotation.documentGroupId
      ? quotations
        .filter(item => item.documentGroupId === quotation.documentGroupId)
        .sort((left, right) => Number(left.groupPosition || 1) - Number(right.groupPosition || 1))
      : [quotation]
    const groupMembers = relatedDocuments.length > 0 ? relatedDocuments : [quotation]
    const combinedLineItems = groupMembers.flatMap(document => document.lineItems || [])
    setActiveQuotation(quotation)
    setActiveQuotationGroup(groupMembers)
    setQuotationsSuccess('')
    setQuotationModalError('')
    setQuotationDraft({
      ...quotation,
      documentType: quotation.documentType || 'QUOTATION',
      email: quotation.email || '',
      outputFormat: quotation.outputFormat || (quotation.pdfUrl ? 'PDF' : 'PNG'),
      lineItems: combinedLineItems.map(item => ({
        ...item,
        quantity: item.quantity ?? 1,
        unit: item.unit || (item.service === 'Transformer Oil Filtration' || item.service === 'New Transformer Oil'
          ? 'litre'
          : item.service === 'Earth Pit Testing' ? 'pit' : 'unit'),
      })),
    })
    setSelectedQuotationService('')
    setQuotationModalMode(mode)
    setShowQuotationModal(true)
  }

  const updateQuotationDraft = (field, value) => {
    setQuotationDraft(current => ({ ...current, [field]: value }))
  }

  const updateQuotationCapacity = (capacity) => {
    setQuotationDraft(current => ({
      ...current,
      transformerCapacity: capacity,
      lineItems: current.lineItems.map(item => ({
        ...item,
        rate: quotationConfig.rates[capacity]?.[item.service] ?? '',
      })),
    }))
  }

  const addQuotationService = () => {
    if (!selectedQuotationService || !quotationDraft) return
    if (quotationDraft.lineItems.some(item => item.service === selectedQuotationService)) return
    const defaultRate = quotationConfig.rates[quotationDraft.transformerCapacity]?.[selectedQuotationService] ?? ''
    setQuotationDraft(current => ({
      ...current,
      lineItems: [
        ...current.lineItems,
        {
          service: selectedQuotationService,
          description: selectedQuotationService,
          rate: defaultRate,
          quantity: current.documentType === 'BILL' ? 1 : undefined,
          unit: selectedQuotationService === 'Transformer Oil Filtration' || selectedQuotationService === 'New Transformer Oil'
            ? 'litre'
            : selectedQuotationService === 'Earth Pit Testing' ? 'pit' : 'unit',
        },
      ],
    }))
    setSelectedQuotationService('')
  }

  const updateQuotationLine = (index, field, value) => {
    setQuotationDraft(current => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item),
    }))
  }

  const removeQuotationLine = (service) => {
    setQuotationDraft(current => ({
      ...current,
      lineItems: current.lineItems.filter(item => item.service !== service),
    }))
  }

  const printQuotation = async (quotation) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setQuotationModalError('Allow pop-ups for this site to print the quotation.')
      return
    }

    let letterheadUrl
    try {
      const response = await apiFetch('/api/quotations/letterhead')
      if (!response.ok) {
        throw new Error(`Unable to load quotation letterhead (${response.status}).`)
      }
      letterheadUrl = URL.createObjectURL(await response.blob())
    } catch (error) {
      printWindow.close()
      setQuotationModalError(error instanceof Error ? error.message : 'Unable to load quotation letterhead.')
      return
    }

    const escapeHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
    const quotationDate = quotation.quotationDate
      ? new Date(`${quotation.quotationDate}T00:00:00`).toLocaleDateString('en-GB')
      : ''
    const dateCode = quotation.quotationDate
      ? `${String(new Date(`${quotation.quotationDate}T00:00:00`).getDate()).padStart(2, '0')}${String(new Date(`${quotation.quotationDate}T00:00:00`).getMonth() + 1).padStart(2, '0')}`
      : ''
    const isBill = quotation.documentType === 'BILL'
    const quotationNumber = quotation.quotationNo || `${isBill ? 'PREVIEW-BILL' : 'PREVIEW'}/${quotation.financialYear || quotationConfig.settings['Financial Year'] || ''}/${dateCode}`
    const subject = quotation.transformerCapacity
      ? `${isBill ? 'Bill' : 'Quotation'} for ${quotation.transformerCapacity} Transformer${quotation.transformerMake ? ` - ${quotation.transformerMake}` : ''}`
      : `${isBill ? 'Bill' : 'Quotation'} for Transformer${quotation.transformerMake ? ` - ${quotation.transformerMake}` : ''}`
    const customerName = escapeHtml(quotation.customerName || '')
    const quotationNo = escapeHtml(quotationNumber)
    const documentTitle = isBill ? 'BILL' : 'QUOTATION'
    const subtotal = Math.round(quotation.lineItems.reduce((total, item) => total + (isBill ? Number(item.quantity || 0) : 1) * Number(item.rate || 0), 0) * 100) / 100
    const gstAmount = isBill && quotation.gstApplicable ? Math.round(subtotal * Number(quotation.gstRate || 19)) / 100 : 0
    const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100
    const billTerms = String(quotation.terms || '').trim() || [
      '1. This bill covers only the services and materials expressly listed above.',
      '2. Any work or materials outside the stated scope require prior written approval and may be charged separately.',
      '3. The customer shall provide safe access, required shutdowns, permits and site facilities for the agreed work.',
      '4. Warranty, if stated, applies only to the specified work and is subject to the agreed scope and exclusions.',
      '5. Any concern regarding this bill should be notified in writing within seven days of receipt.',
      '6. This document is subject to applicable laws and the jurisdiction agreed between the parties.'
    ].join('\n')
    const lineRows = quotation.lineItems.map((item, index) => {
      const unit = item.unit || (item.service === 'Transformer Oil Filtration' || item.service === 'New Transformer Oil'
        ? 'litre'
        : item.service === 'Earth Pit Testing' ? 'pit' : 'unit')
      const rateUnit = item.service === 'Transformer Oil Filtration' || item.service === 'New Transformer Oil'
        ? '/litre'
        : item.service === 'Earth Pit Testing' ? '/pit' : ''
      const quantity = Number(item.quantity || 0)
      const amount = quantity * Number(item.rate || 0)
      return `<tr>
        <td class="number">${index + 1}</td>
        <td>${escapeHtml(item.service)}${item.description && item.description !== item.service ? `<br><span>${escapeHtml(item.description)}</span>` : ''}</td>
        ${isBill ? `<td class="number">${quantity.toLocaleString('en-IN')}</td><td>${escapeHtml(unit)}</td><td class="rate">₹${Number(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="rate">₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>` : `<td class="rate">₹${Number(item.rate || 0).toLocaleString('en-IN')}${rateUnit}</td>`}
      </tr>`
    }).join('')

    printWindow.document.open()
    printWindow.document.write(`<!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${documentTitle} ${quotationNo}</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box; }
          html, body { margin: 0; width: 210mm; min-height: 297mm; color: #172033; font: 10pt Arial, sans-serif; }
          .letterhead { position: fixed; inset: 0; z-index: -1; width: 210mm; height: 297mm; }
          main { position: relative; width: 210mm; min-height: 297mm; padding: 53mm 16mm 24mm; }
          h1 { margin: 0 0 2mm; text-align: center; font-size: 16pt; letter-spacing: 1px; }
          .meta { margin: 0 0 4mm; text-align: center; font-weight: 700; }
          .subject { margin: 0 0 3mm; font-size: 10pt; font-weight: 700; }
          .detail-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 3mm; }
          .detail-card { min-height: 32mm; padding: 3mm; border: 1px solid #94a3b8; border-radius: 2mm; background: rgba(248, 250, 252, 0.92); }
          .detail-card h2 { margin: 0 0 2mm; padding-bottom: 1.5mm; border-bottom: 1px solid #cbd5e1; font-size: 8.5pt; }
          .detail-card p { margin: 0; line-height: 1.45; }
          .section-title { margin: 3mm 0 1.5mm; font-size: 9pt; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
          th, td { border: 1px solid #334155; padding: 1.5mm 2mm; text-align: left; vertical-align: top; }
          th { background: #e8edf4 !important; font-weight: 700; }
          th:first-child, td.number { width: 12mm; text-align: center; }
          th:last-child, td.rate { width: 38mm; text-align: right; white-space: nowrap; }
          .totals { display: flow-root; width: 100%; margin: 1mm 0 0; padding: 3mm; border: 1px solid #dbe3ed; border-radius: 2mm; background: #f8fafc; }
          .totals p { display: flex; justify-content: space-between; width: 76mm; margin: 1mm 0 1mm auto; }
          .totals .grand { padding-top: 1.5mm; border-top: 1px solid #334155; font-size: 11pt; font-weight: 700; }
          .totals .amount-words { display: block; width: 100%; margin: 0.5mm 0 0; text-align: left; font-size: 8pt; line-height: 1.35; }
          .totals .amount-words span { display: block; color: #475569; font-weight: 700; }
          td span { display: inline-block; margin-top: 1mm; color: #475569; }
          .closing { display: block; margin-top: 6mm; break-inside: avoid; }
          .bill-closing { margin-top: 2mm; padding: 3mm; border: 1px solid #dbe3ed; border-radius: 2mm; background: #fff; }
          .terms { max-width: none; line-height: 1.3; font-size: 7.5pt; }
          .terms h2 { margin: 0 0 1mm; font-size: 8.5pt; }
          .terms p { margin: 0 0 1.5mm; }
          .terms ol { margin: 0; padding-left: 5mm; }
          .terms li { margin-bottom: 0.8mm; }
          .signatory { width: 72mm; margin: 7mm 0 0 auto; text-align: right; font-weight: 700; line-height: 1.4; font-size: 8pt; }
          .bill-closing .signatory { margin-top: 3mm; }
          .actions { position: fixed; top: 12px; right: 12px; z-index: 2; }
          .actions button { padding: 10px 16px; border: 0; border-radius: 6px; background: #1e3a5f; color: #fff; font-weight: 700; cursor: pointer; }
          @media screen {
            body { margin: 16px auto; background: #e2e8f0; box-shadow: 0 4px 20px #64748b; }
            .letterhead { position: absolute; }
          }
          @media print {
            html, body, main { width: 210mm; min-height: 297mm; margin: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .letterhead { position: fixed; }
            .actions { display: none; }
          }
        </style>
      </head>
      <body>
        <img class="letterhead" alt="">
        <main>
          <h1>${documentTitle}</h1>
          <div class="meta"><b>${isBill ? 'Bill' : 'Quotation'} No.:</b> ${escapeHtml(quotationNumber)} &nbsp; | &nbsp; <b>Date:</b> ${escapeHtml(quotationDate)}</div>
          <div class="subject">${escapeHtml(subject)}</div>
          <div class="detail-cards">
            <section class="detail-card">
              <h2>CUSTOMER DETAILS</h2>
              <p><b>Name:</b> ${customerName}<br><b>Contact:</b> ${escapeHtml(quotation.contactPerson || '—')}<br><b>Mobile:</b> ${escapeHtml(quotation.mobile || '—')}<br><b>Email:</b> ${escapeHtml(quotation.email || '—')}<br><b>Address:</b> ${escapeHtml(quotation.customerAddress || '—')}</p>
            </section>
            <section class="detail-card">
              <h2>TRANSFORMER DETAILS</h2>
              <p><b>Make:</b> ${escapeHtml(quotation.transformerMake || '—')}<br><b>Capacity:</b> ${escapeHtml(quotation.transformerCapacity || '—')}<br><b>Serial No:</b> ${escapeHtml(quotation.transformerSerialNo || '—')}<br><b>Location:</b> ${escapeHtml(quotation.transformerLocation || '—')}</p>
            </section>
          </div>
          <div class="section-title">${isBill ? 'SERVICE BILL' : 'SERVICES / RATES'}</div>
          <table>
            <thead><tr><th>#</th><th>Description of Work / Service</th>${isBill ? '<th>Qty</th><th>Unit</th><th>Rate (₹)</th><th>Amount (₹)</th>' : '<th>Rate</th>'}</tr></thead>
            <tbody>${lineRows}</tbody>
          </table>
          ${isBill ? `<div class="totals"><p><span>Subtotal</span><b>₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></p>${quotation.gstApplicable ? `<p><span>GST (${Number(quotation.gstRate || 19)}%)</span><b>₹${gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></p>` : ''}<p class="grand"><span>Total Amount</span><strong>₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p><p class="amount-words"><span>Amount in words: </span><b>${escapeHtml(indianCurrencyWords(totalAmount))}</b></p></div>` : ''}
          <div class="closing ${isBill ? 'bill-closing' : ''}">
            <div class="terms">
              <h2>WARRANTY</h2>
              <p>${isBill && quotation.warrantyMonths ? `Warranty valid for ${escapeHtml(quotation.warrantyMonths)} months from completion / commissioning, limited to the specified work.` : 'Warranty, wherever applicable, will be as specified for the respective work.'}</p>
              <h2>TERMS &amp; CONDITIONS</h2>
              ${isBill ? `<p>${escapeHtml(billTerms).replace(/\n/g, '<br>')}</p>` : '<ol><li>This quotation is valid for 15 days from the date of issue.</li><li>The scope of work shall be as specified in this quotation.</li><li>Any additional work or materials required beyond the stated scope shall be quoted separately.</li><li>Warranty, wherever applicable, shall be as specified for the respective work.</li><li>Payment terms shall be as mutually agreed between the parties.</li></ol>'}
            </div>
            <div class="signatory">Digitally Authorized Signatory<br>M/s D.S. Transformers &amp;<br>Electrical Contractor</div>
          </div>
        </main>
        <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
      </body>
      </html>`)
    printWindow.document.close()
    const letterheadImage = printWindow.document.querySelector('.letterhead')
    letterheadImage.addEventListener('load', () => URL.revokeObjectURL(letterheadUrl), { once: true })
    letterheadImage.addEventListener('error', () => {
      URL.revokeObjectURL(letterheadUrl)
      printWindow.close()
      setQuotationModalError('Unable to display the quotation letterhead.')
    }, { once: true })
    letterheadImage.src = letterheadUrl
  }

  const shareQuotationOnWhatsApp = (quotation) => {
    const documentLabel = quotation.documentType === 'BILL' ? 'Service bill' : 'Quotation'
    const fileUrl = quotation.fileUrl || quotation.pdfUrl
    const documentNumbers = quotation.documentGroupId
      ? quotations
        .filter(item => item.documentGroupId === quotation.documentGroupId)
        .sort((left, right) => Number(left.groupPosition || 1) - Number(right.groupPosition || 1))
        .map(item => item.quotationNo)
      : [quotation.quotationNo]
    const recipientName = [quotation.contactPerson, quotation.customerName]
      .find(name => typeof name === 'string' && name.trim())
    if (!fileUrl) {
      setQuotationsError(`Generate the ${documentLabel.toLowerCase()} file before sharing it.`)
      return
    }

    const message = [
      recipientName ? `Dear ${recipientName.trim()},` : 'Hello,',
      '',
      `Please find your ${documentLabel.toLowerCase()}${documentNumbers.length ? ` ${documentNumbers.join(' and ')}` : ''} from D.S. Transformers.`,
      `Transformer: ${[quotation.transformerCapacity, quotation.transformerMake].filter(Boolean).join(' - ') || '—'}`,
      `Date: ${formattedDate(quotation.quotationDate) || '—'}`,
      ''
    ].join('\n')

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  const createQuotationDocumentFile = async (draft, existingMembers = []) => {
    const members = [...existingMembers]
      .sort((left, right) => Number(left.groupPosition || 1) - Number(right.groupPosition || 1))
    const existingNumbers = members.map(member => member.quotationNo)
    const plannedPages = await planQuotationPages(draft, false, existingNumbers)

    const missingNumberCount = plannedPages.filter(page => !page.quotationNo).length
    if (missingNumberCount > 0) {
      const reserveResponse = await apiFetch('/api/quotations/reserve-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: draft.documentType,
          financialYear: draft.financialYear || quotationConfig.settings['Financial Year'],
          quotationDate: draft.quotationDate,
          count: missingNumberCount,
        }),
      })
      const reserveResult = await reserveResponse.json()
      if (!reserveResponse.ok || reserveResult.status !== 'SUCCESS') {
        throw new Error(reserveResult.message || 'Unable to reserve unique document numbers.')
      }
      const reservedNumbers = reserveResult.data?.numbers
      if (!Array.isArray(reservedNumbers) || reservedNumbers.length !== missingNumberCount) {
        throw new Error('The document numbering service returned an incomplete number reservation.')
      }
      let nextNumberIndex = 0
      plannedPages.forEach(page => {
        if (!page.quotationNo) page.quotationNo = reservedNumbers[nextNumberIndex++]
      })
    }

    const documentGroupId = plannedPages.length > 1
      ? members[0]?.documentGroupId || crypto.randomUUID()
      : ''
    plannedPages.forEach((page, index) => {
      page.groupPosition = index + 1
      page.groupCount = plannedPages.length
      page.documentGroupId = documentGroupId
    })
    const requestedFormat = String(draft.outputFormat || 'PDF').toUpperCase()
    const generated = await generateQuotationOutput({
      quotation: { ...draft, quotationNo: plannedPages[0].quotationNo },
      pages: plannedPages,
      requestedFormat,
    })
    const records = generated.pages.map((page, index) => ({
      ...draft,
      ...page,
      documentType: draft.documentType,
      outputFormat: generated.format,
      documentGroupId,
      groupPosition: index + 1,
      groupCount: generated.pages.length,
      createdAt: members[index]?.createdAt || draft.createdAt || '',
    }))
    const saveResponse = await apiFetch('/api/quotations/generated', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records,
        documentGroupId,
        replaceQuotationNumbers: existingNumbers,
        fileName: generated.fileName,
        outputFormat: generated.format,
        dataUrl: generated.dataUrl,
      }),
    })
    const saveResult = await saveResponse.json()
    if (!saveResponse.ok || saveResult.status !== 'SUCCESS') {
      throw new Error(saveResult.message || `Failed to save the generated ${draft.documentType === 'BILL' ? 'bill' : 'quotation'}.`)
    }
    return { generated, records: saveResult.data || records }
  }

  const saveQuotationDraft = async (event) => {
    event.preventDefault()
    if (!quotationDraft) return
    const documentLabel = quotationDraft.documentType === 'BILL' ? 'bill' : 'quotation'
    setQuotationsError('')
    setQuotationsSuccess('')
    setQuotationModalError('')
    const invalidRate = quotationDraft.lineItems.find(item => item.rate === '' || !Number.isFinite(Number(item.rate)) || Number(item.rate) < 0)
    if (invalidRate) {
      setQuotationModalError(`Enter a valid rate for ${invalidRate.service}.`)
      return
    }
    if (quotationDraft.documentType === 'BILL') {
      const invalidQuantity = quotationDraft.lineItems.find(item => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)
      if (invalidQuantity) {
        setQuotationModalError(`Enter a quantity greater than zero for ${invalidQuantity.service}.`)
        return
      }
    }
    if (quotationDraft.lineItems.length === 0) {
      setQuotationModalError(`Add at least one service to the ${documentLabel}.`)
      return
    }

    setQuotationSaving(true)
    try {
      const { generated, records } = await createQuotationDocumentFile(
        quotationDraft,
        quotationModalMode === 'edit' ? activeQuotationGroup : [],
      )
      setShowQuotationModal(false)
      setActiveQuotationGroup(records.length > 1 ? records : [])
      if (generated.overflowed && quotationDraft.outputFormat === 'PNG') {
        setQuotationsSuccess('The document exceeded one page, so it was saved as a two-page PDF with separate document numbers and totals.')
      } else if (generated.overflowed) {
        setQuotationsSuccess('Saved as two separate numbered documents in one PDF, each with its own services and totals.')
      } else {
        setQuotationsSuccess(`${documentLabel[0].toUpperCase()}${documentLabel.slice(1)} generated successfully.`)
      }
      await fetchQuotations()
    } catch (err) {
      setQuotationModalError(err instanceof Error ? err.message : `Failed to generate ${documentLabel}.`)
    } finally {
      setQuotationSaving(false)
    }
  }

  const regenerateQuotationFile = async (quotation) => {
    const members = quotation.documentGroupId
      ? quotations
        .filter(item => item.documentGroupId === quotation.documentGroupId)
        .sort((left, right) => Number(left.groupPosition || 1) - Number(right.groupPosition || 1))
      : [quotation]
    const draft = {
      ...quotation,
      lineItems: members.flatMap(member => member.lineItems || []),
    }
    setQuotationRegeneratingNo(quotation.quotationNo)
    setQuotationsError('')
    setQuotationsSuccess('')
    try {
      const { generated } = await createQuotationDocumentFile(draft, members)
      setQuotationsSuccess(generated.overflowed
        ? `Regenerated the linked two-document ${draft.documentType === 'BILL' ? 'bill' : 'quotation'} PDF.`
        : `Regenerated ${draft.documentType === 'BILL' ? 'bill' : 'quotation'} ${quotation.quotationNo}.`)
      await fetchQuotations()
    } catch (err) {
      setQuotationsError(err instanceof Error ? err.message : 'Failed to regenerate the document.')
    } finally {
      setQuotationRegeneratingNo('')
    }
  }

  const deleteQuotation = async (quotation) => {
    const documentLabel = quotation.documentType === 'BILL' ? 'bill' : 'quotation'
    const relatedDocuments = quotation.documentGroupId
      ? quotations.filter(item => item.documentGroupId === quotation.documentGroupId)
      : [quotation]
    const deletionPrompt = relatedDocuments.length > 1
      ? `Delete the linked ${relatedDocuments.length}-document ${documentLabel} group (${relatedDocuments.map(item => item.quotationNo).join(', ')})? Its shared generated file will also be moved to trash.`
      : `Delete ${documentLabel} ${quotation.quotationNo}? Its generated file will also be moved to trash.`
    if (!confirm(deletionPrompt)) return
    setQuotationsError('')
    setQuotationsSuccess('')
    try {
      const response = await apiFetch(`/api/quotations?quotationNo=${encodeURIComponent(quotation.quotationNo)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok || result.status !== 'SUCCESS') {
        throw new Error(result.message || `Failed to delete quotation (${response.status})`)
      }
      setQuotations(current => current.filter(item => quotation.documentGroupId
        ? item.documentGroupId !== quotation.documentGroupId
        : item.quotationNo !== quotation.quotationNo))
      setQuotationsSuccess(result.message || `${documentLabel[0].toUpperCase()}${documentLabel.slice(1)} deleted.`)
      if (activeQuotation?.quotationNo === quotation.quotationNo) {
        setShowQuotationModal(false)
        setActiveQuotation(null)
        setActiveQuotationGroup([])
      }
    } catch (err) {
      setQuotationsError(err instanceof Error ? err.message : 'Failed to delete quotation')
    }
  }

  const updateTransformerStatus = async (transformerId, nextStatus, assessmentDetails = null, backward = false) => {
    setTransformersError('')
    try {
      const response = await apiFetch(`/api/transformers/${transformerId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus, assessmentDetails, backward }),
      })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `Failed to update status (${response.status})`)
      }
      const updated = await response.json()
      setTransformers((prevTransformers) =>
        prevTransformers.map((transformer) => (transformer.id === updated.id ? updated : transformer)),
      )
      syncTransformerInTNotes(updated)
      await fetchSummary()
      return updated
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Status update failed'
      setTransformersError(message)
      if (nextStatus === 'Assesment' || nextStatus === 'Scrap') setAssessmentError(message)
      return null
    }
  }

  const saveTransformerAssessment = async (transformerId, assessmentDetails) => {
    setAssessmentError('')
    try {
      const response = await apiFetch(`/api/transformers/${transformerId}/assessment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessmentDetails),
      })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `Failed to update assessment (${response.status})`)
      }
      const updated = await response.json()
      setTransformers(current => current.map(transformer =>
        transformer.id === updated.id ? updated : transformer
      ))
      syncTransformerInTNotes(updated)
      return updated
    } catch (err) {
      setAssessmentError(err instanceof Error ? err.message : 'Assessment update failed')
      return null
    }
  }

  const handleCreateInputChange = (event) => {
    const { name, value } = event.target
    setNewTNote((prev) => ({ ...prev, [name]: value }))
  }

  const handleTransformerInputChange = (index, field, value) => {
    setTnoteTransformers((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addTransformerRow = () => {
    setTnoteTransformers((prev) => [...prev, { spmCenter: '', dtrNo: '', sNo: '', capacity: '', type: '', oilCapacity: '' }])
  }

  const removeTransformerRow = (index) => {
    setTnoteTransformers((prev) => prev.filter((_, i) => i !== index))
  }

  const createTNoteWithTransformers = async (event) => {
    event.preventDefault()
    setTransformersError('')
    setTnoteError('')
    if (!newTNote.tNoteNo.trim()) {
      setTnoteError('Enter a TNote number.')
      return
    }
    if (tnoteTransformers.some((t) => !t.spmCenter || !t.dtrNo || !t.sNo || !t.capacity || !t.type || !t.oilCapacity)) {
      setTransformersError('Please fill all transformer fields')
      return
    }

    setTnoteCreateLoading(true)
    try {
      const tnoteResponse = await apiFetch('/api/tnotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tNoteNo: newTNote.tNoteNo.trim(),
          date: newTNote.date,
          numberOfTransformers: tnoteTransformers.length,
          attachments: tnoteAttachments,
        }),
      })
      if (!tnoteResponse.ok) {
        const errorBody = await tnoteResponse.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `Failed to create TNote (${tnoteResponse.status})`)
      }
      const createdTNote = await tnoteResponse.json()

      for (const transformer of tnoteTransformers) {
        const requestId = crypto.randomUUID()
        const transformerResponse = await apiFetch('/api/transformers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...transformer,
            capacity: parseInt(transformer.capacity),
            oilCapacity: parseFloat(transformer.oilCapacity),
            tNoteId: createdTNote.id,
            requestId,
          }),
        })
        if (!transformerResponse.ok) {
          const errorBody = await transformerResponse.json().catch(() => ({}))
          throw new Error(
            `TNote ${createdTNote.tNoteNo || createdTNote.id} was created, but transformer registration failed: ${
              errorBody.detail || errorBody.message || `HTTP ${transformerResponse.status}`
            }`,
          )
        }
      }

      setNewTNote({ tNoteNo: '', date: new Date().toISOString().split('T')[0], numberOfTransformers: 1 })
      setTnoteTransformers([{ spmCenter: '', dtrNo: '', sNo: '', capacity: '', type: '', oilCapacity: '' }])
      setTnoteAttachments([])
      setShowTNoteModal(false)
      await fetchTNotes()
      await fetchTransformers()
      await fetchSummary()
    } catch (err) {
      setTnoteError(err instanceof Error ? err.message : 'Failed to create TNote')
    } finally {
      setTnoteCreateLoading(false)
    }
  }

  const closeTNoteModal = () => {
    if (tnoteCreateLoading || tnoteAttachmentReading) return
    setShowTNoteModal(false)
    setTnoteAttachments([])
  }

  const deleteTNote = async (id) => {
    if (!confirm('Delete this TNote and its links? Transformer records will be retained. TNotes containing RGP visits or delivered transformers cannot be deleted.')) return
    try {
      const response = await apiFetch(`/api/tnotes/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || 'Failed to delete TNote')
      }
      setTnotes((prev) => prev.filter((t) => t.id !== id))
      await fetchTransformers()
      await fetchSummary()
    } catch (err) {
      setTnoteError(err instanceof Error ? err.message : 'Failed to delete TNote')
    }
  }

  const exportTNoteAssessment = async (tnote) => {
    if (!tnote?.id || tnoteAssessmentExporting === tnote.id) return
    setTnoteAssessmentExporting(tnote.id)
    setTnoteError('')
    try {
      const linkedTransformers = Array.isArray(tnote.transformers) ? tnote.transformers : []
      if (linkedTransformers.length !== Number(tnote.numberOfTransformers)) {
        throw new Error(`TNote ${tnote.tNoteNo || tnote.id} reports ${tnote.numberOfTransformers} transformers but returned ${linkedTransformers.length}. The assessment sheet was not exported.`)
      }
      const dcResponse = await apiFetch('/api/dcs')
      if (!dcResponse.ok) throw new Error(`Failed to load delivery challans for TNote export (${dcResponse.status}).`)
      const dcData = await dcResponse.json()
      if (!Array.isArray(dcData)) throw new Error('The delivery challan service returned invalid data; the assessment sheet was not exported.')
      setDcs(dcData)
      const getTransformerDcs = (transformer) => {
        const transformerId = String(transformer.id)
        return dcData.filter(dc =>
          String(dc.dcNo || '').trim().toLowerCase() === String(transformer.dcNo || '').trim().toLowerCase() ||
          (Array.isArray(dc.transformerDetails) && dc.transformerDetails.some(detail =>
            String(detail.transformerId ?? '') === transformerId,
          ))
        )
      }
      const transformerDcs = new Map(linkedTransformers.map(transformer => [
        String(transformer.id),
        getTransformerDcs(transformer),
      ]))
      const unbilledDcs = [...new Map(linkedTransformers
        .filter(transformer => String(transformer.status || '').toLowerCase() !== 'billed')
        .flatMap(transformer => transformerDcs.get(String(transformer.id)) || [])
        .map(dc => [String(dc.dcNo || '').trim().toLowerCase(), dc])
        .filter(([dcNo]) => dcNo)).values()]
      const firstInspectionDates = [...new Set(linkedTransformers
        .map(transformer => transformer.assessmentDetails?.firstInspectionDate)
        .filter(Boolean))]
      const dcNumbers = unbilledDcs.map(dc => dc.dcNo)
      const dcDates = [...new Set(unbilledDcs.map(dc => dc.date).filter(Boolean))]
      const columns = [
        { header: 'Sl. No.', key: 'rowNumber', width: 8, getValue: (_, index) => index + 1 },
        { header: 'DTR Code', key: 'dtrNo', width: 15, getValue: transformer => transformer.dtrNo },
        { header: 'Capacity (kVA)', key: 'capacity', width: 13, getValue: transformer => transformer.capacity },
        { header: 'Make', key: 'make', width: 16, getValue: transformer => transformer.type },
        { header: 'Transformer S. No.', key: 'sNo', width: 17, getValue: transformer => transformer.sNo },
        { header: 'Unbilled Challan No.', key: 'unbilledChallanNo', width: 20, getValue: transformer => {
          if (String(transformer.status || '').toLowerCase() === 'billed') return ''
          return (transformerDcs.get(String(transformer.id)) || []).map(dc => dc.dcNo).filter(Boolean).join(', ')
        } },
        { header: 'Unbilled Challan Date', key: 'unbilledChallanDate', width: 20, getValue: transformer => {
          if (String(transformer.status || '').toLowerCase() === 'billed') return ''
          return [...new Set((transformerDcs.get(String(transformer.id)) || []).map(dc => dc.date).filter(Boolean))]
            .map(date => formattedDate(date)).join(', ')
        } },
        { header: 'First Inspection Date', key: 'firstInspectionDate', width: 18, getValue: transformer => transformer.assessmentDetails?.firstInspectionDate },
        { header: 'Winding Material', key: 'windingMaterial', width: 15, getValue: transformer => transformer.assessmentDetails?.windingMaterial },
        { header: 'HV Coils Damaged', key: 'hvDamagedCoils', width: 16, getValue: transformer => transformer.assessmentDetails?.hvDamagedCoils },
        { header: 'HV Old Coil Weight', key: 'hvOldCoilWeight', width: 16, getValue: transformer => transformer.assessmentDetails?.hvOldCoilWeight },
        { header: 'HV New Coil Weight', key: 'hvNewCoilWeight', width: 16, getValue: transformer => transformer.assessmentDetails?.hvNewCoilWeight },
        { header: 'LV Coils Reinsulated', key: 'lvReinsulatedCoils', width: 18, getValue: transformer => transformer.assessmentDetails?.lvReinsulatedCoils },
        { header: 'LV Old Coil Weight', key: 'lvOldCoilWeight', width: 16, getValue: transformer => transformer.assessmentDetails?.lvOldCoilWeight },
        { header: 'LV New Coil Weight', key: 'lvNewCoilWeight', width: 16, getValue: transformer => transformer.assessmentDetails?.lvNewCoilWeight },
        { header: 'Bushings - LV', key: 'bushingsLv', width: 13, getValue: transformer => transformer.assessmentDetails?.bushingsLv },
        { header: 'Bushings - HV', key: 'bushingsHv', width: 13, getValue: transformer => transformer.assessmentDetails?.bushingsHv },
        { header: 'Bush Rods - LV', key: 'bushRodsLv', width: 14, getValue: transformer => transformer.assessmentDetails?.bushRodsLv },
        { header: 'Bush Rods - HV', key: 'bushRodsHv', width: 14, getValue: transformer => transformer.assessmentDetails?.bushRodsHv },
        { header: 'Metal Parts - HV', key: 'metalPartsHv', width: 15, getValue: transformer => transformer.assessmentDetails?.metalPartsHv },
        { header: 'Metal Parts - LV', key: 'metalPartsLv', width: 15, getValue: transformer => transformer.assessmentDetails?.metalPartsLv },
        { header: 'Breakers', key: 'breakers', width: 12, getValue: transformer => transformer.assessmentDetails?.breakers },
        { header: 'Oil Capacity', key: 'oilCapacity', width: 14, getValue: transformer => transformer.assessmentDetails?.oilCapacity },
        { header: 'Oil Less', key: 'oilLess', width: 12, getValue: transformer => transformer.assessmentDetails?.oilLess },
        { header: 'Remarks', key: 'remarks', width: 48, getValue: transformer => {
          if (String(transformer.status || '').toLowerCase() !== 'billed') return transformer.assessmentDetails?.remarks
          const transformerDC = (transformerDcs.get(String(transformer.id)) || [])[0]
          const dcNo = transformerDC?.dcNo || transformer.dcNo || '—'
          const dcDate = formattedDate(transformerDC?.date) || '—'
          return `Billed Bill no ${transformer.sapNo || '—'} - DC no ${dcNo} date ${dcDate}`
        } },
      ]
      const metadata = [
        ['TNote No.', tnote.tNoteNo || tnote.id],
        ['TNote Date', formattedDate(tnote.date) || '—'],
        ['First Inspection Date', firstInspectionDates.map(date => formattedDate(date)).join(', ') || '—'],
        ['Unbilled D.C. No.', dcNumbers.join(', ') || '—'],
        ['Unbilled D.C. Date', dcDates.map(date => formattedDate(date)).join(', ') || '—'],
      ]
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'D.S. Transformers Management System'
      workbook.created = new Date()
      const worksheet = workbook.addWorksheet('Joint Inspection', {
        pageSetup: {
          paperSize: 9,
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
          printTitlesRow: '11:11',
        },
        views: [{ state: 'frozen', ySplit: 11 }],
      })
      worksheet.columns = columns.map(({ key, width }) => ({ key, width }))
      const lastColumn = columns.length
      worksheet.mergeCells(1, 1, 1, lastColumn)
      worksheet.getCell('A1').value = 'JOINT INSPECTION OF SICK DISTRIBUTION TRANSFORMERS'
      worksheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } }
      worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
      worksheet.getRow(1).height = 30
      const companyRows = [
        'M/s. D.S. TRANSFORMERS & ELECTRICAL CONTRACTOR',
        'Industrial Area, Mallapur, Hyderabad, Telangana 500076',
        `GSTIN: ${dropdownDefaults.businessGstin || '36AAUFM2590B1Z4'}    |    Vendor Number: 314286`,
      ]
      companyRows.forEach((value, index) => {
        const rowNumber = index + 2
        worksheet.mergeCells(rowNumber, 1, rowNumber, lastColumn)
        const cell = worksheet.getCell(rowNumber, 1)
        cell.value = value
        cell.font = {
          name: 'Arial',
          size: index === 0 ? 12 : 10,
          bold: index === 0,
          color: { argb: 'FF17365D' },
        }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? 'FFD9EAF7' : 'FFF3F7FA' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        worksheet.getRow(rowNumber).height = index === 0 ? 22 : 20
      })
      metadata.forEach(([label, value], index) => {
        const rowNumber = index + 6
        worksheet.getCell(rowNumber, 1).value = label
        worksheet.mergeCells(rowNumber, 1, rowNumber, 3)
        worksheet.getCell(rowNumber, 4).value = value
        worksheet.mergeCells(rowNumber, 4, rowNumber, lastColumn)
        worksheet.getCell(rowNumber, 1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF17365D' } }
        worksheet.getCell(rowNumber, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAF7' } }
        worksheet.getCell(rowNumber, 4).font = { name: 'Arial', size: 10, color: { argb: 'FF172B3A' } }
        for (let column = 1; column <= lastColumn; column += 1) {
          worksheet.getCell(rowNumber, column).border = {
            bottom: { style: 'thin', color: { argb: 'FF9FBAD0' } },
          }
        }
      })
      const headerRowNumber = 11
      const headerRow = worksheet.getRow(headerRowNumber)
      headerRow.height = 34
      columns.forEach((column, index) => {
        headerRow.getCell(index + 1).value = column.header
      })
      headerRow.eachCell(cell => {
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF244A64' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF17365D' } } }
      })
      linkedTransformers.forEach((transformer, index) => {
        const row = worksheet.addRow(Object.fromEntries(columns.map(column => [
          column.key,
          column.getValue(transformer, index) ?? '',
        ])))
        row.height = 28
        row.eachCell(cell => {
          cell.font = { name: 'Arial', size: 9, color: { argb: 'FF172B3A' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? 'FFEDF3F8' : 'FFFFFFFF' } }
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFB7C9D6' } },
            left: { style: 'thin', color: { argb: 'FFD5E0E8' } },
          }
        })
        row.getCell('remarks').alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
      })
      const signatureRowNumber = worksheet.lastRow.number + 2
      const signatures = [
        { title: 'AE SIGNATURE', start: 1, end: 5 },
        { title: 'AD SIGNATURE', start: 6, end: 10 },
        { title: 'DE SIGNATURE', start: 11, end: 15 },
        { title: 'CONTRACTOR SIGNATURE', start: 16, end: lastColumn },
      ]
      signatures.forEach(({ title, start, end }) => {
        worksheet.mergeCells(signatureRowNumber, start, signatureRowNumber, end)
        const cell = worksheet.getCell(signatureRowNumber, start)
        cell.value = title
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF17365D' } }
        cell.alignment = { horizontal: 'center', vertical: 'bottom' }
        cell.border = { top: { style: 'thin', color: { argb: 'FF17365D' } } }
      })
      worksheet.getRow(signatureRowNumber).height = 48
      worksheet.pageSetup.printArea = `A1:${worksheet.getColumn(lastColumn).letter}${signatureRowNumber}`
      worksheet.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: headerRowNumber, column: lastColumn } }
      const workbookBuffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([workbookBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Joint-Inspection-TNote-${String(tnote.tNoteNo || tnote.id).replace(/[^A-Za-z0-9_-]/g, '-')}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setTnoteError(err instanceof Error ? err.message : 'Failed to export TNote assessment.')
    } finally {
      setTnoteAssessmentExporting(null)
    }
  }

  const openTNoteDetails = (tnote) => {
    setActiveTNote(tnote)
    setActiveTNoteTransformer(null)
    setTnoteTransformerError('')
    setNewTNoteTransformerError('')
    setShowAddTNoteTransformer(false)
    setTNoteIntakeMode('NEW')
    setRgpLookupValue('')
    setRgpLookupResults([])
    setRgpLookupPerformed(false)
    setRgpManualEntry(false)
    setNewTNoteTransformer({
      spmCenter: '',
      dtrNo: '',
      sNo: '',
      capacity: '',
      type: '',
      oilCapacity: '',
    })
    setShowTNoteDetails(true)
  }

  const closeTNoteDetails = () => {
    if (addingTNoteTransformer) return
    setShowTNoteDetails(false)
    setActiveTNote(null)
    setActiveTNoteTransformer(null)
    setTnoteTransformerError('')
    setNewTNoteTransformerError('')
    setShowAddTNoteTransformer(false)
    setRgpLookupValue('')
    setRgpLookupResults([])
    setRgpLookupPerformed(false)
    setRgpManualEntry(false)
    setShowEditTransformerModal(false)
    setEditingTransformer(null)
  }

  const addTransformerToTNote = async (event) => {
    event.preventDefault()
    if (!activeTNote?.id) return
    setNewTNoteTransformerError('')
    setAddingTNoteTransformer(true)
    try {
      const requestId = crypto.randomUUID()
      const response = await apiFetch('/api/transformers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTNoteTransformer,
          capacity: parseInt(newTNoteTransformer.capacity, 10),
          oilCapacity: parseFloat(newTNoteTransformer.oilCapacity),
          tNoteId: activeTNote.id,
          intakeType: tNoteIntakeMode,
          requestId,
        }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `Failed to add transformer (${response.status})`)
      }
      const createdTransformer = await response.json()
      if (!hasValidTransformerId(createdTransformer)) {
        throw new Error('The transformer was submitted, but the server returned no valid transformer ID. Refresh the TNote before retrying.')
      }

      const updatedTransformers = [...(activeTNote.transformers || []), createdTransformer]
      const updatedTNote = {
        ...activeTNote,
        numberOfTransformers: updatedTransformers.length,
        transformers: updatedTransformers,
      }
      setActiveTNote(updatedTNote)
      setTnotes(current => current.map(tnote => tnote.id === activeTNote.id ? updatedTNote : tnote))
      setTransformers(current => [createdTransformer, ...current.filter(item => item.id !== createdTransformer.id)])
      setNewTNoteTransformer({
        spmCenter: '',
        dtrNo: '',
        sNo: '',
        capacity: '',
        type: '',
        oilCapacity: '',
      })
      setShowAddTNoteTransformer(false)
      await fetchTransformers()
      await fetchSummary()
    } catch (err) {
      setNewTNoteTransformerError(err instanceof Error ? err.message : 'Failed to add transformer')
    } finally {
      setAddingTNoteTransformer(false)
    }
  }

  const searchRgpTransformer = async (event) => {
    event.preventDefault()
    if (!rgpLookupValue.trim()) return
    setRgpLookupLoading(true)
    setRgpLookupPerformed(false)
    setRgpLookupResults([])
    setNewTNoteTransformerError('')
    try {
      const params = new URLSearchParams({ [rgpLookupField]: rgpLookupValue.trim() })
      const response = await apiFetch(`/api/transformers/lookup?${params}`)
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `Transformer search failed (${response.status})`)
      }
      const results = await response.json()
      setRgpLookupResults(results)
      setRgpLookupPerformed(true)
    } catch (err) {
      setNewTNoteTransformerError(err instanceof Error ? err.message : 'Transformer search failed')
    } finally {
      setRgpLookupLoading(false)
    }
  }

  const applyTNoteTransformerList = (transformersForTNote) => {
    const updatedTNote = {
      ...activeTNote,
      numberOfTransformers: transformersForTNote.length,
      transformers: transformersForTNote,
    }
    setActiveTNote(updatedTNote)
    setTnotes(current => current.map(tnote => tnote.id === activeTNote.id ? updatedTNote : tnote))
  }

  const syncTransformerInTNotes = (updatedTransformer) => {
    const mergeTransformer = transformer => transformer.id === updatedTransformer.id
      ? { ...transformer, ...updatedTransformer, intakeType: transformer.intakeType, visitStatus: transformer.visitStatus }
      : transformer
    setTnotes(current => current.map(tnote => ({
      ...tnote,
      transformers: (tnote.transformers || []).map(mergeTransformer),
    })))
    setActiveTNote(current => current ? {
      ...current,
      transformers: (current.transformers || []).map(mergeTransformer),
    } : current)
    setActiveTNoteTransformer(current => current?.id === updatedTransformer.id
      ? { ...current, ...updatedTransformer, intakeType: current.intakeType, visitStatus: current.visitStatus }
      : current)
  }

  const deleteTransformerAssessment = async (transformer) => {
    if (!hasValidTransformerId(transformer)) return
    if (!confirm(`Delete assessment details for transformer ${transformer.dtrNo || transformer.id}? The transformer stage will not change.`)) return
    setTnoteTransformerError('')
    try {
      const response = await apiFetch(`/api/transformers/${transformer.id}/assessment`, { method: 'DELETE' })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `Failed to delete assessment (${response.status})`)
      }
      const updated = { ...transformer, assessmentDetails: null }
      setTransformers(current => current.map(item => item.id === transformer.id ? updated : item))
      syncTransformerInTNotes(updated)
      setAssessmentTransformer(current => current?.id === transformer.id ? null : current)
    } catch (err) {
      setTnoteTransformerError(err instanceof Error ? err.message : 'Failed to delete assessment')
    }
  }

  const linkExistingRgpTransformer = async (transformer) => {
    if (!activeTNote?.id || !hasValidTransformerId(transformer)) return
    setAddingTNoteTransformer(true)
    setNewTNoteTransformerError('')
    try {
      const response = await apiFetch(`/api/tnotes/${activeTNote.id}/transformers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transformerId: transformer.id, intakeType: 'RGP' }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `Failed to link transformer (${response.status})`)
      }
      const linkedTransformer = await response.json()
      applyTNoteTransformerList([...(activeTNote.transformers || []), linkedTransformer])
      setRgpLookupValue('')
      setRgpLookupResults([])
      setRgpLookupPerformed(false)
      setTNoteIntakeMode('NEW')
      setShowAddTNoteTransformer(false)
      await fetchTNotes()
    } catch (err) {
      setNewTNoteTransformerError(err instanceof Error ? err.message : 'Failed to link RGP transformer')
    } finally {
      setAddingTNoteTransformer(false)
    }
  }

  const updateRgpVisitStatus = async (transformer) => {
    const stages = ['Recieved', 'Assesment', 'Repair In Progress', 'Repaired']
    const currentIndex = stages.findIndex(stage => stage.toLowerCase() === (transformer.visitStatus || '').toLowerCase())
    const nextStatus = stages[currentIndex + 1]
    if (!nextStatus || !activeTNote?.id) return
    setTnoteTransformerError('')
    try {
      const response = await apiFetch(`/api/tnotes/${activeTNote.id}/transformers/${transformer.id}/visit-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitStatus: nextStatus }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `Failed to update RGP visit (${response.status})`)
      }
      const updatedTransformer = await response.json()
      applyTNoteTransformerList((activeTNote.transformers || []).map(item =>
        item.id === updatedTransformer.id ? updatedTransformer : item
      ))
      setActiveTNoteTransformer(current => current?.id === updatedTransformer.id ? updatedTransformer : current)
    } catch (err) {
      setTnoteTransformerError(err instanceof Error ? err.message : 'Failed to update RGP visit status')
    }
  }

  const deleteTNoteTransformer = async (transformer) => {
    if (!hasValidTransformerId(transformer)) return
    if (transformer.intakeType === 'RGP') {
      setTnoteTransformerError('RGP visit history is retained and cannot be removed.')
      return
    }
    if (['delivered', 'billed'].includes(String(transformer.status || '').toLowerCase())) {
      setTnoteTransformerError('A delivered transformer cannot be removed from its TNote.')
      return
    }
    if (!confirm(`Remove transformer ${transformer.dtrNo || transformer.id} from this TNote? The transformer record will be kept.`)) return
    setTnoteTransformerError('')
    try {
      const response = await apiFetch(`/api/tnotes/${activeTNote.id}/transformers/${transformer.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.message || errorBody.detail || `Failed to remove transformer from TNote (${response.status})`)
      }
      setTnotes(current => current.map(tnote => tnote.id === activeTNote?.id
        ? {
            ...tnote,
            numberOfTransformers: Math.max(0, (tnote.transformers || []).length - 1),
            transformers: (tnote.transformers || []).filter(item => item.id !== transformer.id),
          }
        : tnote))
      setActiveTNote(current => current ? {
        ...current,
        numberOfTransformers: Math.max(0, (current.transformers || []).length - 1),
        transformers: (current.transformers || []).filter(item => item.id !== transformer.id),
      } : current)
      setActiveTNoteTransformer(current => current?.id === transformer.id ? null : current)
      await fetchTNotes()
    } catch (err) {
      setTnoteTransformerError(err instanceof Error ? err.message : 'Failed to remove transformer from TNote')
    }
  }

  const deleteDC = async (dcNo) => {
    if (!confirm('Delete this DC?')) return
    try {
      const response = await apiFetch(`/api/dcs/lookup?dcNo=${encodeURIComponent(dcNo)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete DC')
      setDcs((prev) => prev.filter((d) => d.dcNo !== dcNo))
    } catch (err) {
      setTransformersError('Failed to delete DC')
    }
  }

  const createBill = async (event) => {
    event.preventDefault()
    setTransformersError('')
    try {
      const response = await apiFetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBill),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `Failed to create Bill (${response.status})`)
      }
      setNewBill({ sapNo: '', date: new Date().toISOString().split('T')[0], spmCenter: '', totalTransformers: 0, billAmount: 0 })
      setShowBillForm(false)
      await fetchBills()
    } catch (err) {
      setTransformersError('Failed to create Bill')
    }
  }

  const deleteBill = async (sapNo) => {
    if (!confirm('Delete this Bill?')) return
    try {
      const response = await apiFetch(`/api/bills/${sapNo}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete Bill')
      setBills((prev) => prev.filter((b) => b.sapNo !== sapNo))
    } catch (err) {
      setTransformersError('Failed to delete Bill')
    }
  }

  const loadDCCandidates = async () => {
    try {
      const response = await apiFetch('/api/transformers?status=Repaired&page=0&size=50')
      if (!response.ok) throw new Error('Failed to load repaired transformers')
      const firstPage = await response.json()
      const candidates = [...(firstPage.content ?? [])]
      for (let pageNumber = 1; pageNumber < (firstPage.totalPages ?? 0); pageNumber += 1) {
        const pageResponse = await apiFetch(`/api/transformers?status=Repaired&page=${pageNumber}&size=50`)
        if (!pageResponse.ok) throw new Error(`Failed to load repaired transformers (page ${pageNumber + 1})`)
        const pageData = await pageResponse.json()
        candidates.push(...(pageData.content ?? []))
      }
      setDcCandidates(candidates)
      return candidates
    } catch (err) {
      setDcFormError(err instanceof Error ? err.message : 'Failed to load repaired transformers')
      return null
    }
  }

  const loadBillCandidates = async () => {
    try {
      const [transformersResponse, tnotesResponse] = await Promise.all([
        apiFetch('/api/transformers?status=Delivered&page=0&size=100'),
        apiFetch('/api/tnotes'),
      ])
      if (!transformersResponse.ok || !tnotesResponse.ok) throw new Error('Failed to load billable transformers')
      const [transformersData, tnotesData] = await Promise.all([
        transformersResponse.json(),
        tnotesResponse.json(),
      ])
      const rgpTransformerIds = new Set((Array.isArray(tnotesData) ? tnotesData : [])
        .flatMap(tnote => tnote.transformers || [])
        .filter(transformer => transformer.intakeType === 'RGP')
        .map(transformer => transformer.id))
      setTnotes(Array.isArray(tnotesData) ? tnotesData : [])
      setBillCandidates((transformersData.content ?? []).filter(transformer => !rgpTransformerIds.has(transformer.id)))
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to load billable transformers')
    }
  }

  const openDCModal = async () => {
    setDcFormError('')
    setDcSuccessMessage('')
    setDcGenerationError('')
    setTransformersError('')
    setShowDCModal(true)
    setSelectedDCTransformers([])
    setNewDC({
      date: new Date().toISOString().split('T')[0],
      spmCenter: '',
      totalTransformers: 0,
      customerName: '',
      customerAddress: '',
      customerGstin: '',
      sentToTgspdcl: '',
      emptyDrumsAvailable: '',
      emptyDrumCount: '',
    })
    setDcTnoteLoading(true)
    try {
      const [loadedTnotes, loadedCandidates] = await Promise.all([fetchTNotes(), loadDCCandidates()])
      if (!loadedTnotes || !loadedCandidates) {
        setDcFormError('Unable to load TNote references or repaired transformers. Close and reopen the form to retry.')
      }
    } finally {
      setDcTnoteLoading(false)
    }
  }

  const openDCDetails = async (dcNo) => {
    setTransformersError('')
    setDcDetailError('')
    try {
      const [dcRes, transformersRes] = await Promise.all([
        apiFetch(`/api/dcs/lookup?dcNo=${encodeURIComponent(dcNo)}`),
        apiFetch(`/api/transformers/by-dc?dcNo=${encodeURIComponent(dcNo)}`),
      ])
      if (!dcRes.ok) throw new Error('Failed to load DC details')
      if (!transformersRes.ok) throw new Error('Failed to load DC transformers')
      const dcData = await dcRes.json()
      const transformerData = await transformersRes.json()
      setActiveDC(dcData)
      setDcDetailTransformers(Array.isArray(transformerData) ? transformerData : [])
      setDcTargetTransformerCount(String(Array.isArray(transformerData) ? transformerData.length : 0))
      await Promise.all([loadDCCandidates(), fetchTNotes()])
      setEditDCDate(dcData.date || new Date().toISOString().split('T')[0])
      setDcEditMode(false)
      setShowDCDetails(true)
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to load DC details')
    }
  }

  const updateDCTransformer = async (transformerId, shouldAdd) => {
    if (!activeDC?.dcNo) return
    if (activeDC.delivered) {
      setDcDetailError('A delivered challan cannot be edited.')
      return
    }
    setDcTransformerUpdateId(transformerId)
    setDcDetailError('')
    try {
      const response = await apiFetch(
        shouldAdd
          ? '/api/dcs/transformers'
          : `/api/dcs/transformers?dcNo=${encodeURIComponent(activeDC.dcNo)}&transformerId=${transformerId}`,
        {
          method: shouldAdd ? 'POST' : 'DELETE',
          headers: shouldAdd ? { 'Content-Type': 'application/json' } : undefined,
          body: shouldAdd ? JSON.stringify({ dcNo: activeDC.dcNo, transformerId }) : undefined,
        },
      )
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || 'Failed to update challan transformers.')
      }
      const updatedDC = await response.json()
      const transformersResponse = await apiFetch(`/api/transformers/by-dc?dcNo=${encodeURIComponent(activeDC.dcNo)}`)
      if (!transformersResponse.ok) throw new Error('Challan was updated, but its transformer list could not be refreshed.')
      const updatedTransformers = await transformersResponse.json()
      setActiveDC(updatedDC)
      const nextTransformers = Array.isArray(updatedTransformers) ? updatedTransformers : []
      setDcDetailTransformers(nextTransformers)
      if (nextTransformers.length === Number(dcTargetTransformerCount)) {
        setDcTargetTransformerCount(String(nextTransformers.length))
      }
      await Promise.all([loadDCCandidates(), fetchDCs(), fetchTransformers(), fetchSummary()])
    } catch (err) {
      setDcDetailError(err instanceof Error ? err.message : 'Failed to update challan transformers.')
    } finally {
      setDcTransformerUpdateId(null)
    }
  }

  const closeDCDetails = () => {
    setShowDCDetails(false)
    setActiveDC(null)
    setDcDetailTransformers([])
    setDcTargetTransformerCount('')
    setDcDeliveryAttachments([])
    setDcEditMode(false)
    setShowEditTransformerModal(false)
    setEditingTransformer(null)
  }

  const markActiveDCAsDelivered = async () => {
    if (!activeDC?.dcNo || activeDC.delivered) return
    if (dcDeliveryAttachments.length === 0) {
      setDcDetailError('Upload the signed delivery challan before marking it delivered.')
      return
    }
    setDcMarkDeliveredLoading(true)
    setDcDetailError('')
    try {
      const response = await apiFetch('/api/dcs/mark-delivered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dcNo: activeDC.dcNo, attachments: dcDeliveryAttachments }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || 'Failed to mark challan as delivered.')
      }
      const deliveredDC = await response.json()
      setActiveDC(deliveredDC)
      setDcDeliveryAttachments([])
      await Promise.all([fetchDCs(), fetchTransformers(), fetchSummary()])
    } catch (err) {
      setDcDetailError(err instanceof Error ? err.message : 'Failed to mark challan as delivered.')
    } finally {
      setDcMarkDeliveredLoading(false)
    }
  }

  const saveDCUpdate = async (event) => {
    event.preventDefault()
    if (!activeDC?.dcNo) return
    try {
      const response = await apiFetch(`/api/dcs/lookup?dcNo=${encodeURIComponent(activeDC.dcNo)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dcNo: activeDC.dcNo, date: editDCDate }),
      })
      if (!response.ok) throw new Error('Failed to update DC')
      const updated = await response.json()
      setActiveDC(updated)
      setDcEditMode(false)
      await fetchDCs()
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to update DC')
    }
  }

  const openEditTransformerModal = (transformer) => {
    setEditingTransformer({ ...transformer })
    setShowEditTransformerModal(true)
  }

  const closeEditTransformerModal = () => {
    setShowEditTransformerModal(false)
    setEditingTransformer(null)
  }

  const handleEditTransformerChange = (field, value) => {
    setEditingTransformer((prev) => ({ ...prev, [field]: value }))
  }

  const saveTransformerUpdate = async (event) => {
    event.preventDefault()
    if (!editingTransformer) return
    try {
      const response = await apiFetch(`/api/transformers/${editingTransformer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spmCenter: editingTransformer.spmCenter,
          dtrNo: editingTransformer.dtrNo,
          sNo: editingTransformer.sNo,
          capacity: parseInt(editingTransformer.capacity, 10),
          type: editingTransformer.type,
          oilCapacity: parseFloat(editingTransformer.oilCapacity),
        }),
      })
      if (!response.ok) throw new Error('Failed to update transformer')
      const updated = await response.json()
      setDcDetailTransformers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setBillDetailTransformers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setTnotes((prev) => prev.map((tnote) => tnote.id === updated.tNoteId
        ? { ...tnote, transformers: (tnote.transformers || []).map((transformer) => transformer.id === updated.id ? updated : transformer) }
        : tnote))
      setActiveTNote((prev) => prev?.id === updated.tNoteId
        ? { ...prev, transformers: (prev.transformers || []).map((transformer) => transformer.id === updated.id ? updated : transformer) }
        : prev)
      setActiveTNoteTransformer((prev) => prev?.id === updated.id ? updated : prev)
      setTransformers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      closeEditTransformerModal()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update transformer'
      if (activeTNote) setTnoteTransformerError(message)
      else setTransformersError(message)
    }
  }

  const openBillDetails = async (sapNo, editMode = false) => {
    setTransformersError('')
    try {
      const [billRes, transformersRes] = await Promise.all([
        apiFetch(`/api/bills/${sapNo}`),
        apiFetch(`/api/transformers/bill/${sapNo}`),
      ])
      if (!billRes.ok) throw new Error('Failed to load bill details')
      if (!transformersRes.ok) throw new Error('Failed to load bill transformers')
      const billData = await billRes.json()
      const transformerData = await transformersRes.json()
      setActiveBill(billData)
      setBillEditDraft({
        agreementNo: billData.agreementNo || '',
        date: billData.date || new Date().toISOString().split('T')[0],
        spmCenter: billData.spmCenter || '',
        billAmount: billData.billAmount ?? 0,
        gstAmount: billData.gstAmount ?? 0,
      })
      setBillDetailTransformers(Array.isArray(transformerData) ? transformerData : [])
      setBillReceiptAmount(billData.amountCredited ?? '')
      setBillReceiptDate(billData.creditedDate || new Date().toISOString().split('T')[0])
      setBillGstFilingMonth(billData.gstFilingMonth || '')
      setBillInvoiceNo(billData.invoiceNo || '')
      setBillStatusError('')
      setBillEditMode(editMode)
      setShowBillDetails(true)
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to load bill details')
    }
  }

  const closeBillDetails = () => {
    setShowBillDetails(false)
    setActiveBill(null)
    setBillDetailTransformers([])
    setBillEditMode(false)
    setBillEditDraft(null)
    setShowEditTransformerModal(false)
    setEditingTransformer(null)
  }

  const saveBillUpdate = async (event) => {
    event.preventDefault()
    if (!activeBill?.sapNo || !billEditDraft) return
    try {
      const response = await apiFetch(`/api/bills/${activeBill.sapNo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sapNo: activeBill.sapNo,
          agreementNo: billEditDraft.agreementNo,
          date: billEditDraft.date,
          spmCenter: billEditDraft.spmCenter,
          totalTransformers: activeBill.totalTransformers,
          billAmount: Number(billEditDraft.billAmount),
          gstAmount: Number(billEditDraft.gstAmount),
        }),
      })
      if (!response.ok) throw new Error('Failed to update Bill')
      const updated = await response.json()
      setActiveBill(updated)
      setBillEditDraft({
        agreementNo: updated.agreementNo || '',
        date: updated.date || '',
        spmCenter: updated.spmCenter || '',
        billAmount: updated.billAmount ?? 0,
        gstAmount: updated.gstAmount ?? 0,
      })
      setBillEditMode(false)
      await fetchBills()
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to update Bill')
    }
  }

  const updateBillStatus = async (status) => {
    if (!activeBill?.sapNo) return
    setBillStatusError('')
    setBillStatusSaving(true)
    try {
      const statusData = status === 'RECEIVED'
        ? { status, amountCredited: Number(billReceiptAmount), creditedDate: billReceiptDate }
        : { status, gstFilingMonth: billGstFilingMonth, invoiceNo: billInvoiceNo.trim() }
      const response = await apiFetch(`/api/bills/${encodeURIComponent(activeBill.sapNo)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusData),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || 'Failed to update bill status')
      }
      const updated = await response.json()
      setActiveBill(updated)
      setBills(current => current.map(bill => bill.sapNo === updated.sapNo ? updated : bill))
    } catch (err) {
      setBillStatusError(err instanceof Error ? err.message : 'Failed to update bill status')
    } finally {
      setBillStatusSaving(false)
    }
  }

  const exportBill = async (sapNo) => {
    setBillExportingSapNo(sapNo)
    setBillExportError('')
    try {
      const [billResponse, transformersResponse, tnotesResponse] = await Promise.all([
        apiFetch(`/api/bills/${encodeURIComponent(sapNo)}`),
        apiFetch(`/api/transformers/bill/${encodeURIComponent(sapNo)}`),
        apiFetch('/api/tnotes'),
      ])
      if (!billResponse.ok) throw new Error(`Failed to load bill ${sapNo} (${billResponse.status})`)
      if (!transformersResponse.ok) throw new Error(`Failed to load bill transformers (${transformersResponse.status})`)
      if (!tnotesResponse.ok) throw new Error(`Failed to load TNote references (${tnotesResponse.status})`)
      const [bill, transformers, tnoteData] = await Promise.all([
        billResponse.json(),
        transformersResponse.json(),
        tnotesResponse.json(),
      ])
      const tnotesForExport = Array.isArray(tnoteData) ? tnoteData : []
      const xmlEscape = value => String(value ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
      const xmlCell = (value, style = 'Data', href = '') => {
        const isNumber = typeof value === 'number' && Number.isFinite(value)
        const hyperlink = /^https?:\/\//i.test(href) ? ` ss:HRef="${xmlEscape(href)}"` : ''
        return `<Cell ss:StyleID="${style}"${hyperlink}><Data ss:Type="${isNumber ? 'Number' : 'String'}">${xmlEscape(value)}</Data></Cell>`
      }
      const titleRow = (title, count) =>
        `<Row ss:Height="34"><Cell ss:StyleID="Title" ss:MergeAcross="${count - 1}"><Data ss:Type="String">${xmlEscape(title)}</Data></Cell></Row>`
      const subtitleRow = (title, count) =>
        `<Row ss:Height="24"><Cell ss:StyleID="Subtitle" ss:MergeAcross="${count - 1}"><Data ss:Type="String">${xmlEscape(title)}</Data></Cell></Row>`
      const metadataRow = (text, count) =>
        `<Row ss:Height="22"><Cell ss:StyleID="Meta" ss:MergeAcross="${count - 1}"><Data ss:Type="String">${xmlEscape(text)}</Data></Cell></Row>`
      const summaryRows = [
        titleRow('D.S. TRANSFORMERS & ELECTRICAL CONTRACTOR', 2),
        subtitleRow('BILL SUBMISSION SUMMARY', 2),
        metadataRow(`Prepared for official review  |  Generated: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`, 2),
        '<Row ss:Height="8"/>',
        ...[
          ['SAP / Bill No.', bill.sapNo],
          ['Agreement No.', bill.agreementNo],
          ['Bill Date', formattedDate(bill.date)],
          ['SPM Center', bill.spmCenter],
          ['Transformer Count', Number(bill.totalTransformers || 0)],
          ['Bill Amount (INR)', Number(bill.billAmount || 0)],
          ['GST Amount (INR)', Number(bill.gstAmount || 0)],
          ['Bill Status', (bill.status || 'PENDING').replace('_', ' ')],
          ['Amount Credited (INR)', bill.amountCredited == null ? '' : Number(bill.amountCredited)],
          ['Credited Date', bill.creditedDate ? formattedDate(bill.creditedDate) : ''],
          ['GST Filing Month', bill.gstFilingMonth || ''],
          ['Invoice No.', bill.invoiceNo || ''],
          ...(Array.isArray(bill.attachments) ? bill.attachments : [])
            .filter(attachment => attachment?.url)
            .map(attachment => ['Uploaded Bill', attachment.name || 'View uploaded bill', attachment.url]),
        ].map(([label, value, href]) =>
          `<Row ss:Height="23">${xmlCell(label, 'SummaryLabel')}${xmlCell(value, 'SummaryValue', href)}</Row>`
        ),
      ]
      const transformerColumns = [
        'Sl. No.',
        'TNote No.',
        'TNote Date',
        'SPM Center',
        'DTR No.',
        'Serial No.',
        'Capacity (kVA)',
        'Transformer Type',
        'Status',
        'Delivery Challan No.',
      ]
      const transformerRows = (Array.isArray(transformers) ? transformers : []).map((transformer, index) => {
        const notes = tnotesForExport.flatMap(tnote =>
          (tnote.transformers || [])
            .filter(linkedTransformer => String(linkedTransformer.id) === String(transformer.id))
            .map(() => ({
              tNoteNo: tnote.tNoteNo || String(tnote.id),
              date: formattedDate(tnote.date),
            }))
        )
        if (notes.length === 0 && transformer.tNoteId != null) {
          const legacyNote = tnotesForExport.find(tnote => String(tnote.id) === String(transformer.tNoteId))
          if (legacyNote) notes.push({
            tNoteNo: legacyNote.tNoteNo || String(legacyNote.id),
            date: formattedDate(legacyNote.date),
          })
        }
        const uniqueNotes = [...new Map(notes.map(note => [note.tNoteNo, note])).values()]
        const rowValues = [
          index + 1,
          uniqueNotes.map(note => note.tNoteNo).join(', ') || '—',
          [...new Set(uniqueNotes.map(note => note.date).filter(Boolean))].join(', ') || '—',
          transformer.spmCenter,
          transformer.dtrNo,
          transformer.sNo,
          Number(transformer.capacity || 0),
          transformer.type,
          transformer.status,
          transformer.dcNo,
        ]
        return `<Row ss:AutoFitHeight="1">${rowValues.map(value => xmlCell(value, index % 2 ? 'DataOdd' : 'DataEven')).join('')}</Row>`
      })
      const transformerSheetRows = [
        titleRow('D.S. TRANSFORMERS & ELECTRICAL CONTRACTOR', transformerColumns.length),
        subtitleRow(`TRANSFORMERS INCLUDED IN BILL ${bill.sapNo || sapNo}`, transformerColumns.length),
        metadataRow(`Agreement No.: ${bill.agreementNo || '—'}  |  Bill Date: ${formattedDate(bill.date) || '—'}  |  SPM Center: ${bill.spmCenter || '—'}  |  Transformers: ${transformerRows.length}`, transformerColumns.length),
        metadataRow(`Prepared for official review  |  Generated: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`, transformerColumns.length),
        '<Row ss:Height="8"/>',
        `<Row ss:Height="32">${transformerColumns.map(column => xmlCell(column, 'ColumnHeader')).join('')}</Row>`,
        ...transformerRows,
        `<Row ss:Height="26"><Cell ss:StyleID="TotalLabel" ss:MergeAcross="${transformerColumns.length - 2}"><Data ss:Type="String">TOTAL TRANSFORMERS</Data></Cell>${xmlCell(transformerRows.length, 'TotalValue')}</Row>`,
      ]
      const styles = `<Styles>
<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="10" ss:Color="#243247"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
<Style ss:ID="Title"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos Display" ss:Size="18" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#16324F" ss:Pattern="Solid"/></Style>
<Style ss:ID="Subtitle"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#24577A" ss:Pattern="Solid"/></Style>
<Style ss:ID="Meta"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Aptos" ss:Size="9" ss:Color="#FFFFFF"/><Interior ss:Color="#337A8A" ss:Pattern="Solid"/></Style>
<Style ss:ID="SummaryLabel"><Alignment ss:Vertical="Center"/><Font ss:Bold="1" ss:Color="#244A64"/><Interior ss:Color="#EAF0F5" ss:Pattern="Solid"/></Style>
<Style ss:ID="SummaryValue"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE5EC"/></Borders></Style>
<Style ss:ID="ColumnHeader"><Alignment ss:Vertical="Center" ss:Horizontal="Center" ss:WrapText="1"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#244A64" ss:Pattern="Solid"/></Style>
<Style ss:ID="DataEven"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#F3F7FA" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE5EC"/></Borders></Style>
<Style ss:ID="DataOdd"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DCE5EC"/></Borders></Style>
<Style ss:ID="TotalLabel"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#16324F" ss:Pattern="Solid"/></Style>
<Style ss:ID="TotalValue"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#16324F" ss:Pattern="Solid"/></Style>
</Styles>`
      const worksheet = (name, rows, widths, landscape = false) =>
        `<Worksheet ss:Name="${name}"><Table>${widths.map(width => `<Column ss:Width="${width}"/>`).join('')}${rows.slice(0, 3).join('')}${rows[3] || ''}${rows.slice(4).join('')}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><PageSetup><Layout x:Orientation="${landscape ? 'Landscape' : 'Portrait'}" x:CenterHorizontal="1"/><PageMargins x:Bottom="0.5" x:Left="0.3" x:Right="0.3" x:Top="0.5"/></PageSetup><Print><FitWidth>1</FitWidth><FitHeight>0</FitHeight></Print></WorksheetOptions></Worksheet>`
      const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
${styles}
${worksheet('Bill Summary', summaryRows, [175, 360])}
${worksheet('Transformers', transformerSheetRows, [45, 110, 95, 130, 110, 110, 90, 125, 105, 135], true)}
</Workbook>`
      const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `DS-Transformers-Bill-${String(sapNo).replace(/[^A-Za-z0-9_-]/g, '-')}-${new Date().toISOString().slice(0, 10)}.xls`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setBillExportError(err instanceof Error ? err.message : `Failed to export bill ${sapNo}`)
    } finally {
      setBillExportingSapNo('')
    }
  }

  const openBillModal = async () => {
    setNewBill({
      sapNo: '',
      agreementNo: '',
      date: new Date().toISOString().split('T')[0],
      spmCenter: '',
      totalTransformers: 0,
      billAmount: 0,
      gstAmount: 0,
    })
    setBillAttachments([])
    setBillFormError('')
    setShowBillModal(true)
    setSelectedBillTransformers([])
    await loadBillCandidates()
  }

  const closeBillModal = () => {
    if (billCreateLoading || billAttachmentReading) return
    setShowBillModal(false)
    setBillAttachments([])
    setBillFormError('')
  }

  const savedAttachmentLinks = (attachments) => {
    if (!Array.isArray(attachments) || attachments.length === 0) return '—'
    return (
      <div className="saved-attachment-links">
        {attachments.filter((attachment) => attachment.url).map((attachment, index) => (
          <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noreferrer">
            {attachment.name || `Attachment ${index + 1}`}
          </a>
        ))}
      </div>
    )
  }

  const renderAttachmentViewerButton = (title, attachments) => {
    const availableAttachments = Array.isArray(attachments)
      ? attachments.filter((attachment) => attachment.url)
      : []

    return (
      <button
        type="button"
        className="btn btn--ghost btn--small btn--icon attachment-viewer-button"
        aria-label={availableAttachments.length ? `View ${availableAttachments.length} attachments for ${title}` : `No attachments for ${title}`}
        title={availableAttachments.length ? `View ${availableAttachments.length} attachment${availableAttachments.length === 1 ? '' : 's'}` : 'No attachments'}
        disabled={availableAttachments.length === 0}
        onClick={() => setAttachmentViewer({ title: `${title} Attachments`, attachments: availableAttachments })}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {availableAttachments.length > 0 && <span>{availableAttachments.length}</span>}
      </button>
    )
  }

  const openTNoteAttachmentUpload = (tnote) => {
    setTnoteAttachmentTarget(tnote)
    setTnoteAdditionalAttachments([])
    setTnoteAttachmentUploadError('')
  }

  const closeTNoteAttachmentUpload = () => {
    if (tnoteAttachmentSaveLoading || tnoteAdditionalAttachmentReading) return
    setTnoteAttachmentTarget(null)
    setTnoteAdditionalAttachments([])
    setTnoteAttachmentUploadError('')
  }

  const saveTNoteAttachments = async () => {
    if (!tnoteAttachmentTarget?.id || tnoteAdditionalAttachments.length === 0) return
    setTnoteAttachmentSaveLoading(true)
    setTnoteAttachmentUploadError('')
    try {
      const response = await apiFetch(`/api/tnotes/${tnoteAttachmentTarget.id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachments: tnoteAdditionalAttachments }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `Failed to add attachments (${response.status})`)
      }
      const updatedTNote = await response.json()
      setTnotes(current => current.map(tnote => tnote.id === updatedTNote.id ? updatedTNote : tnote))
      setTnoteAttachmentTarget(null)
      setTnoteAdditionalAttachments([])
    } catch (error) {
      setTnoteAttachmentUploadError(error instanceof Error ? error.message : 'Failed to add TNote attachments.')
    } finally {
      setTnoteAttachmentSaveLoading(false)
    }
  }

  const toggleDCSelection = (id) => {
    if (!newDC.spmCenter) {
      setDcFormError('Select an SPM Center before choosing transformers.')
      return
    }
    const nextSelection = selectedDCTransformers.includes(id)
      ? selectedDCTransformers.filter(value => value !== id)
      : [...selectedDCTransformers, id]
    const selectedTransformers = nextSelection
      .map(selectedId => dcCandidates.find(transformer => String(transformer.id) === String(selectedId)))
      .filter(Boolean)
    const hasMismatchedCenter = selectedTransformers.some(
      transformer => String(transformer.spmCenter || '').trim() !== newDC.spmCenter.trim(),
    )
    if (hasMismatchedCenter) {
      setDcFormError('All selected transformers must belong to the selected SPM Center.')
      return
    }
    setSelectedDCTransformers(nextSelection)
    setDcFormError('')
  }

  const setDcTgspdclDestination = (sentToTgspdcl) => {
    if (sentToTgspdcl === true && !newDC.spmCenter) {
      setDcFormError('Select an SPM Center before marking this DC as being sent to TGSPDCL.')
      return
    }
    setNewDC(current => ({
      ...current,
      sentToTgspdcl,
      customerName: sentToTgspdcl === true && current.spmCenter
        ? `AE/SPM/${current.spmCenter}/TGSPDCL`
        : '',
      customerAddress: sentToTgspdcl === true ? 'TGSPDCL' : '',
    }))
    setDcFormError('')
  }

  const setDcSpmCenter = (spmCenter) => {
    const hasMismatchedSelection = selectedDCTransformers.some(id => {
      const transformer = dcCandidates.find(candidate => String(candidate.id) === String(id))
      return transformer && String(transformer.spmCenter || '').trim() !== spmCenter.trim()
    })
    if (hasMismatchedSelection) {
      setDcFormError('Remove the selected transformers before changing the SPM Center.')
      return
    }
    setNewDC(current => ({
      ...current,
      spmCenter,
      customerName: current.sentToTgspdcl && spmCenter ? `AE/SPM/${spmCenter}/TGSPDCL` : current.customerName,
      customerAddress: current.sentToTgspdcl ? 'TGSPDCL' : current.customerAddress,
    }))
    setDcFormError('')
  }
  const toggleBillSelection = (id) => {
    setSelectedBillTransformers((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    )
  }
  const setBillSpmCenter = (spmCenter) => {
    const normalizedCenter = spmCenter.trim()
    setNewBill(current => ({ ...current, spmCenter }))
    setSelectedBillTransformers(current => current.filter(id => {
      const transformer = billCandidates.find(candidate => String(candidate.id) === String(id))
      return transformer && String(transformer.spmCenter || '').trim() === normalizedCenter
    }))
    setBillFormError('')
  }

  const createAndSaveDCFile = async (dc) => {
    const generatedPdf = await generateDeliveryChallanPdf(dc, deliveryChallanTemplateUrl)
    const response = await apiFetch('/api/dcs/generated-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...generatedPdf, dcNo: dc.dcNo }),
    })
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody.detail || errorBody.message || 'Failed to save the generated PDF to Google Drive.')
    }
    const savedDc = await response.json()
    setDcs(current => current.map(item => item.dcNo === savedDc.dcNo ? savedDc : item))
    setActiveDC(current => current?.dcNo === savedDc.dcNo ? savedDc : current)
    return savedDc
  }

  const generateExistingDCFile = async (dcNo) => {
    setDcGenerationError('')
    setDcPdfGeneratingNo(dcNo)
    try {
      const response = await apiFetch(`/api/dcs/lookup?dcNo=${encodeURIComponent(dcNo)}`)
      if (!response.ok) throw new Error(`Failed to load delivery challan ${dcNo}.`)
      const dc = await response.json()
      const savedDc = await createAndSaveDCFile(dc)
      setDcSuccessMessage(`Delivery challan ${dcNo} PDF generated and saved to Google Drive.`)
      return savedDc
    } catch (err) {
      setDcGenerationError(err instanceof Error ? err.message : `Failed to generate challan ${dcNo}.`)
      return null
    } finally {
      setDcPdfGeneratingNo('')
    }
  }

  const createDCWithSelection = async (event) => {
    event.preventDefault()
    setDcFormError('')
    if (!newDC.spmCenter) {
      setDcFormError('Select an SPM Center before creating the delivery challan.')
      return
    }
    if (newDC.sentToTgspdcl === '') {
      setDcFormError('Specify whether this delivery challan is being sent to TGSPDCL.')
      return
    }
    if (newDC.emptyDrumsAvailable === '') {
      setDcFormError('Specify whether empty oil drums are being returned.')
      return
    }
    if (newDC.emptyDrumsAvailable === true && (!Number.isInteger(Number(newDC.emptyDrumCount)) || Number(newDC.emptyDrumCount) < 1)) {
      setDcFormError('Enter the number of empty oil drums being returned.')
      return
    }
    if (selectedDCTransformers.length === 0) {
      setDcFormError('Select at least one repaired transformer.')
      return
    }
    if (selectedDCTransformerDetails.some(detail => detail.tNotes.length === 0 || detail.tNotes.some(note => !note.date))) {
      setDcFormError('Every selected transformer must have a linked TNote number and date before delivery.')
      return
    }
    if (!newDC.customerName.trim() || !newDC.customerAddress.trim() || !newDC.customerGstin.trim()) {
      setDcFormError('Complete the customer name, address, and GSTIN.')
      return
    }
    if (selectedDCTransformers.some(id => !visibleDCCandidates.some(transformer => transformer.id === id))) {
      setDcFormError('One or more selected transformers are no longer available for delivery. Review your selection.')
      return
    }
    setDcCreateLoading(true)
    let createdDcNo = ''
    let transformerAssignmentsCompleted = false
    try {
      const selectedTNoteNumbers = [...new Set(
        selectedDCTransformerDetails.flatMap(detail => detail.tNotes.map(note => note.tNoteNo)),
      )]
      const dcRequest = {
        ...newDC,
        companyGstin: dropdownDefaults.businessGstin,
        emptyDrumCount: newDC.emptyDrumsAvailable ? Number(newDC.emptyDrumCount) : 0,
        tNoteNo: selectedTNoteNumbers.join(', '),
        sentToTgspdcl: newDC.sentToTgspdcl === true,
        transformerDetails: selectedDCTransformerDetails,
        totalTransformers: selectedDCTransformers.length,
      }
      const response = await apiFetch('/api/dcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dcRequest),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `Failed to create DC (${response.status})`)
      }
      const createdDC = await response.json()
      if (!createdDC.dcNo) throw new Error('The delivery challan service returned no DC number.')
      createdDcNo = createdDC.dcNo
      for (const id of selectedDCTransformers) {
        const assignRes = await apiFetch('/api/dcs/transformers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dcNo: createdDcNo, transformerId: id }),
        })
        if (!assignRes.ok) {
          const errorBody = await assignRes.json().catch(() => ({}))
          throw new Error(errorBody.detail || errorBody.message || `Failed to assign transformer ${id} to the challan`)
        }
      }
      transformerAssignmentsCompleted = true
      setDcPdfGeneratingNo(createdDcNo)
      await createAndSaveDCFile({ ...createdDC, ...dcRequest })
      setNewDC({
        date: new Date().toISOString().split('T')[0],
        spmCenter: '',
        totalTransformers: 0,
        customerName: '',
        customerAddress: '',
        customerGstin: '',
        sentToTgspdcl: '',
        emptyDrumsAvailable: '',
        emptyDrumCount: '',
      })
      setShowDCModal(false)
      setDcSuccessMessage(`Delivery challan ${createdDcNo} generated and saved to Google Drive.`)
      setDcGenerationError('')
      setSelectedDCTransformers([])
      await fetchDCs()
      await fetchTransformers()
      await fetchSummary()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate delivery challan'
      if (createdDcNo && transformerAssignmentsCompleted) {
        setShowDCModal(false)
        setSelectedDCTransformers([])
        setDcGenerationError(
          `Delivery challan ${createdDcNo} and transformer assignments were saved, but PDF generation failed: ${message} Use the PDF action in the challan list to retry.`,
        )
        await Promise.all([fetchDCs(), fetchTransformers(), fetchSummary()])
      } else {
        setDcFormError(createdDcNo
          ? `Delivery challan ${createdDcNo} was saved, but transformer delivery assignment failed: ${message}`
          : message)
      }
    } finally {
      setDcPdfGeneratingNo('')
      setDcCreateLoading(false)
    }
  }

  const createBillWithSelection = async (event) => {
    event.preventDefault()
    setBillFormError('')
    const sapNo = newBill.sapNo.trim()
    if (!sapNo) {
      setBillFormError('Enter SAP number')
      return
    }
    if (!newBill.agreementNo.trim() || !newBill.date || !newBill.spmCenter) {
      setBillFormError('Complete the agreement number, date, and SPM Center.')
      return
    }
    if (!Number.isFinite(Number(newBill.billAmount)) || Number(newBill.billAmount) < 0 ||
        !Number.isFinite(Number(newBill.gstAmount)) || Number(newBill.gstAmount) < 0) {
      setBillFormError('Bill and GST amounts must be valid non-negative numbers.')
      return
    }
    if (selectedBillTransformers.length === 0) {
      setBillFormError('Select at least one delivered transformer')
      return
    }
    if (selectedBillTransformers.some(id =>
      !visibleBillCandidates.some(transformer => String(transformer.id) === String(id)),
    )) {
      setBillFormError('Selected transformers must belong to the chosen SPM Center.')
      return
    }
    setTransformersError('')
    setBillCreateLoading(true)
    try {
      // Auto-calculate totalTransformers based on selected transformers
      const billData = {
        ...newBill,
        sapNo,
        agreementNo: newBill.agreementNo.trim(),
        totalTransformers: selectedBillTransformers.length,
        billAmount: Number(newBill.billAmount),
        gstAmount: Number(newBill.gstAmount),
        attachments: billAttachments,
      }
      const response = await apiFetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `Failed to create bill (${response.status}).`)
      }
      for (const id of selectedBillTransformers) {
        const billRes = await apiFetch(`/api/transformers/${id}/bill`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sapNo }),
        })
        if (!billRes.ok) {
          const errorBody = await billRes.json().catch(() => ({}))
          throw new Error(errorBody.detail || errorBody.message || `Failed to assign transformer ${id} to bill ${sapNo} (${billRes.status}).`)
        }
      }
      setNewBill({ sapNo: '', agreementNo: '', date: new Date().toISOString().split('T')[0], spmCenter: '', totalTransformers: 0, billAmount: 0, gstAmount: 0 })
      setBillAttachments([])
      setShowBillModal(false)
      setSelectedBillTransformers([])
      await fetchBills()
      await fetchTransformers()
      await fetchSummary()
    } catch (err) {
      setBillFormError(err instanceof Error ? err.message : 'Failed to create Bill')
    } finally {
      setBillCreateLoading(false)
    }

  }

  const openAssessmentForm = (transformer, mode = 'create') => {
    setAssessmentTransformer(transformer)
    setAssessmentMode(mode)
    setAssessmentError('')
    setAssessmentForm({
      windingMaterial: transformer.assessmentDetails?.windingMaterial || '',
      firstInspectionDate: transformer.assessmentDetails?.firstInspectionDate || '',
      hvDamagedCoils: transformer.assessmentDetails?.hvDamagedCoils ?? '',
      hvOldCoilWeight: transformer.assessmentDetails?.hvOldCoilWeight ?? '',
      hvNewCoilWeight: transformer.assessmentDetails?.hvNewCoilWeight ?? '',
      lvReinsulatedCoils: transformer.assessmentDetails?.lvReinsulatedCoils ?? '',
      lvOldCoilWeight: transformer.assessmentDetails?.lvOldCoilWeight ?? '',
      lvNewCoilWeight: transformer.assessmentDetails?.lvNewCoilWeight ?? '',
      bushingsLv: transformer.assessmentDetails?.bushingsLv ?? '',
      bushingsHv: transformer.assessmentDetails?.bushingsHv ?? '',
      bushRodsLv: transformer.assessmentDetails?.bushRodsLv ?? '',
      bushRodsHv: transformer.assessmentDetails?.bushRodsHv ?? '',
      metalPartsHv: transformer.assessmentDetails?.metalPartsHv ?? '',
      metalPartsLv: transformer.assessmentDetails?.metalPartsLv ?? '',
      breakers: transformer.assessmentDetails?.breakers ?? '',
      oilCapacity: transformer.assessmentDetails?.oilCapacity ?? '',
      oilLess: transformer.assessmentDetails?.oilLess ?? '',
      remarks: transformer.assessmentDetails?.remarks || '',
    })
  }

  const moveToNextStage = (transformer) => {
    if (['Repaired', 'Delivered', 'Billed'].includes(transformer.status)) return
    const nextStatus = getNextTransformerStage(transformer)
    if (nextStatus === 'Assesment') {
      openAssessmentForm(transformer, 'stage')
      return
    }
    updateTransformerStatus(transformer.id, nextStatus)
  }

  const getPreviousTransformerStage = (transformer) => {
    const status = String(transformer.status || '').toLowerCase()
    const assessmentRound = Number(transformer.assessmentRound)
    if (status === 'assesment' && assessmentRound === 1) return 'Recieved'
    if (status === 'repair in progress' && assessmentRound === 1) return 'Assesment'
    if (status === 'assesment' && assessmentRound === 2) return 'Repair In Progress'
    if (status === 'repaired' && assessmentRound === 2) return 'Assesment'
    return null
  }

  const moveToPreviousStage = (transformer) => {
    const previousStatus = getPreviousTransformerStage(transformer)
    if (!previousStatus || !hasValidTransformerId(transformer)) return
    updateTransformerStatus(transformer.id, previousStatus, null, true)
  }

  const markAssessmentTransformerAsScrap = async () => {
    if (!assessmentTransformer || !hasValidTransformerId(assessmentTransformer)) return
    if (!window.confirm(`Mark transformer ${assessmentTransformer.dtrNo || assessmentTransformer.id} as Scrap? This cannot be undone.`)) return
    setAssessmentSaving(true)
    setAssessmentError('')
    const updated = await updateTransformerStatus(assessmentTransformer.id, 'Scrap')
    if (updated) setAssessmentTransformer(null)
    setAssessmentSaving(false)
  }

  const submitAssessment = async (event) => {
    event.preventDefault()
    if (!assessmentTransformer) return
    setAssessmentSaving(true)
    setAssessmentError('')
    const assessmentDetails = Object.fromEntries(
      Object.entries(assessmentForm).map(([key, value]) => [
        key,
        key === 'windingMaterial' || key === 'firstInspectionDate' || key === 'remarks'
          ? value
          : value === '' ? null : Number(value),
      ]),
    )
    const updated = assessmentMode === 'stage'
      ? await updateTransformerStatus(assessmentTransformer.id, 'Assesment', assessmentDetails)
      : await saveTransformerAssessment(assessmentTransformer.id, assessmentDetails)
    if (updated) setAssessmentTransformer(null)
    setAssessmentSaving(false)
  }

  const getNextTransformerStage = (transformer) => {
    if (transformer.status === 'Repair In Progress') return 'Assesment'
    if (transformer.status === 'Assesment' && Number(transformer.assessmentRound) >= 2) return 'Repaired'
    const currentIndex = STATUS_ORDER.indexOf(transformer.status)
    return currentIndex >= 0 && currentIndex < STATUS_ORDER.length - 1
      ? STATUS_ORDER[currentIndex + 1]
      : 'Completed'
  }

  const billTransformer = async (transformer) => {
    if (transformer.status !== 'Delivered') {
      return
    }
    const sapNo = prompt('Enter SAP No:')
    if (!sapNo) return
    try {
      const response = await apiFetch(`/api/transformers/${transformer.id}/bill`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sapNo }),
      })
      if (!response.ok) throw new Error('Failed to bill')
      const updated = await response.json()
      setTransformers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      await fetchSummary()
    } catch (err) {
      setTransformersError('Billing failed')
    }
  }

  const FilterHeader = ({ column, value, onFilter, options = null, resetPage = true }) => {
    const isOpen = openFilterColumn === column
    const searchText = filterSearchText[column] || ''

    const handleFilterChange = (newValue, closeDropdown = true) => {
      if (typeof resetPage === 'function') resetPage()
      else if (resetPage) setPage(0)
      onFilter(newValue)
      if (closeDropdown) setOpenFilterColumn(null)
    }

    const visibleOptions = options
      ? options.filter((option) => String(option).toLowerCase().includes(searchText.toLowerCase()))
      : []

    return (
      <div className="filter-header">
        <span>{column}</span>
        <button
          className="filter-icon-btn"
          onClick={(event) => {
            event.stopPropagation()
            setOpenFilterColumn(isOpen ? null : column)
            setFilterSearchText((prev) => ({ ...prev, [column]: '' }))
          }}
          aria-label={`Filter ${column}`}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 .71 1.71l-5.29 5.29V19a1 1 0 0 1-.45.84l-4 3A1 1 0 0 1 10 22v-8.0L4.29 6.71A1 1 0 0 1 3 6V5z" />
          </svg>
        </button>
        {isOpen && (
          <div className="filter-dropdown">
            <input
              type="text"
              placeholder="Search..."
              className="filter-search-input"
              value={searchText}
              onChange={(e) => setFilterSearchText((prev) => ({ ...prev, [column]: e.target.value }))}
              autoFocus
            />
            {column === 'Status' && !options ? (
              <div className="filter-options">
                <button
                  className="btn btn--small btn--ghost"
                  onClick={() => handleFilterChange([])}
                >
                  Clear All
                </button>
                {STATUS_ORDER.map((status) => (
                  <label key={status} className="filter-option">
                    <input
                      type="checkbox"
                      checked={value.includes(status)}
                      onChange={(e) => {
                        const newValue = e.target.checked
                          ? [...value, status]
                          : value.filter(s => s !== status)
                        handleFilterChange(newValue, false)
                      }}
                    />
                    <span>{status}</span>
                  </label>
                ))}
              </div>
            ) : options ? (
              <div className="filter-options">
                <button
                  className="btn btn--small btn--ghost"
                  onClick={() => handleFilterChange([])}
                >
                  Clear All
                </button>
                {visibleOptions.length > 0 ? (
                  visibleOptions.map((option) => (
                    <label key={option} className="filter-option">
                      <input
                        type="checkbox"
                        checked={value.includes(option)}
                        onChange={(e) => {
                          const newValue = e.target.checked
                            ? [...value, option]
                            : value.filter(o => o !== option)
                          handleFilterChange(newValue, false)
                        }}
                      />
                      <span>{option}</span>
                    </label>
                  ))
                ) : (
                  <div className="filter-no-results">No matching values</div>
                )}
              </div>
            ) : (
              <div className="filter-actions">
                <button
                  className="btn btn--small btn--primary"
                  onClick={() => {
                    handleFilterChange(searchText ? [searchText] : [])
                  }}
                >
                  Apply
                </button>
                <button
                  className="btn btn--small btn--ghost"
                  onClick={() => {
                    handleFilterChange([])
                    setOpenFilterColumn(null)
                  }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (authUser === undefined) {
    return <div className="auth-loading" role="status">Checking admin access...</div>
  }

  if (!authUser || showPublicSite) {
    return (
      <LandingPage
        onAdminLogin={() => setShowPublicSite(false)}
        isAuthenticated={Boolean(authUser)}
        onGoToDashboard={() => setShowPublicSite(false)}
        adminLoginOnly={adminLoginOnly && !authUser}
      />
    )
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed((prev) => !prev)} aria-label="Toggle sidebar">
            {sidebarCollapsed ? '>' : '<'}
          </button>
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="DS Transformers logo" className="sidebar-logo" />
          {!sidebarCollapsed && <span className="sidebar-title">V S Transformers</span>}
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
              onClick={() => setCurrentTab(item.id)}
              aria-label={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-shell">
        <header className="hero">
          <div className="hero__content hero__content--compact dashboard-header">
            <div className="dashboard-brand">
              <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="DS Transformers logo" className="hero-logo" />
              <h1>V S Transformers Management System</h1>
            </div>
            <div className="dashboard-header-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setShowPublicSite(true)}
                title="View the public website"
              >
                🌐 Public Website
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => signOut(auth)}
                aria-label="Sign out from admin portal"
                title="Sign out from admin portal"
              >
                🔒 Logout
              </button>
            </div>
          </div>
        </header>
        {dropdownDefaultsError && <p className="status status--error jobs-feedback" role="alert">{dropdownDefaultsError}</p>}

        {currentTab !== 'enquiries' && currentTab !== 'quotations' && (
          <section className="kpis">
            <button type="button" className="card kpi-card" onClick={() => openTransformersByStatus('Recieved')} aria-label={`View ${summary.recieve} received transformers`}>
              <p>Recieved</p>
              <h3>{summary.recieve}</h3>
              <small>New inward entries</small>
            </button>
            <button type="button" className="card kpi-card" onClick={() => openTransformersByStatus('Assesment')} aria-label={`View ${summary.assesment} transformers awaiting assessment`}>
              <p>Assesment</p>
              <h3>{summary.assesment}</h3>
              <small>Fault verification pending</small>
            </button>
            <button type="button" className="card kpi-card" onClick={() => openTransformersByStatus('Repair In Progress')} aria-label={`View ${summary.repairInProgress} transformers in repair`}>
              <p>Repair In Progress</p>
              <h3>{summary.repairInProgress}</h3>
              <small>Workshop jobs in progress</small>
            </button>
            <button type="button" className="card kpi-card" onClick={() => openTransformersByStatus('Repaired')} aria-label={`View ${summary.repaired} repaired transformers`}>
              <p>Repaired</p>
              <h3>{summary.repaired}</h3>
              <small>Ready for dispatch planning</small>
            </button>
            <button type="button" className="card kpi-card" onClick={() => openTransformersByStatus('Delivered')} aria-label={`View ${summary.delivered} delivered transformers`}>
              <p>Delivered</p>
              <h3>{summary.delivered}</h3>
              <small>Customer handover completed</small>
            </button>
            <button type="button" className="card kpi-card" onClick={() => openTransformersByStatus('Billed')} aria-label={`View ${summary.billed} billed transformers`}>
              <p>Billed</p>
              <h3>{summary.billed}</h3>
              <small>Invoice posted after delivery</small>
            </button>
          </section>
        )}

      {currentTab === 'enquiries' && (
        <section className="panel jobs-panel">
          <div className="panel-header">
            <h2>Service Enquiries</h2>
          </div>
          {enquiriesError && <p className="status status--error jobs-feedback">{enquiriesError}</p>}
          {enquiriesLoading && <p className="status jobs-feedback">Loading enquiries...</p>}
          
          {showEnquiryForm && (
            <form onSubmit={submitEnquiry} className="enquiry-form">
              <div className="form-section">
                <h3>Customer Information</h3>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Customer Name"
                    className="form-input"
                    value={newEnquiry.customerName}
                    onChange={(e) => setNewEnquiry({...newEnquiry, customerName: e.target.value})}
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    className="form-input"
                    value={newEnquiry.customerPhone}
                    onChange={(e) => setNewEnquiry({...newEnquiry, customerPhone: e.target.value})}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    className="form-input"
                    value={newEnquiry.customerEmail}
                    onChange={(e) => setNewEnquiry({...newEnquiry, customerEmail: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Service Details</h3>
                <div className="form-row">
                  <DefaultSelect
                    value={newEnquiry.servicesRequired}
                    options={dropdownDefaults.services}
                    placeholder="Select Service Required"
                    required
                    className="form-input"
                    onChange={(e) => setNewEnquiry({...newEnquiry, servicesRequired: e.target.value})}
                  />
                  <input
                    type="text"
                    placeholder="Transformer Location"
                    className="form-input"
                    value={newEnquiry.transformerLocation}
                    onChange={(e) => setNewEnquiry({...newEnquiry, transformerLocation: e.target.value})}
                  />
                </div>
                <div className="form-row">
                  <DefaultSelect
                    value={newEnquiry.transformerCapacity}
                    options={dropdownDefaults.capacities}
                    placeholder="Select Transformer Capacity"
                    className="form-input"
                    onChange={(e) => setNewEnquiry({...newEnquiry, transformerCapacity: e.target.value})}
                  />
                  <DefaultSelect
                    value={newEnquiry.transformerMake}
                    options={dropdownDefaults.makes}
                    placeholder="Select Transformer Make"
                    className="form-input"
                    onChange={(e) => setNewEnquiry({...newEnquiry, transformerMake: e.target.value})}
                  />
                </div>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Leakage Location (if any)"
                    className="form-input"
                    value={newEnquiry.leakageLocation}
                    onChange={(e) => setNewEnquiry({...newEnquiry, leakageLocation: e.target.value})}
                  />
                  <input
                    type="text"
                    placeholder="Breakdown Timing"
                    className="form-input"
                    value={newEnquiry.breakdownTiming}
                    onChange={(e) => setNewEnquiry({...newEnquiry, breakdownTiming: e.target.value})}
                  />
                </div>
                <textarea
                  placeholder="Site Location / Additional Details"
                  className="form-input form-textarea"
                  value={newEnquiry.siteLocation}
                  onChange={(e) => setNewEnquiry({...newEnquiry, siteLocation: e.target.value})}
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn--primary">Submit Enquiry</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowEnquiryForm(false)}>Cancel</button>
              </div>
            </form>
          )}

          <div className="jobs-table-wrap">
            <table className="jobs-table enquiries-table">
              <thead>
                <tr>
                  {enquiryColumns.map(column => (
                    <th key={column.key}>
                      <FilterHeader
                        column={column.label}
                        value={enquiryColumnFilters[column.key] || []}
                        onFilter={onEnquiryColumnFilter(column.key)}
                        options={columnOptions(enquiries, column)}
                        resetPage={false}
                      />
                    </th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnquiries.map((enquiry) => (
                  <Fragment key={enquiry.ID}>
                    <tr>
                      <td>{enquiry.ID}</td>
                      <td>{formattedDate(enquiry.Date)}</td>
                      <td>{enquiry.CustomerName || '—'}</td>
                      <td>{enquiry.ContactPerson || '—'}</td>
                      <td>{enquiry.CustomerPhone || '—'}</td>
                      <td>{enquiry.TransformerCapacity || '—'}</td>
                      <td>{enquiry.TransformerMake || '—'}</td>
                      <td>{enquiry.ServicesRequired || '—'}</td>
                      <td>
                        <span className={`tag tag--${(enquiry.Status || 'new').toLowerCase().replace(/\s+/g, '-')}`}>
                          {enquiry.Status || 'NEW'}
                        </span>
                      </td>
                      <td className="actions-cell enquiry-actions-cell">
                        <div className="enquiry-row-actions">
                          <button
                            className="btn btn--primary btn--small btn--icon"
                            aria-label="Generate quotation from enquiry"
                            onClick={() => openQuotationFromEnquiry(enquiry)}
                            title="Generate a quotation from this enquiry"
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <path d="M14 2v6h6M8 13h8M8 17h5"/>
                              <path d="M17 12v6M14 15h6"/>
                            </svg>
                          </button>
                          <button
                            className="btn btn--ghost btn--small btn--icon"
                            aria-expanded={expandedEnquiryId === enquiry.ID}
                            aria-label={`${expandedEnquiryId === enquiry.ID ? 'Hide' : 'View'} enquiry details`}
                            title={expandedEnquiryId === enquiry.ID ? 'Hide details' : 'View details'}
                            onClick={() => setExpandedEnquiryId(current => current === enquiry.ID ? null : enquiry.ID)}
                          >
                            {expandedEnquiryId === enquiry.ID ? (
                              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 3l18 18"/>
                                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/>
                                <path d="M9.9 5.2A11 11 0 0 1 12 5c6.4 0 10 7 10 7a15 15 0 0 1-3 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10 10 0 0 0 4-.8"/>
                              </svg>
                            ) : (
                              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedEnquiryId === enquiry.ID && (
                      <tr className="enquiry-details-row">
                        <td colSpan="10">
                          <dl className="enquiry-details-grid">
                            <div><dt>Transformer status</dt><dd>{enquiry.TransformerStatus || '—'}</dd></div>
                            <div><dt>Assistance timing</dt><dd>{enquiry.ServicePriority || '—'}</dd></div>
                            <div><dt>Location</dt><dd>{enquiry.TransformerLocation || enquiry.SiteLocation || '—'}</dd></div>
                            <div><dt>Problem description</dt><dd>{enquiry.ProblemDescription || enquiry.Notes || '—'}</dd></div>
                            {enquiry.CustomerEmail && <div><dt>Email</dt><dd>{enquiry.CustomerEmail}</dd></div>}
                            {enquiry.LeakageLocation && <div><dt>Leakage location</dt><dd>{enquiry.LeakageLocation}</dd></div>}
                            {enquiry.BreakdownTiming && <div><dt>Breakdown timing</dt><dd>{enquiry.BreakdownTiming}</dd></div>}
                            {enquiry.PhotoLinks && (
                              <div>
                                <dt>Photos</dt>
                                <dd>{String(enquiry.PhotoLinks).split(/\n|,\s*/).filter(Boolean).map((url, index) => (
                                  <a key={url} href={url} target="_blank" rel="noreferrer">Photo {index + 1}</a>
                                ))}</dd>
                              </div>
                            )}
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {!enquiriesLoading && enquiries.length === 0 && (
                  <tr>
                    <td colSpan="10">No enquiries available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {currentTab === 'quotations' && (
        <section className="panel jobs-panel">
          <div className="panel-header">
            <div>
              <h2>Quotation &amp; Service Bill Management</h2>
              <p className="quotation-settings-summary">
                {quotationConfig.settings['Business Name'] || 'D.S. Transformers'} ·
                {' '}Financial year {quotationConfig.settings['Financial Year'] || '—'} ·
              </p>
            </div>
            <div className="quotation-header-actions">
              <button className="btn btn--secondary" onClick={() => openNewQuotation('BILL')} disabled={quotationConfig.capacities.length === 0}>
                Generate Bill
              </button>
              <button className="btn btn--primary" onClick={() => openNewQuotation()} disabled={quotationConfig.capacities.length === 0}>
                Generate Quotation
              </button>
            </div>
          </div>
          {quotationsError && <p className="status status--error jobs-feedback" role="alert">{quotationsError}</p>}
          {quotationsSuccess && <p className="quotation-settings-summary" role="status">{quotationsSuccess}</p>}
          {quotationsLoading && <p className="status jobs-feedback">Loading quotations and rate defaults...</p>}
          <div className="jobs-table-wrap">
            <table className="jobs-table">
              <thead>
                <tr>
                  {quotationColumns.map(column => (
                    <th key={column.key}>
                      <FilterHeader
                        column={column.label}
                        value={quotationColumnFilters[column.key] || []}
                        onFilter={onQuotationColumnFilter(column.key)}
                        options={columnOptions(quotations, column)}
                        resetPage={false}
                      />
                    </th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.map(quotation => (
                  <tr key={quotation.quotationNo}>
                    <td>
                      {quotation.documentType === 'BILL' ? 'Bill' : 'Quotation'}
                      {Number(quotation.groupCount || 1) > 1 && ` (${quotation.groupPosition}/${quotation.groupCount})`}
                    </td>
                    <td>{quotation.quotationNo}</td>
                    <td>{formattedDate(quotation.quotationDate)}</td>
                    <td>{quotation.customerName}</td>
                    <td>{quotation.mobile}</td>
                    <td>{quotation.transformerCapacity}</td>
                    <td>{quotation.outputFormat || (quotation.pdfUrl ? 'PDF' : 'PNG')}</td>
                    <td className="actions-cell">
                      <button className="btn btn--ghost btn--small btn--icon" aria-label={`View ${quotation.documentType === 'BILL' ? 'bill' : 'quotation'}`} title="View" onClick={() => openQuotation(quotation, 'view')}>
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      <button className="btn btn--ghost btn--small btn--icon" aria-label={`Edit ${quotation.documentType === 'BILL' ? 'bill' : 'quotation'}`} title="Edit" onClick={() => openQuotation(quotation, 'edit')}>
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="m16.5 3.5 4 4L8 20l-5 1 1-5L16.5 3.5Z"/></svg>
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--small btn--icon"
                        aria-label={`Regenerate ${quotation.documentType === 'BILL' ? 'bill' : 'quotation'} ${quotation.quotationNo}`}
                        title={quotationRegeneratingNo === quotation.quotationNo ? 'Regenerating document' : 'Regenerate from saved details'}
                        disabled={Boolean(quotationRegeneratingNo)}
                        onClick={() => regenerateQuotationFile(quotation)}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5"/><path d="M4.9 9a7.5 7.5 0 0 1 12.4-2L20 12M4 17v-5h5"/><path d="M19.1 15a7.5 7.5 0 0 1-12.4 2L4 12"/></svg>
                      </button>
                      <button className="btn btn--danger btn--small btn--icon" aria-label={`Delete ${quotation.documentType === 'BILL' ? 'bill' : 'quotation'}`} title="Delete" onClick={() => deleteQuotation(quotation)}>
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
                      </button>
                      {(quotation.fileUrl || quotation.pdfUrl) && (
                        <>
                          <a className="btn btn--ghost btn--small" href={quotation.fileUrl || quotation.pdfUrl} target="_blank" rel="noreferrer">
                            Open {quotation.outputFormat || (quotation.pdfUrl ? 'PDF' : 'PNG')}
                          </a>
                          <button className="btn btn--secondary btn--small" onClick={() => shareQuotationOnWhatsApp(quotation)}>
                            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
                              <circle cx="12" cy="12" r="12" fill="#25D366"/>
                              <path d="M19.5 11.7a7.5 7.5 0 0 1-11.1 6.6L5 19.2l.9-3.3a7.5 7.5 0 1 1 13.6-4.2Z" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round"/>
                              <path d="M9.1 8.4c-.2-.4-.4-.4-.6-.4H8c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.7 2.2.8 2.6.6 3.1.6.5-.1 1.6-.7 1.8-1.3.2-.7.2-1.2.1-1.3-.1-.1-.3-.2-.7-.4-.3-.2-1.6-.8-1.9-.9-.2-.1-.4-.2-.6.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.1-.4-2.1-1.3-.8-.7-1.3-1.6-1.5-1.9-.1-.3 0-.4.1-.6l.5-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5Z" fill="#fff"/>
                            </svg>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!quotationsLoading && filteredQuotations.length === 0 && (
                  <tr><td colSpan="8">{quotations.length === 0 ? 'No quotations or service bills available. Generate one to get started.' : 'No documents match the selected filters.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showQuotationModal && quotationDraft && (
        <div className="quotation-modal-overlay" onClick={() => setShowQuotationModal(false)}>
          <section
            className="quotation-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quotationModalTitle"
            onClick={event => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="quotation-eyebrow">{quotationDraft.documentType === 'BILL' ? 'Bill' : 'Quotation'}</p>
                <h2 id="quotationModalTitle">
                  {quotationModalMode === 'create'
                    ? `Generate ${quotationDraft.documentType === 'BILL' ? 'Bill' : 'Quotation'}`
                    : `${quotationModalMode === 'edit' ? 'Edit' : 'View'} ${activeQuotation?.quotationNo || ''}`}
                </h2>
              </div>
              <button type="button" className="modal-close" aria-label="Close quotation" onClick={() => setShowQuotationModal(false)}>×</button>
            </div>

            {quotationModalError && <p className="status status--error quotation-modal-error" role="alert">{quotationModalError}</p>}
            {quotationModalMode === 'edit' && activeQuotationGroup.length > 1 && (
              <p className="quotation-settings-summary" role="status">
                This is one linked two-document group. Saving changes will regenerate both numbered pages and their shared PDF.
              </p>
            )}

            {quotationModalMode === 'view' ? (
              <>
                <div className="quotation-document-header">
                  <strong>{activeQuotation.documentType === 'BILL' ? 'BILL' : 'QUOTATION'}</strong>
                  <span>{activeQuotation.documentType === 'BILL' ? 'Bill' : 'Quotation'} No.: {activeQuotation.quotationNo} &nbsp; | &nbsp; Date: {formattedDate(activeQuotation.quotationDate)}</span>
                </div>
                <p className="quotation-preview-subject">
                  {activeQuotation.documentType === 'BILL' ? 'Bill' : 'Quotation'} for {activeQuotation.transformerCapacity} Transformer{activeQuotation.transformerMake ? ` - ${activeQuotation.transformerMake}` : ''}
                </p>
                <div className="quotation-preview-panels">
                  <section className="quotation-preview-panel">
                    <h3>CUSTOMER DETAILS</h3>
                    <p><b>Name:</b> {activeQuotation.customerName || '—'}</p>
                    <p><b>Contact:</b> {activeQuotation.contactPerson || '—'}</p>
                    <p><b>Mobile:</b> {activeQuotation.mobile || '—'}</p>
                    <p><b>Email:</b> {activeQuotation.email || '—'}</p>
                    <p><b>Address:</b> {activeQuotation.customerAddress || '—'}</p>
                  </section>
                  <section className="quotation-preview-panel">
                    <h3>TRANSFORMER DETAILS</h3>
                    <p><b>Make:</b> {activeQuotation.transformerMake || '—'}</p>
                    <p><b>Capacity:</b> {activeQuotation.transformerCapacity || '—'}</p>
                    <p><b>Serial No.:</b> {activeQuotation.transformerSerialNo || '—'}</p>
                    <p><b>Location:</b> {activeQuotation.transformerLocation || '—'}</p>
                  </section>
                </div>
                <div className="jobs-table-wrap quotation-lines-wrap">
                  <table className="jobs-table">
                    <thead><tr><th>#</th><th>Service</th><th>Description of Work / Service</th>{activeQuotation.documentType === 'BILL' ? <><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></> : <th>Rate / Unit</th>}</tr></thead>
                    <tbody>
                      {activeQuotation.lineItems.map((item, index) => (
                        <tr key={`${item.service}-${index}`}>
                          <td>{index + 1}</td><td>{item.service}</td><td>{item.description}</td>
                          {activeQuotation.documentType === 'BILL' && <>
                            <td>{Number(item.quantity || 0).toLocaleString('en-IN')}</td>
                            <td>{item.unit || 'unit'}</td>
                            <td>₹{Number(item.rate || 0).toLocaleString('en-IN')}</td>
                            <td>₹{(Number(item.quantity || 0) * Number(item.rate || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </>}
                          {activeQuotation.documentType !== 'BILL' && <td>₹{Number(item.rate || 0).toLocaleString('en-IN')}{item.service === 'Transformer Oil Filtration' || item.service === 'New Transformer Oil' ? '/litre' : item.service === 'Earth Pit Testing' ? '/pit' : ''}</td>}
                        </tr>
                      ))}
                      {activeQuotation.lineItems.length === 0 && (
                        <tr><td colSpan={activeQuotation.documentType === 'BILL' ? 7 : 4}>No service details.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const subtotal = Math.round(activeQuotation.lineItems.reduce((total, item) => total + (
                    activeQuotation.documentType === 'BILL'
                      ? Number(item.quantity || 0) * Number(item.rate || 0)
                      : Number(item.rate || 0)
                  ), 0) * 100) / 100
                  const gstApplicable = activeQuotation.documentType === 'BILL' && activeQuotation.gstApplicable
                  const gst = gstApplicable ? Math.round(subtotal * Number(activeQuotation.gstRate || 19)) / 100 : 0
                  return <div className="bill-total-summary">
                    <p className="bill-total-words"><span>Amount in words: </span><strong>{indianCurrencyWords(subtotal + gst)}</strong></p>
                    <p><span>Subtotal</span><strong>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                    {gstApplicable && <p><span>GST ({Number(activeQuotation.gstRate || 19)}%)</span><strong>₹{gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>}
                    <p className="bill-grand-total"><span>Total Amount</span><strong>₹{(subtotal + gst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  </div>
                })()}
                {activeQuotation.documentType === 'BILL' && <section className="quotation-editor-section bill-view-terms">
                  <h3>WARRANTY</h3>
                  <p>{activeQuotation.warrantyMonths ? `Valid for ${activeQuotation.warrantyMonths} months from completion / commissioning, limited to the specified work.` : 'Warranty, wherever applicable, will be as specified for the respective work.'}</p>
                  <h3>TERMS &amp; CONDITIONS</h3>
                  <p className="bill-terms-preview">{activeQuotation.terms || '1. This bill covers only the services and materials expressly listed above.\n2. Any work or materials outside the stated scope require prior written approval and may be charged separately.\n3. The customer shall provide safe access, required shutdowns, permits and site facilities for the agreed work.\n4. Warranty, if stated, applies only to the specified work and is subject to the agreed scope and exclusions.\n5. Any concern regarding this bill should be notified in writing within seven days of receipt.\n6. This document is subject to applicable laws and the jurisdiction agreed between the parties.'}</p>
                  <div className="bill-view-signatory">
                    <strong>Digitally Authorized Signatory</strong>
                    <span>M/s D.S. Transformers &amp; Electrical Contractor</span>
                  </div>
                </section>}
                <div className="quotation-modal-actions">
                  {(activeQuotation.fileUrl || activeQuotation.pdfUrl) && (
                    <>
                      <a className="btn btn--primary" href={activeQuotation.fileUrl || activeQuotation.pdfUrl} target="_blank" rel="noreferrer">
                        Open / Download {activeQuotation.outputFormat || (activeQuotation.pdfUrl ? 'PDF' : 'PNG')}
                      </a>
                      <button className="btn btn--secondary" onClick={() => shareQuotationOnWhatsApp(activeQuotation)}>
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
                          <circle cx="12" cy="12" r="12" fill="#25D366"/>
                          <path d="M19.5 11.7a7.5 7.5 0 0 1-11.1 6.6L5 19.2l.9-3.3a7.5 7.5 0 1 1 13.6-4.2Z" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round"/>
                          <path d="M9.1 8.4c-.2-.4-.4-.4-.6-.4H8c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.7 2.2.8 2.6.6 3.1.6.5-.1 1.6-.7 1.8-1.3.2-.7.2-1.2.1-1.3-.1-.1-.3-.2-.7-.4-.3-.2-1.6-.8-1.9-.9-.2-.1-.4-.2-.6.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.1-.4-2.1-1.3-.8-.7-1.3-1.6-1.5-1.9-.1-.3 0-.4.1-.6l.5-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5Z" fill="#fff"/>
                        </svg>
                      </button>
                    </>
                  )}
                  <button className="btn btn--ghost btn--icon" aria-label={`Edit ${activeQuotation.documentType === 'BILL' ? 'bill' : 'quotation'}`} title="Edit" onClick={() => openQuotation(activeQuotation, 'edit')}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="m16.5 3.5 4 4L8 20l-5 1 1-5L16.5 3.5Z"/></svg>
                  </button>
                  <button className="btn btn--danger btn--icon" aria-label={`Delete ${activeQuotation.documentType === 'BILL' ? 'bill' : 'quotation'}`} title="Delete" onClick={() => deleteQuotation(activeQuotation)}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
                  </button>
                </div>
              </>
            ) : (
              <form className="quotation-editor" onSubmit={saveQuotationDraft}>
                <section className="quotation-editor-section">
                  <h3>Customer Details</h3>
                  <div className="quotation-editor-grid">
                    <label>Customer Name<input value={quotationDraft.customerName} onChange={event => updateQuotationDraft('customerName', event.target.value)} required /></label>
                    <label>Customer Address<textarea rows="2" value={quotationDraft.customerAddress} onChange={event => updateQuotationDraft('customerAddress', event.target.value)} /></label>
                    <label>Contact Person<input value={quotationDraft.contactPerson} onChange={event => updateQuotationDraft('contactPerson', event.target.value)} /></label>
                    <label>Mobile<input type="tel" value={quotationDraft.mobile} onChange={event => updateQuotationDraft('mobile', event.target.value)} required /></label>
                    <label>Email<input type="email" value={quotationDraft.email || ''} onChange={event => updateQuotationDraft('email', event.target.value)} /></label>
                    <label>{quotationDraft.documentType === 'BILL' ? 'Bill Date' : 'Quotation Date'}<input type="date" value={quotationDraft.quotationDate} onChange={event => updateQuotationDraft('quotationDate', event.target.value)} required /></label>
                  </div>
                </section>

                <section className="quotation-editor-section">
                  <h3>Transformer Details</h3>
                  <div className="quotation-editor-grid">
                    <label>Transformer Make
                      <DefaultSelect
                        value={quotationDraft.transformerMake}
                        options={dropdownDefaults.makes}
                        placeholder="Select make"
                        onChange={event => updateQuotationDraft('transformerMake', event.target.value)}
                      />
                    </label>
                    <label>Transformer Capacity
                      <DefaultSelect
                        value={quotationDraft.transformerCapacity}
                        options={quotationConfig.capacities}
                        placeholder="Select capacity"
                        onChange={event => updateQuotationCapacity(event.target.value)}
                        required
                      />
                    </label>
                    <label>Transformer Serial No.<input value={quotationDraft.transformerSerialNo} onChange={event => updateQuotationDraft('transformerSerialNo', event.target.value)} /></label>
                    <label>Transformer Location<input value={quotationDraft.transformerLocation} onChange={event => updateQuotationDraft('transformerLocation', event.target.value)} /></label>
                  </div>
                </section>

                <section className="quotation-editor-section">
                  <h3>Services / Rates</h3>
                  <div className="quotation-service-picker">
                    <select value={selectedQuotationService} onChange={event => setSelectedQuotationService(event.target.value)}>
                      <option value="">Select a service to add</option>
                      {quotationConfig.services.filter(service => !quotationDraft.lineItems.some(item => item.service === service)).map(service => (
                        <option key={service} value={service}>{service}</option>
                      ))}
                    </select>
                    <button type="button" className="btn btn--secondary" onClick={addQuotationService} disabled={!selectedQuotationService}>Add Service</button>
                  </div>
                  <div className="jobs-table-wrap quotation-lines-wrap">
                    <table className="jobs-table">
                      <thead><tr><th>Service</th><th>Description of Work / Service</th>{quotationDraft.documentType === 'BILL' && <><th>Quantity</th><th>Unit</th></>}<th>Rate (₹)</th>{quotationDraft.documentType === 'BILL' && <th>Amount (₹)</th>}<th>Action</th></tr></thead>
                      <tbody>
                        {quotationDraft.lineItems.map((item, index) => (
                          <tr key={item.service}>
                            <td>{item.service}</td>
                            <td><input className="quotation-inline-input" value={item.description} onChange={event => updateQuotationLine(index, 'description', event.target.value)} required /></td>
                            {quotationDraft.documentType === 'BILL' && <>
                              <td><input className="quotation-inline-input quotation-rate-input" type="number" min="0.01" step="0.01" aria-label={`${item.service} quantity`} value={item.quantity ?? 1} onChange={event => updateQuotationLine(index, 'quantity', event.target.value)} required /></td>
                              <td><input className="quotation-inline-input" aria-label={`${item.service} unit`} value={item.unit || 'unit'} onChange={event => updateQuotationLine(index, 'unit', event.target.value)} required /></td>
                            </>}
                            <td>
                              <input
                                className="quotation-inline-input quotation-rate-input"
                                aria-label={`${item.service} rate${item.service === 'Transformer Oil Filtration' || item.service === 'New Transformer Oil' ? ' per litre' : item.service === 'Earth Pit Testing' ? ' per pit' : ''}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.rate}
                                onChange={event => updateQuotationLine(index, 'rate', event.target.value)}
                                required
                              />
                              {(item.service === 'Transformer Oil Filtration' || item.service === 'New Transformer Oil') && <small className="quotation-rate-note">Rate per litre</small>}
                              {item.service === 'Earth Pit Testing' && <small className="quotation-rate-note">Rate per pit</small>}
                            </td>
                            {quotationDraft.documentType === 'BILL' && <td>₹{(Number(item.quantity || 0) * Number(item.rate || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>}
                            <td><button type="button" className="btn btn--danger btn--small" onClick={() => removeQuotationLine(item.service)}>Remove</button></td>
                          </tr>
                        ))}
                        {quotationDraft.lineItems.length === 0 && <tr><td colSpan={quotationDraft.documentType === 'BILL' ? 7 : 4}>Select a service above to add it to the document.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>
                {quotationDraft.documentType === 'BILL' && (() => {
                  const subtotal = Math.round(quotationDraft.lineItems.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.rate || 0), 0) * 100) / 100
                  const gst = quotationDraft.gstApplicable ? Math.round(subtotal * Number(quotationDraft.gstRate || 19)) / 100 : 0
                  return <>
                    <section className="quotation-editor-section">
                      <h3>Bill Summary &amp; Warranty</h3>
                      <div className="quotation-editor-grid">
                        <label className="bill-gst-toggle"><input type="checkbox" checked={Boolean(quotationDraft.gstApplicable)} onChange={event => updateQuotationDraft('gstApplicable', event.target.checked)} /> Apply GST at 19% to the total service amount</label>
                        <label>Warranty period (months)<input type="number" min="0" step="1" value={quotationDraft.warrantyMonths || ''} onChange={event => updateQuotationDraft('warrantyMonths', event.target.value)} placeholder="Leave blank if not applicable" /></label>
                      </div>
                      <div className="bill-total-summary">
                        <p><span>Subtotal</span><strong>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                        {quotationDraft.gstApplicable && <p><span>GST (19%)</span><strong>₹{gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>}
                        <p className="bill-grand-total"><span>Total Amount</span><strong>₹{(subtotal + gst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                      </div>
                    </section>
                    <section className="quotation-editor-section">
                      <h3>Terms &amp; Conditions</h3>
                      <textarea className="bill-terms-input" aria-label="Bill terms and conditions" rows="7" value={quotationDraft.terms || ''} onChange={event => updateQuotationDraft('terms', event.target.value)} placeholder="Terms are included automatically if left blank." />
                    </section>
                  </>
                })()}
                <section className="quotation-editor-section">
                  <h3>{quotationDraft.documentType === 'BILL' ? 'Bill Output' : 'Quotation Output'}</h3>
                  <label className="quotation-output-format">
                    File format
                    <select value={quotationDraft.outputFormat || 'PDF'} onChange={event => updateQuotationDraft('outputFormat', event.target.value)}>
                      <option value="PDF">Generate PDF</option>
                      <option value="PNG">Generate PNG</option>
                    </select>
                  </label>
                </section>
                <p className="quotation-financial-year">Financial Year: {quotationDraft.financialYear || quotationConfig.settings['Financial Year']}</p>
                <div className="quotation-modal-actions">
                  <button type="submit" className="btn btn--primary" disabled={quotationSaving}>
                    {quotationSaving
                      ? 'Generating...'
                      : quotationModalMode === 'edit'
                        ? `Save Changes & Generate ${quotationDraft.outputFormat || 'PDF'}`
                        : `Generate ${quotationDraft.outputFormat || 'PDF'}`}
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setShowQuotationModal(false)}>Cancel</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {currentTab === 'transformers' && (
        <section className="panel jobs-panel">
          <div className="panel-header">
            <h2>Transformers Tracker</h2>
            <div className="panel-controls">
              <div className="page-size-row">
                <select
                  className="filter-select"
                  value={pageSize}
                  onChange={(event) => {
                    setPage(0)
                    setPageSize(Number(event.target.value))
                  }}
                >
                  <option value={5}>5 / page</option>
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                </select>
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={exportFilteredTransformers}
                disabled={transformerExportLoading}
              >
                {transformerExportLoading ? 'Exporting...' : 'Export Filtered Excel Sheet'}
              </button>
            </div>
          </div>
          {transformersError && <p className="status status--error jobs-feedback">{transformersError}</p>}
          {transformersLoading && <p className="status jobs-feedback">Loading transformers...</p>}
          <div className="jobs-table-wrap">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>
                    <FilterHeader
                      column="SPM Center"
                      value={spmCenterFilter}
                      onFilter={setSpmCenterFilter}
                      options={transformerOptions.spmCenter}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="DTR No"
                      value={dtrNoFilter}
                      onFilter={setDtrNoFilter}
                      options={transformerOptions.dtrNo}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="SNo"
                      value={sNoFilter}
                      onFilter={setSNoFilter}
                      options={transformerOptions.sNo}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="TNote"
                      value={tNoteFilter}
                      onFilter={setTNoteFilter}
                      options={transformerOptions.tNote}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="Capacity"
                      value={capacityFilter}
                      onFilter={setCapacityFilter}
                      options={transformerOptions.capacity}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="Type"
                      value={typeFilter}
                      onFilter={setTypeFilter}
                      options={transformerOptions.type}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="Status"
                      value={statusFilter}
                      onFilter={setStatusFilter}
                    />
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transformers.map((transformer, index) => (
                  <tr key={`${transformer.id}-${index}`}>
                    <td>{transformer.id}</td>
                    <td>{transformer.spmCenter}</td>
                    <td>{transformer.dtrNo}</td>
                    <td>{transformer.sNo}</td>
                    <td>{transformer.tNoteId ?? '-'}</td>
                    <td>{transformer.capacity}</td>
                    <td>{transformer.type}</td>
                    <td>
                      <span className={`tag tag--${transformer.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {transformer.status}
                      </span>
                    </td>
                    <td className="actions-cell">
                      {getPreviousTransformerStage(transformer) && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--small"
                          onClick={() => moveToPreviousStage(transformer)}
                          disabled={!hasValidTransformerId(transformer)}
                          title={`Move transformer status back to ${getPreviousTransformerStage(transformer)}`}
                        >
                          Back to {getPreviousTransformerStage(transformer)}
                        </button>
                      )}
                      {transformer.assessmentDetails &&
                        !['Delivered', 'Billed'].includes(transformer.status) && (
                          <button
                            type="button"
                            className="btn btn--ghost btn--small btn--icon assessment-edit-button"
                            onClick={() => openAssessmentForm(transformer, 'edit')}
                            disabled={!hasValidTransformerId(transformer)}
                            title="Edit assessment details"
                            aria-label={`Edit assessment details for transformer ${transformer.dtrNo || transformer.id}`}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                            </svg>
                          </button>
                        )}
                      <button
                        className="btn btn--ghost btn--small"
                        onClick={() => moveToNextStage(transformer)}
                        disabled={!hasValidTransformerId(transformer) || ['Repaired', 'Delivered', 'Billed'].includes(transformer.status)}
                        title={!hasValidTransformerId(transformer)
                          ? 'This record has no valid transformer ID.'
                          : ['Repaired', 'Delivered', 'Billed'].includes(transformer.status)
                            ? 'This stage is handled through delivery challan or billing actions.'
                            : `Move to ${getNextTransformerStage(transformer)}`}
                      >
                        {getNextTransformerStage(transformer)}
                      </button>
                    </td>
                  </tr>
                ))}
                {!transformersLoading && transformers.length === 0 && (
                  <tr>
                    <td colSpan="9">No transformers available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination-row">
            <span>
              Showing page {totalPages === 0 ? 0 : page + 1} of {totalPages} ({totalElements} records)
            </span>
            <div className="pagination-actions">
              <button className="btn btn--ghost btn--small" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button
                className="btn btn--ghost btn--small"
                disabled={totalPages === 0 || page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}

      {currentTab === 'tnotes' && (
        <section className="panel jobs-panel">
          <div className="panel-header">
            <h2>TNote Management</h2>
            <div className="panel-controls">
              <div className="page-size-row">
                <select
                  className="filter-select"
                  aria-label="TNotes per page"
                  value={tnotePageSize}
                  onChange={(event) => {
                    setTnotePage(0)
                    setTnotePageSize(Number(event.target.value))
                  }}
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
              <button className="btn btn--primary" onClick={() => {
                setTnoteAttachments([])
                setTnoteError('')
                setShowTNoteModal(true)
              }}>
                Create New TNote
              </button>
            </div>
          </div>
          {tnoteLoading && <p className="status jobs-feedback">Loading TNotes...</p>}
          {tnoteError && <p className="status status--error jobs-feedback">{tnoteError}</p>}
          <div className="jobs-table-wrap">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>
                    <FilterHeader
                      column="TNote No"
                      value={tnoteNoFilter}
                      onFilter={setTnoteNoFilter}
                      options={tnoteOptions.tnoteNo}
                      resetPage={() => setTnotePage(0)}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="SPM Center"
                      value={tnoteSpmCenterFilter}
                      onFilter={setTnoteSpmCenterFilter}
                      options={tnoteOptions.spmCenter}
                      resetPage={() => setTnotePage(0)}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="Date"
                      value={tnoteDateFilter}
                      onFilter={setTnoteDateFilter}
                      options={tnoteOptions.date}
                      resetPage={() => setTnotePage(0)}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="Transformers Count"
                      value={tnoteCountFilter}
                      onFilter={setTnoteCountFilter}
                      options={tnoteOptions.count}
                      resetPage={() => setTnotePage(0)}
                    />
                  </th>
                  <th>Attachments</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTNotes.map((tnote) => (
                  <tr key={tnote.id}>
                    <td>{tnote.tNoteNo || tnote.id}</td>
                    <td>{getTNoteSpmCenter(tnote)}</td>
                    <td>{formattedDate(tnote.date) || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="tnote-count-link"
                        onClick={() => openTNoteDetails(tnote)}
                        aria-label={`View ${tnote.numberOfTransformers} transformers in TNote ${tnote.tNoteNo || tnote.id}`}
                      >
                        {tnote.numberOfTransformers}
                      </button>
                    </td>
                    <td>
                      <div className="tnote-attachment-actions">
                        {renderAttachmentViewerButton(`TNote ${tnote.id}`, tnote.attachments)}
                        <button
                          type="button"
                          className="btn btn--ghost btn--small"
                          onClick={() => openTNoteAttachmentUpload(tnote)}
                          aria-label={`Add attachments to TNote ${tnote.tNoteNo || tnote.id}`}
                          title={Array.isArray(tnote.attachments) && tnote.attachments.length >= MAX_ATTACHMENTS
                            ? 'A TNote can have up to 5 attachments'
                            : 'Add attachments'}
                          disabled={Array.isArray(tnote.attachments) && tnote.attachments.length >= MAX_ATTACHMENTS}
                        >
                          Add upload
                        </button>
                      </div>
                    </td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn--ghost btn--small btn--icon"
                        aria-label={`Export assessment for TNote ${tnote.tNoteNo || tnote.id}`}
                        title="Export Joint Inspection Excel"
                        onClick={() => exportTNoteAssessment(tnote)}
                        disabled={tnoteAssessmentExporting === tnote.id}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 3h11l4 4v14H5z" />
                          <path d="M16 3v5h5M8 12h8M8 16h8M8 8h4" />
                        </svg>
                      </button>
                      <button
                        className="btn btn--danger btn--small btn--icon"
                        aria-label={`Delete TNote ${tnote.tNoteNo || tnote.id}`}
                        title={(tnote.transformers || []).some(transformer => ['delivered', 'billed'].includes(String(transformer.status || '').toLowerCase()))
                          ? 'A TNote linked to a delivered transformer cannot be deleted'
                          : 'Delete TNote'}
                        onClick={() => deleteTNote(tnote.id)}
                        disabled={(tnote.transformers || []).some(transformer => ['delivered', 'billed'].includes(String(transformer.status || '').toLowerCase()))}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredTNotes.length === 0 && (
                  <tr>
                    <td colSpan="6">No TNotes available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination-row">
            <span>
              Showing page {tnoteTotalPages === 0 ? 0 : safeTnotePage + 1} of {tnoteTotalPages} ({sortedTNotes.length} TNotes)
            </span>
            <div className="pagination-actions">
              <button className="btn btn--ghost btn--small" disabled={safeTnotePage === 0} onClick={() => setTnotePage(current => Math.max(0, current - 1))}>
                Previous
              </button>
              <button
                className="btn btn--ghost btn--small"
                disabled={tnoteTotalPages === 0 || safeTnotePage >= tnoteTotalPages - 1}
                onClick={() => setTnotePage(current => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}

      {currentTab === 'dcs' && (
        <section className="panel jobs-panel">
          <div className="panel-header">
            <h2>Delivery Challan Management</h2>
            <button className="btn btn--primary" onClick={openDCModal}>
              Generate Delivery Challan
            </button>
          </div>
          {dcSuccessMessage && <p className="status status--ok jobs-feedback" role="status">{dcSuccessMessage}</p>}
          {dcGenerationError && <p className="status status--error jobs-feedback" role="alert">{dcGenerationError}</p>}
          {dcLoading && <p className="status jobs-feedback">Loading DCs...</p>}
          <div className="jobs-table-wrap">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>
                    <FilterHeader
                      column="DC No"
                      value={dcNoFilter}
                      onFilter={setDcNoFilter}
                      options={dcOptions.dcNo}
                      resetPage={() => setDcPage(0)}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="Date"
                      value={dcDateFilter}
                      onFilter={setDcDateFilter}
                      options={dcOptions.date}
                      resetPage={() => setDcPage(0)}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="SPM Center"
                      value={dcSpmCenterFilter}
                      onFilter={setDcSpmCenterFilter}
                      options={dcOptions.spmCenter}
                      resetPage={() => setDcPage(0)}
                    />
                  </th>
                  <th>Customer</th>
                  <th>TNote No.</th>
                  <th>Sent to TGSPDCL</th>
                  <th>Delivery Status</th>
                  <th>Total No. of Drums</th>
                  <th>Total Transformers</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleDcs.map((dc) => (
                  <tr key={dc.dcNo}>
                    <td>{dc.dcNo}</td>
                    <td>{formattedDate(dc.date) || '—'}</td>
                    <td>{getDCSpmCenter(dc)}</td>
                    <td>{dc.customerName || '—'}</td>
                    <td>{getDCTNoteNumbers(dc) || '—'}</td>
                    <td>{dc.sentToTgspdcl === true ? 'Yes' : dc.sentToTgspdcl === false ? 'No' : '—'}</td>
                    <td>{dc.delivered ? 'Delivered' : 'Not delivered'}</td>
                    <td>{dc.emptyDrumsAvailable === true ? dc.emptyDrumCount || 0 : dc.emptyDrumsAvailable === false ? 0 : '—'}</td>
                    <td>
                      <button
                        className="btn btn--ghost btn--small"
                        onClick={() => openDCDetails(dc.dcNo)}
                        aria-label={`Manage ${dc.totalTransformers || 0} transformers in challan ${dc.dcNo}`}
                        title="View and manage transformers"
                      >
                        {dc.totalTransformers || 0}
                      </button>
                    </td>
                    <td className="actions-cell">
                      {!dc.delivered && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--small btn--icon"
                          onClick={() => openDCDetails(dc.dcNo)}
                          aria-label={`Upload signed challan and mark ${dc.dcNo} as delivered`}
                          title="Upload signed challan and mark as delivered"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12.5 9.5 17 19 7.5" />
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                        </button>
                      )}
                      {dc.generatedChallanUrl && (
                        <a
                          className="btn btn--ghost btn--small btn--icon"
                          href={dc.generatedChallanUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`View generated PDF for ${dc.dcNo}`}
                          title="View generated delivery challan PDF"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6M8 13h8m-8 4h8" />
                          </svg>
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn btn--ghost btn--small btn--icon"
                        onClick={() => generateExistingDCFile(dc.dcNo)}
                        disabled={dcPdfGeneratingNo === dc.dcNo}
                        aria-label={`${dc.generatedChallanUrl ? 'Regenerate' : 'Generate'} PDF for ${dc.dcNo}`}
                        title={dcPdfGeneratingNo === dc.dcNo
                          ? 'Generating delivery challan PDF'
                          : dc.generatedChallanUrl ? 'Regenerate delivery challan PDF' : 'Generate delivery challan PDF'}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                          <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                        </svg>
                      </button>
                      <button className="btn btn--ghost btn--small" onClick={() => openDCDetails(dc.dcNo)}>
                        View
                      </button>
                      <button className="btn btn--danger btn--small" onClick={() => deleteDC(dc.dcNo)} disabled={dc.delivered}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDcs.length === 0 && (
                  <tr>
                    <td colSpan="10">No DCs available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination-row">
            <label>
              Rows per page
              <select
                value={dcPageSize}
                onChange={event => {
                  setDcPage(0)
                  setDcPageSize(Number(event.target.value))
                }}
              >
                {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <span>
              Showing page {dcTotalPages === 0 ? 0 : safeDcPage + 1} of {dcTotalPages} ({sortedDcs.length} delivery challans)
            </span>
            <div className="pagination-actions">
              <button className="btn btn--ghost btn--small" disabled={safeDcPage === 0} onClick={() => setDcPage(current => Math.max(0, current - 1))}>
                Previous
              </button>
              <button
                className="btn btn--ghost btn--small"
                disabled={dcTotalPages === 0 || safeDcPage >= dcTotalPages - 1}
                onClick={() => setDcPage(current => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}

      {showDCModal && (
        <div className="modal-overlay" onClick={() => { if (!dcCreateLoading) setShowDCModal(false) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Generate Delivery Challan</h2>
              <button className="modal-close" onClick={() => setShowDCModal(false)} disabled={dcCreateLoading}>×</button>
            </div>
            <form onSubmit={createDCWithSelection}>
              <div className="form-group">
                <label>SPM Center</label>
                <DefaultSelect
                  name="spmCenter"
                  value={newDC.spmCenter || ''}
                  options={dropdownDefaults.spmCenters}
                  placeholder="Select SPM Center"
                  onChange={event => setDcSpmCenter(event.target.value)}
                  disabled={dcCreateLoading}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="dc-sent-to-tgspdcl">Is this DC being sent to TGSPDCL?</label>
                <select
                  id="dc-sent-to-tgspdcl"
                  value={newDC.sentToTgspdcl === '' ? '' : String(newDC.sentToTgspdcl)}
                  onChange={event => setDcTgspdclDestination(
                    event.target.value === '' ? '' : event.target.value === 'true',
                  )}
                  disabled={dcCreateLoading}
                  required
                >
                  <option value="">Select Yes or No</option>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div className="form-group">
                <label>Customer Name</label>
                <input
                  value={newDC.customerName}
                  onChange={event => setNewDC(current => ({ ...current, customerName: event.target.value }))}
                  autoComplete="organization"
                  required
                  disabled={dcCreateLoading}
                  readOnly={newDC.sentToTgspdcl}
                />
              </div>
              <div className="form-group">
                <label>Customer Address</label>
                <textarea
                  rows="3"
                  value={newDC.customerAddress}
                  onChange={event => setNewDC(current => ({ ...current, customerAddress: event.target.value }))}
                  required
                  disabled={dcCreateLoading}
                  readOnly={newDC.sentToTgspdcl}
                />
              </div>
              <div className="form-group">
                <label>Customer GSTIN</label>
                <input
                  value={newDC.customerGstin}
                  onChange={event => setNewDC(current => ({ ...current, customerGstin: event.target.value.toUpperCase() }))}
                  pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]"
                  maxLength="15"
                  title="Enter a valid 15-character GSTIN."
                  required
                  disabled={dcCreateLoading}
                />
              </div>
              <div className="form-group">
                <label>DC Date</label>
                <input
                  name="date"
                  type="date"
                  value={newDC.date}
                  onChange={(e) => setNewDC(current => ({ ...current, date: e.target.value }))}
                  required
                  disabled={dcCreateLoading}
                />
              </div>
              <div className="form-group">
                <label>Empty oil drums being returned?</label>
                <select
                  value={newDC.emptyDrumsAvailable === '' ? '' : String(newDC.emptyDrumsAvailable)}
                  onChange={event => setNewDC(current => ({
                    ...current,
                    emptyDrumsAvailable: event.target.value === '' ? '' : event.target.value === 'true',
                    emptyDrumCount: event.target.value === 'true' ? current.emptyDrumCount : '',
                  }))}
                  required
                  disabled={dcCreateLoading}
                >
                  <option value="">Select Yes or No</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              {newDC.emptyDrumsAvailable === true && (
                <div className="form-group">
                  <label>Number of empty oil drums</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={newDC.emptyDrumCount}
                    onChange={event => setNewDC(current => ({ ...current, emptyDrumCount: event.target.value }))}
                    required
                    disabled={dcCreateLoading}
                  />
                </div>
              )}
              <h3>Select delivered transformers</h3>
              <p className="status">Select one or more repaired transformers from the selected SPM Center. Linked TNote numbers and dates are shown automatically and saved with the challan.</p>
              {dcFormError && <p className="status status--error" role="alert">{dcFormError}</p>}
              <p className="status">{visibleDCCandidates.length} repaired transformer(s) available.</p>
              <div className="jobs-table-wrap">
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Transformer</th>
                      <th>TNote No.</th>
                      <th>TNote Date</th>
                      <th>SPM Center</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDCCandidates.map((transformer, index) => (
                      <tr key={`${transformer.id}-${index}`}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedDCTransformers.includes(transformer.id)}
                            onChange={() => toggleDCSelection(transformer.id)}
                            disabled={!hasValidTransformerId(transformer) || dcCreateLoading || !newDC.spmCenter}
                          />
                        </td>
                        <td>{[
                          transformer.dtrNo && `DTR ${transformer.dtrNo}`,
                          transformer.sNo && `SNo ${transformer.sNo}`,
                          transformer.capacity && `${transformer.capacity} kVA`,
                          transformer.type,
                          `#${transformer.id}`,
                        ].filter(Boolean).join(' · ')}{getTransformerTNoteDetails(transformer).some(note => note.intakeType === 'RGP') ? ' (RGP)' : ''}</td>
                        <td>{getTransformerTNoteDetails(transformer).map(note => note.tNoteNo).join(', ') || '—'}</td>
                        <td>{getTransformerTNoteDetails(transformer).map(note => formattedDate(note.date) || '—').join(', ') || '—'}</td>
                        <td>{transformer.spmCenter || '—'}</td>
                      </tr>
                    ))}
                    {visibleDCCandidates.length === 0 && (
                      <tr>
                        <td colSpan="5">{newDC.spmCenter
                          ? `No repaired transformers are available for ${newDC.spmCenter}.`
                          : 'Select an SPM Center to view repaired transformers.'}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {selectedDCTransformerDetails.length > 0 && (
                <>
                  <h3>Selected transformer details</h3>
                  <div className="jobs-table-wrap">
                    <table className="jobs-table">
                      <thead>
                        <tr>
                          <th>Transformer</th>
                          <th>TNote No.</th>
                          <th>TNote Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDCTransformerDetails.map(detail => (
                          <tr key={detail.transformerId}>
                            <td>{detail.transformerName}</td>
                            <td>{detail.tNotes.map(note => note.tNoteNo).join(', ') || '—'}</td>
                            <td>{detail.tNotes.map(note => formattedDate(note.date) || '—').join(', ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <div className="modal-actions">
                <button type="submit" className="btn btn--primary" disabled={dcCreateLoading || dcTnoteLoading}>
                  {dcCreateLoading ? 'Generating...' : 'Generate Delivery Challan'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowDCModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDCDetails && (
        <div className="modal-overlay" onClick={closeDCDetails}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>DC {activeDC?.dcNo} Details</h2>
              <button className="modal-close" onClick={closeDCDetails}>×</button>
            </div>
            <div className="form-group">
              <label>DC No</label>
              <input value={activeDC?.dcNo || ''} disabled />
            </div>
            <div className="form-group">
              <label>SPM Center</label>
              <input value={getDCSpmCenter(activeDC || {})} disabled />
            </div>
            <div className="form-group">
              <label>Company GSTIN</label>
              <input value={activeDC?.companyGstin || dropdownDefaults.businessGstin || ''} disabled />
            </div>
            <div className="form-group">
              <label>Customer Name</label>
              <input value={activeDC?.customerName || ''} disabled />
            </div>
            <div className="form-group">
              <label>Customer Address</label>
              <textarea rows="2" value={activeDC?.customerAddress || ''} disabled />
            </div>
            <div className="form-group">
              <label>Customer GSTIN</label>
              <input value={activeDC?.customerGstin || ''} disabled />
            </div>
            <div className="form-group">
              <label>Sent to TGSPDCL</label>
              <input value={activeDC?.sentToTgspdcl === true ? 'Yes' : activeDC?.sentToTgspdcl === false ? 'No' : 'Not recorded'} disabled />
            </div>
            <div className="form-group">
              <label>Delivery Status</label>
              <input value={activeDC?.delivered ? `Delivered${activeDC.deliveredAt ? ` on ${formattedDate(activeDC.deliveredAt)}` : ''}` : 'Not delivered'} disabled />
            </div>
            <div className="form-group">
              <label>TNote No.</label>
              <input value={activeDC?.tNoteNo || ''} disabled />
            </div>
            <div className="form-group">
              <label>Empty Oil Drums Returned</label>
              <input
                value={activeDC?.emptyDrumsAvailable
                  ? `Yes — ${activeDC.emptyDrumCount || 0}`
                  : activeDC?.emptyDrumsAvailable === false ? 'No' : 'Not recorded'}
                disabled
              />
            </div>
            <div className="form-group">
              <label>Date</label>
              {dcEditMode && !activeDC?.delivered ? (
                <input type="date" value={editDCDate} onChange={(e) => setEditDCDate(e.target.value)} />
              ) : (
                <input value={formattedDate(activeDC?.date)} disabled />
              )}
            </div>
            {activeDC?.generatedChallanUrl && (
              <div className="form-group">
                <label>Generated Delivery Challan PDF</label>
                <a href={activeDC.generatedChallanUrl} target="_blank" rel="noreferrer">
                  View generated challan
                </a>
              </div>
            )}
            <div className="modal-actions">
              {dcEditMode && !activeDC?.delivered ? (
                <>
                  <button className="btn btn--primary" onClick={saveDCUpdate}>Save DC</button>
                  <button className="btn btn--ghost" onClick={() => setDcEditMode(false)}>Cancel</button>
                </>
              ) : !activeDC?.delivered ? (
                <button className="btn btn--primary" onClick={() => setDcEditMode(true)}>Edit</button>
              ) : null}
            </div>
            {activeDC?.delivered ? (
              <div className="form-group">
                <label>Signed Delivered Challan</label>
                {renderAttachmentViewerButton(`Delivered challan ${activeDC.dcNo}`, activeDC.attachments)}
                {savedAttachmentLinks(activeDC.attachments)}
              </div>
            ) : (
              <>
                <AttachmentUploadField
                  id="dc-delivered-attachments"
                  attachments={dcDeliveryAttachments}
                  onChange={setDcDeliveryAttachments}
                  onUploadingChange={setDcDeliveryAttachmentReading}
                  disabled={dcMarkDeliveredLoading}
                />
                <div className="modal-actions">
                  <button
                    className="btn btn--primary"
                    type="button"
                    onClick={markActiveDCAsDelivered}
                    disabled={dcMarkDeliveredLoading || dcDeliveryAttachmentReading || dcDeliveryAttachments.length === 0}
                  >
                    {dcMarkDeliveredLoading ? 'Marking delivered...' : 'Mark Challan Delivered'}
                  </button>
                </div>
              </>
            )}
            <h3>Assigned Transformers</h3>
            <div className="form-group">
              <label htmlFor="dc-transformer-target-count">Number of transformers on this challan</label>
              <input
                id="dc-transformer-target-count"
                type="number"
                min="0"
                max={maxDCTargetCount}
                step="1"
                value={dcTargetTransformerCount}
                onChange={event => setDcTargetTransformerCount(event.target.value)}
                disabled={dcTransformerUpdateId !== null || activeDC?.delivered}
                aria-describedby="dc-transformer-count-help"
              />
              <p id="dc-transformer-count-help" className="status">
                Assigned now: {dcDetailTransformers.length}. Set the target count, then add or remove the specific transformers below. The challan count and TNote list update after each change.
              </p>
              {!isDCTargetCountValid && (
                <p className="status status--error" role="alert">
                  Enter a whole number from 0 to {maxDCTargetCount}.
                </p>
              )}
              {isDCTargetCountValid && parsedDCTargetCount !== dcDetailTransformers.length && (
                <p className="status" role="status">
                  {parsedDCTargetCount > dcDetailTransformers.length
                    ? `Add ${parsedDCTargetCount - dcDetailTransformers.length} transformer(s) to reach the target.`
                    : `Remove ${dcDetailTransformers.length - parsedDCTargetCount} transformer(s) to reach the target.`}
                </p>
              )}
            </div>
            {dcDetailError && <p className="status status--error" role="alert">{dcDetailError}</p>}
            <div className="jobs-table-wrap">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Transformer</th>
                    <th>TNote No.</th>
                    <th>TNote Date</th>
                    <th>SPM Center</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dcDetailTransformers.map((transformer, index) => {
                    const savedDetails = activeDC?.transformerDetails?.find(
                      detail => String(detail.transformerId) === String(transformer.id),
                    )
                    const savedTNotes = Array.isArray(savedDetails?.tNotes) && savedDetails.tNotes.length > 0
                      ? savedDetails.tNotes
                      : getTransformerTNoteDetails(transformer)
                    return (
                      <tr key={`${transformer.id}-${index}`}>
                        <td>{transformer.id}</td>
                        <td>{savedDetails?.transformerName || [
                          transformer.dtrNo && `DTR ${transformer.dtrNo}`,
                          transformer.sNo && `SNo ${transformer.sNo}`,
                          transformer.capacity && `${transformer.capacity} kVA`,
                          transformer.type,
                        ].filter(Boolean).join(' · ') || '—'}{savedDetails?.intakeType === 'RGP' ? ' (RGP)' : ''}</td>
                        <td>{savedTNotes.map(note => note.tNoteNo).filter(Boolean).join(', ') || '—'}</td>
                        <td>{savedTNotes.map(note => formattedDate(note.date) || '—').join(', ') || '—'}</td>
                        <td>{transformer.spmCenter}</td>
                        <td>{transformer.status}</td>
                        <td>
                          <div className="actions-cell">
                            <button className="btn btn--ghost btn--small" onClick={() => openEditTransformerModal(transformer)} disabled={!hasValidTransformerId(transformer) || activeDC?.delivered}>
                              Edit
                            </button>
                            <button
                              className="btn btn--danger btn--small"
                              onClick={() => {
                                if (confirm(`Remove transformer ${transformer.id} from ${activeDC.dcNo}? It will return to Repaired, and its original TNote history will be preserved.`)) {
                                  updateDCTransformer(transformer.id, false)
                                }
                              }}
                              disabled={
                                dcTransformerUpdateId !== null ||
                                activeDC?.delivered ||
                                transformer.status !== 'Delivered' ||
                                !isDCTargetCountValid ||
                                dcDetailTransformers.length <= parsedDCTargetCount
                              }
                            >
                              {dcTransformerUpdateId === transformer.id ? 'Updating...' : 'Remove'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {dcDetailTransformers.length === 0 && (
                    <tr>
                      <td colSpan="7">No transformers assigned to this DC yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!activeDC?.delivered && <h3>Add Repaired Transformers</h3>}
            {!activeDC?.delivered && <p className="status">Adding a transformer assigns it to this challan and updates the transformer count and linked TNote numbers. Removing it returns it to Repaired without deleting TNote history.</p>}
            {!activeDC?.delivered && (
            <div className="jobs-table-wrap">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>Transformer</th>
                    <th>TNote No.</th>
                    <th>TNote Date</th>
                    <th>SPM Center</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {availableDCTransformerCandidates
                    .map(candidate => {
                      const notes = getTransformerTNoteDetails(candidate)
                      const validTNote = notes.length > 0 && notes.every(note => note.tNoteNo && note.date)
                      const sameTgspdclCenter = activeDC?.sentToTgspdcl !== true ||
                        String(candidate.spmCenter || '').trim() === String(getDCSpmCenter(activeDC) === '—' ? '' : getDCSpmCenter(activeDC)).trim()
                      return (
                        <tr key={candidate.id}>
                          <td>{[
                            candidate.dtrNo && `DTR ${candidate.dtrNo}`,
                            candidate.sNo && `SNo ${candidate.sNo}`,
                            candidate.capacity && `${candidate.capacity} kVA`,
                            candidate.type,
                            `#${candidate.id}`,
                          ].filter(Boolean).join(' · ')}{notes.some(note => note.intakeType === 'RGP') ? ' (RGP)' : ''}</td>
                          <td>{notes.map(note => note.tNoteNo).join(', ') || '—'}</td>
                          <td>{notes.map(note => formattedDate(note.date) || '—').join(', ') || '—'}</td>
                          <td>{candidate.spmCenter || '—'}</td>
                          <td>
                            <button
                              className="btn btn--primary btn--small"
                              onClick={() => updateDCTransformer(candidate.id, true)}
                              disabled={
                                !validTNote ||
                                !sameTgspdclCenter ||
                                dcTransformerUpdateId !== null ||
                                !isDCTargetCountValid ||
                                dcDetailTransformers.length >= parsedDCTargetCount
                              }
                              title={!validTNote
                                ? 'Transformer requires a linked TNote number and date'
                                : !sameTgspdclCenter ? 'TGSPDCL challans only accept their selected SPM Center' : 'Add to challan'}
                            >
                              {dcTransformerUpdateId === candidate.id ? 'Adding...' : 'Add'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  {availableDCTransformerCandidates.length === 0 && (
                    <tr><td colSpan="5">No other repaired transformers are available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            )}
          </div>
        </div>
      )}

      {assessmentTransformer && (
        <div className="modal-overlay assessment-overlay" onClick={() => {
          if (!assessmentSaving) setAssessmentTransformer(null)
        }}>
          <div className="modal-content assessment-modal" role="dialog" aria-modal="true" aria-labelledby="assessment-title" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="tnote-details-eyebrow">Transformer assessment</p>
                <h2 id="assessment-title">
                  {assessmentMode === 'view' ? 'Assessment details' : assessmentMode === 'edit' ? 'Edit assessment details' : assessmentTransformer.assessmentDetails ? 'Update assessment details' : 'Add assessment details'}
                </h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setAssessmentTransformer(null)} disabled={assessmentSaving} aria-label="Close assessment form">×</button>
            </div>

            <section className="assessment-reference" aria-label="Transformer reference details">
              <div><span>SPM Center</span><strong>{assessmentTransformer.spmCenter || '—'}</strong></div>
              <div><span>DTR No</span><strong>{assessmentTransformer.dtrNo || '—'}</strong></div>
              <div><span>Serial No</span><strong>{assessmentTransformer.sNo || '—'}</strong></div>
              <div><span>Capacity</span><strong>{assessmentTransformer.capacity ? `${assessmentTransformer.capacity} kVA` : '—'}</strong></div>
              <div><span>Type</span><strong>{assessmentTransformer.type || '—'}</strong></div>
              <div><span>Current stage</span><strong>{assessmentTransformer.status}</strong></div>
            </section>

            <form className="assessment-form" onSubmit={submitAssessment}>
              <fieldset className="assessment-readonly-fieldset" disabled={assessmentSaving || assessmentMode === 'view'}>
                <div className="assessment-form-intro">
                  <h3>Inspection and material details</h3>
                  <p>Enter measured values where applicable. Leave fields blank when they do not apply.</p>
                </div>
                <label className="assessment-field">
                  Winding Material
                  <select
                    value={assessmentForm.windingMaterial}
                    onChange={event => setAssessmentForm(current => ({ ...current, windingMaterial: event.target.value }))}
                    required
                  >
                    <option value="">Select material</option>
                    <option value="Al">Al</option>
                    <option value="CU">CU</option>
                  </select>
                </label>
                <label className="assessment-field">
                  First Inspection Date
                  <input
                    type="date"
                    value={assessmentForm.firstInspectionDate}
                    onChange={event => setAssessmentForm(current => ({ ...current, firstInspectionDate: event.target.value }))}
                    required
                  />
                </label>

              <fieldset className="assessment-group">
                <legend>HV Coils</legend>
                <label className="assessment-field">No. of coils damaged<input type="number" min="0" step="1" value={assessmentForm.hvDamagedCoils} onChange={event => setAssessmentForm(current => ({ ...current, hvDamagedCoils: event.target.value }))} disabled={assessmentSaving} /></label>
                <label className="assessment-field">Wt. of old coils<input type="number" min="0" step="0.01" value={assessmentForm.hvOldCoilWeight} onChange={event => setAssessmentForm(current => ({ ...current, hvOldCoilWeight: event.target.value }))} disabled={assessmentSaving} /></label>
                <label className="assessment-field">Wt. of new coils<input type="number" min="0" step="0.01" value={assessmentForm.hvNewCoilWeight} onChange={event => setAssessmentForm(current => ({ ...current, hvNewCoilWeight: event.target.value }))} disabled={assessmentSaving} /></label>
              </fieldset>

              <fieldset className="assessment-group">
                <legend>LV Coils</legend>
                <label className="assessment-field">No. of reinsulated coils<input type="number" min="0" step="1" value={assessmentForm.lvReinsulatedCoils} onChange={event => setAssessmentForm(current => ({ ...current, lvReinsulatedCoils: event.target.value }))} disabled={assessmentSaving} /></label>
                <label className="assessment-field">Wt. of old coils<input type="number" min="0" step="0.01" value={assessmentForm.lvOldCoilWeight} onChange={event => setAssessmentForm(current => ({ ...current, lvOldCoilWeight: event.target.value }))} disabled={assessmentSaving} /></label>
                <label className="assessment-field">Wt. of new coils<input type="number" min="0" step="0.01" value={assessmentForm.lvNewCoilWeight} onChange={event => setAssessmentForm(current => ({ ...current, lvNewCoilWeight: event.target.value }))} disabled={assessmentSaving} /></label>
              </fieldset>

              <fieldset className="assessment-group assessment-group--paired">
                <legend>Bushings</legend>
                <label className="assessment-field">LV<input type="number" min="0" step="1" value={assessmentForm.bushingsLv} onChange={event => setAssessmentForm(current => ({ ...current, bushingsLv: event.target.value }))} disabled={assessmentSaving} /></label>
                <label className="assessment-field">HV<input type="number" min="0" step="1" value={assessmentForm.bushingsHv} onChange={event => setAssessmentForm(current => ({ ...current, bushingsHv: event.target.value }))} disabled={assessmentSaving} /></label>
              </fieldset>

              <fieldset className="assessment-group assessment-group--paired">
                <legend>Bush rods</legend>
                <label className="assessment-field">LV<input type="number" min="0" step="1" value={assessmentForm.bushRodsLv} onChange={event => setAssessmentForm(current => ({ ...current, bushRodsLv: event.target.value }))} disabled={assessmentSaving} /></label>
                <label className="assessment-field">HV<input type="number" min="0" step="1" value={assessmentForm.bushRodsHv} onChange={event => setAssessmentForm(current => ({ ...current, bushRodsHv: event.target.value }))} disabled={assessmentSaving} /></label>
              </fieldset>

              <fieldset className="assessment-group assessment-group--paired">
                <legend>Metal parts</legend>
                <label className="assessment-field">HV<input type="number" min="0" step="1" value={assessmentForm.metalPartsHv} onChange={event => setAssessmentForm(current => ({ ...current, metalPartsHv: event.target.value }))} disabled={assessmentSaving} /></label>
                <label className="assessment-field">LV<input type="number" min="0" step="1" value={assessmentForm.metalPartsLv} onChange={event => setAssessmentForm(current => ({ ...current, metalPartsLv: event.target.value }))} disabled={assessmentSaving} /></label>
              </fieldset>

              <fieldset className="assessment-group assessment-group--paired">
                <legend>Other assessment</legend>
                <label className="assessment-field">Breakers<input type="number" min="0" step="1" value={assessmentForm.breakers} onChange={event => setAssessmentForm(current => ({ ...current, breakers: event.target.value }))} disabled={assessmentSaving} /></label>
                <label className="assessment-field">Oil capacity<input type="number" min="0" step="0.01" value={assessmentForm.oilCapacity} onChange={event => setAssessmentForm(current => ({ ...current, oilCapacity: event.target.value }))} disabled={assessmentSaving} /></label>
                <label className="assessment-field">Oil less<input type="number" min="0" step="0.01" value={assessmentForm.oilLess} onChange={event => setAssessmentForm(current => ({ ...current, oilLess: event.target.value }))} disabled={assessmentSaving} /></label>
                <label className="assessment-field assessment-field--wide">Remarks<textarea rows="3" value={assessmentForm.remarks} onChange={event => setAssessmentForm(current => ({ ...current, remarks: event.target.value }))} disabled={assessmentSaving} /></label>
              </fieldset>
              </fieldset>

              {assessmentError && <p className="status status--error assessment-error" role="alert">{assessmentError}</p>}
              <div className="modal-actions assessment-actions">
                {assessmentMode === 'view' ? (
                  <button type="button" className="btn btn--primary" onClick={() => setAssessmentMode('edit')}>
                    Edit assessment
                  </button>
                ) : (
                  <>
                    <button type="submit" className="btn btn--primary" disabled={assessmentSaving}>
                      {assessmentSaving
                        ? 'Saving assessment...'
                        : assessmentMode === 'stage'
                          ? 'Save and move to Assessment'
                          : 'Save changes'}
                    </button>
                    {!['Delivered', 'Billed', 'Scrap'].includes(assessmentTransformer.status) && (
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={markAssessmentTransformerAsScrap}
                        disabled={assessmentSaving}
                      >
                        Mark as Scrap
                      </button>
                    )}
                  </>
                )}
                <button type="button" className="btn btn--ghost" onClick={() => setAssessmentTransformer(null)} disabled={assessmentSaving}>
                  {assessmentMode === 'create' ? 'Cancel' : 'Close'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditTransformerModal && editingTransformer && (
        <div className={`modal-overlay${activeTNote ? ' transformer-edit-overlay' : ''}`} onClick={closeEditTransformerModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Transformer #{editingTransformer.id}</h2>
              <button className="modal-close" onClick={closeEditTransformerModal}>×</button>
            </div>
            <form onSubmit={saveTransformerUpdate}>
              <div className="form-group">
                <label>SPM Center</label>
                <DefaultSelect
                  value={editingTransformer.spmCenter || ''}
                  options={dropdownDefaults.spmCenters}
                  placeholder="Select SPM Center"
                  onChange={(e) => handleEditTransformerChange('spmCenter', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>DTR No</label>
                <input
                  value={editingTransformer.dtrNo || ''}
                  onChange={(e) => handleEditTransformerChange('dtrNo', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>SNo</label>
                <input
                  value={editingTransformer.sNo || ''}
                  onChange={(e) => handleEditTransformerChange('sNo', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Capacity</label>
                <DefaultSelect
                  value={String(editingTransformer.capacity || '')}
                  options={transformerCapacityOptions}
                  placeholder="Select Capacity"
                  onChange={(e) => handleEditTransformerChange('capacity', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Type</label>
                <input
                  value={editingTransformer.type || ''}
                  onChange={(e) => handleEditTransformerChange('type', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Oil Capacity</label>
                <input
                  type="number"
                  step="0.1"
                  value={editingTransformer.oilCapacity || ''}
                  onChange={(e) => handleEditTransformerChange('oilCapacity', e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn--primary">Save Transformer</button>
                <button type="button" className="btn btn--ghost" onClick={closeEditTransformerModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBillDetails && (
        <div className="modal-overlay" onClick={closeBillDetails}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bill {activeBill?.sapNo} Details</h2>
              <button className="modal-close" onClick={closeBillDetails}>×</button>
            </div>
            <div className="form-group">
              <label>SAP No</label>
              <input value={activeBill?.sapNo || ''} disabled />
            </div>
            <div className="form-group">
              <label>Agreement No</label>
              {billEditMode ? (
                <input
                  value={billEditDraft?.agreementNo || ''}
                  onChange={event => setBillEditDraft(current => ({ ...current, agreementNo: event.target.value }))}
                  required
                />
              ) : (
                <input value={activeBill?.agreementNo || '—'} disabled />
              )}
            </div>
            <div className="form-group">
              <label>Date</label>
              {billEditMode ? (
                <input
                  type="date"
                  value={billEditDraft?.date || ''}
                  onChange={event => setBillEditDraft(current => ({ ...current, date: event.target.value }))}
                  required
                />
              ) : (
                <input value={formattedDate(activeBill?.date)} disabled />
              )}
            </div>
            <div className="form-group">
              <label>SPM Center</label>
              {billEditMode ? (
                <DefaultSelect
                  value={billEditDraft?.spmCenter || ''}
                  options={dropdownDefaults.spmCenters}
                  placeholder="Select SPM Center"
                  onChange={event => setBillEditDraft(current => ({ ...current, spmCenter: event.target.value }))}
                  required
                />
              ) : (
                <input value={activeBill?.spmCenter || ''} disabled />
              )}
            </div>
            <div className="form-group">
              <label>Total Transformers</label>
              <input value={activeBill?.totalTransformers || ''} disabled />
            </div>
            <div className="form-group">
              <label>Bill Amount</label>
              {billEditMode ? (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={billEditDraft?.billAmount ?? ''}
                  onChange={event => setBillEditDraft(current => ({ ...current, billAmount: event.target.value }))}
                  required
                />
              ) : (
                <input value={activeBill?.billAmount ? `₹${activeBill.billAmount.toLocaleString()}` : ''} disabled />
              )}
            </div>
            <div className="form-group">
              <label>GST Amount</label>
              {billEditMode ? (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={billEditDraft?.gstAmount ?? ''}
                  onChange={event => setBillEditDraft(current => ({ ...current, gstAmount: event.target.value }))}
                  required
                />
              ) : (
                <input value={activeBill?.gstAmount ? `₹${activeBill.gstAmount.toLocaleString()}` : '₹0'} disabled />
              )}
            </div>
            <div className="form-group">
              <label>Bill Status</label>
              <input value={(activeBill?.status || 'PENDING').replace('_', ' ')} disabled />
            </div>
            {(activeBill?.status || 'PENDING') !== 'PENDING' && (
              <>
                <div className="form-group">
                  <label>Amount Credited</label>
                  <input value={activeBill?.amountCredited == null ? '' : `₹${Number(activeBill.amountCredited).toLocaleString()}`} disabled />
                </div>
                <div className="form-group">
                  <label>Credited Date</label>
                  <input value={formattedDate(activeBill?.creditedDate)} disabled />
                </div>
              </>
            )}
            {activeBill?.status === 'GST_FILED' && (
              <>
                <div className="form-group">
                  <label>GST Filing Month</label>
                  <input value={activeBill.gstFilingMonth || ''} disabled />
                </div>
                <div className="form-group">
                  <label>Invoice No</label>
                  <input value={activeBill.invoiceNo || ''} disabled />
                </div>
              </>
            )}
            {(!activeBill?.status || activeBill.status === 'PENDING') && (
              <section className="bill-status-update">
                <h3>Mark Bill Received</h3>
                <div className="form-group">
                  <label htmlFor="bill-credited-amount">Amount Credited</label>
                  <input
                    id="bill-credited-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={billReceiptAmount}
                    onChange={event => setBillReceiptAmount(event.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="bill-credited-date">Credited Date</label>
                  <input
                    id="bill-credited-date"
                    type="date"
                    value={billReceiptDate}
                    onChange={event => setBillReceiptDate(event.target.value)}
                    required
                  />
                </div>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => updateBillStatus('RECEIVED')}
                  disabled={billStatusSaving || !billReceiptAmount || Number(billReceiptAmount) <= 0 || !billReceiptDate}
                >
                  {billStatusSaving ? 'Saving...' : 'Mark Bill Received'}
                </button>
              </section>
            )}
            {activeBill?.status === 'RECEIVED' && (
              <section className="bill-status-update">
                <h3>Mark GST Filed</h3>
                <div className="form-group">
                  <label htmlFor="bill-gst-filing-month">GST Filing Month</label>
                  <input
                    id="bill-gst-filing-month"
                    type="month"
                    value={billGstFilingMonth}
                    onChange={event => setBillGstFilingMonth(event.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="bill-invoice-no">Invoice No</label>
                  <input
                    id="bill-invoice-no"
                    value={billInvoiceNo}
                    onChange={event => setBillInvoiceNo(event.target.value)}
                    required
                  />
                </div>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => updateBillStatus('GST_FILED')}
                  disabled={billStatusSaving || !billGstFilingMonth || !billInvoiceNo.trim()}
                >
                  {billStatusSaving ? 'Saving...' : 'Mark GST Filed'}
                </button>
              </section>
            )}
            {billStatusError && <p className="status status--error" role="alert">{billStatusError}</p>}
            <div className="form-group">
              <label>Attachments</label>
              {savedAttachmentLinks(activeBill?.attachments)}
            </div>
            <div className="modal-actions">
              {billEditMode ? (
                <>
                  <button
                    className="btn btn--primary"
                    onClick={saveBillUpdate}
                    disabled={
                      !billEditDraft?.agreementNo?.trim() ||
                      !billEditDraft?.date ||
                      !billEditDraft?.spmCenter ||
                      String(billEditDraft?.billAmount ?? '').trim() === '' ||
                      String(billEditDraft?.gstAmount ?? '').trim() === '' ||
                      !Number.isFinite(Number(billEditDraft?.billAmount)) ||
                      !Number.isFinite(Number(billEditDraft?.gstAmount)) ||
                      Number(billEditDraft?.billAmount) < 0 ||
                      Number(billEditDraft?.gstAmount) < 0
                    }
                  >
                    Save Bill
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => {
                      setBillEditDraft({
                        agreementNo: activeBill?.agreementNo || '',
                        date: activeBill?.date || '',
                        spmCenter: activeBill?.spmCenter || '',
                        billAmount: activeBill?.billAmount ?? 0,
                        gstAmount: activeBill?.gstAmount ?? 0,
                      })
                      setBillEditMode(false)
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button className="btn btn--primary" onClick={() => setBillEditMode(true)}>Edit</button>
              )}
            </div>
            <h3>Assigned Transformers</h3>
            <div className="jobs-table-wrap">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>TNote No</th>
                    <th>SPM Center</th>
                    <th>DTR No</th>
                    <th>SNo</th>
                    <th>Capacity</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {billDetailTransformers.map((transformer, index) => (
                    <tr key={`${transformer.id}-${index}`}>
                      <td>{transformer.id}</td>
                      <td>{getTransformerTNoteDetails(transformer).map(note => note.tNoteNo).join(', ') || '—'}</td>
                      <td>{transformer.spmCenter}</td>
                      <td>{transformer.dtrNo}</td>
                      <td>{transformer.sNo}</td>
                      <td>{transformer.capacity}</td>
                      <td>{transformer.type}</td>
                      <td>{transformer.status}</td>
                      <td>
                        <button className="btn btn--ghost btn--small" onClick={() => openEditTransformerModal(transformer)} disabled={!hasValidTransformerId(transformer)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {billDetailTransformers.length === 0 && (
                    <tr>
                      <td colSpan="9">No transformers assigned to this Bill yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'bills' && (
        <section className="panel jobs-panel">
          <div className="panel-header">
            <h2>Bill Management</h2>
            <button className="btn btn--primary" onClick={openBillModal}>
              Create New Bill
            </button>
          </div>
          {billLoading && <p className="status jobs-feedback">Loading Bills...</p>}
          {billExportError && <p className="status status--error" role="alert">{billExportError}</p>}
          <div className="jobs-table-wrap">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>
                    <FilterHeader
                      column="SAP No"
                      value={billSapFilter}
                      onFilter={setBillSapFilter}
                      options={billOptions.sapNo}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="Date"
                      value={billDateFilter}
                      onFilter={setBillDateFilter}
                      options={billOptions.date}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="SPM Center"
                      value={billSpmCenterFilter}
                      onFilter={setBillSpmCenterFilter}
                      options={billOptions.spmCenter}
                    />
                  </th>
                  <th>Agreement No</th>
                  <th>Total Transformers</th>
                  <th>Bill Amount</th>
                  <th>GST Amount</th>
                  <th>Status</th>
                  <th>Attachments</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedBills.map((bill, index) => (
                  <tr key={`${bill.sapNo || 'bill'}-${index}`}>
                    <td>{bill.sapNo}</td>
                    <td>{formattedDate(bill.date) || '—'}</td>
                    <td>{bill.spmCenter}</td>
                    <td>{bill.agreementNo || '—'}</td>
                    <td>{bill.totalTransformers}</td>
                    <td>{bill.billAmount ? `₹${bill.billAmount.toLocaleString()}` : '-'}</td>
                    <td>{bill.gstAmount ? `₹${bill.gstAmount.toLocaleString()}` : '-'}</td>
                    <td>{(bill.status || 'PENDING').replace('_', ' ')}</td>
                    <td>{renderAttachmentViewerButton(`Bill ${bill.sapNo}`, bill.attachments)}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn--ghost btn--small btn--icon"
                        aria-label={`Export bill ${bill.sapNo} with transformer details`}
                        title="Export bill and transformer details to Excel"
                        onClick={() => exportBill(bill.sapNo)}
                        disabled={billExportingSapNo === bill.sapNo}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                          <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                        </svg>
                      </button>
                      <button className="btn btn--ghost btn--small" onClick={() => openBillDetails(bill.sapNo)}>
                        View
                      </button>
                      <button className="btn btn--ghost btn--small" onClick={() => openBillDetails(bill.sapNo, true)}>
                        Edit
                      </button>
                      <button className="btn btn--danger btn--small" onClick={() => deleteBill(bill.sapNo)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredBills.length === 0 && (
                  <tr>
                    <td colSpan="10">No Bills available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showBillModal && (
        <div className="modal-overlay" onClick={closeBillModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Bill</h2>
              <button className="modal-close" onClick={closeBillModal}>×</button>
            </div>
            <form onSubmit={createBillWithSelection}>
              <div className="form-group">
                <label>SAP No</label>
                <input
                  name="sapNo"
                  value={newBill.sapNo}
                  onChange={(e) => setNewBill({ ...newBill, sapNo: e.target.value })}
                  placeholder="SAP-001"
                  required
                />
              </div>
              <div className="form-group">
                <label>Agreement No</label>
                <input
                  name="agreementNo"
                  value={newBill.agreementNo}
                  onChange={(e) => setNewBill({ ...newBill, agreementNo: e.target.value })}
                  placeholder="Enter agreement number"
                  required
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  name="date"
                  type="date"
                  value={newBill.date}
                  onChange={(e) => setNewBill({ ...newBill, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>SPM Center</label>
                <DefaultSelect
                  name="spmCenter"
                  value={newBill.spmCenter}
                  options={dropdownDefaults.spmCenters}
                  placeholder="Select SPM Center"
                  onChange={(e) => setBillSpmCenter(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Total Transformers (Auto-calculated)</label>
                <input
                  name="totalTransformers"
                  type="text"
                  value={selectedBillTransformers.length}
                  disabled
                />
              </div>
              <div className="form-group">
                <label>Bill Amount</label>
                <input
                  name="billAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newBill.billAmount}
                  onChange={(e) => setNewBill({ ...newBill, billAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="50000"
                  required
                />
              </div>
              <div className="form-group">
                <label>GST Amount</label>
                <input
                  name="gstAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newBill.gstAmount}
                  onChange={(e) => setNewBill({ ...newBill, gstAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  required
                />
              </div>
              <AttachmentUploadField
                id="bill-attachments"
                attachments={billAttachments}
                onChange={setBillAttachments}
                onUploadingChange={setBillAttachmentReading}
                label="Upload Bill (photos or PDFs)"
                disabled={billCreateLoading}
              />
              {billFormError && <p className="status status--error" role="alert">{billFormError}</p>}
              <h3>Select delivered transformers</h3>
              <div className="jobs-table-wrap">
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>ID</th>
                      <th>TNote No</th>
                      <th>SPM Center</th>
                      <th>DTR No</th>
                      <th>SNo</th>
                      <th>Capacity</th>
                      <th>Type</th>
                      <th>DC No</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBillCandidates.map((transformer, index) => (
                      <tr key={`${transformer.id}-${index}`}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedBillTransformers.includes(transformer.id)}
                            onChange={() => toggleBillSelection(transformer.id)}
                            disabled={!hasValidTransformerId(transformer)}
                          />
                        </td>
                        <td>{transformer.id}</td>
                        <td>{getTransformerTNoteDetails(transformer).map(note => note.tNoteNo).join(', ') || '—'}</td>
                        <td>{transformer.spmCenter}</td>
                        <td>{transformer.dtrNo}</td>
                        <td>{transformer.sNo}</td>
                        <td>{transformer.capacity}</td>
                        <td>{transformer.type}</td>
                        <td>{transformer.dcNo ?? '-'}</td>
                      </tr>
                    ))}
                    {visibleBillCandidates.length === 0 && (
                      <tr>
                        <td colSpan="9">{newBill.spmCenter ? 'No delivered transformers are available for this SPM Center.' : 'Select an SPM Center to view delivered transformers.'}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn--primary" disabled={billCreateLoading || billAttachmentReading}>
                  {billCreateLoading ? 'Creating...' : billAttachmentReading ? 'Reading attachments...' : 'Create Bill and Assign'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={closeBillModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTNoteDetails && activeTNote && (
        <div className="modal-overlay tnote-details-overlay" onClick={closeTNoteDetails}>
          <div className="modal-content tnote-details-modal" role="dialog" aria-modal="true" aria-labelledby="tnote-details-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="tnote-details-eyebrow">Transformer inward record</p>
                <h2 id="tnote-details-title">TNote {activeTNote.tNoteNo || activeTNote.id}</h2>
              </div>
              <button className="modal-close" onClick={closeTNoteDetails} aria-label="Close TNote details">×</button>
            </div>
            <div className="tnote-details-summary">
              <div><span>TNote Date</span><strong>{formattedDate(activeTNote.date) || '—'}</strong></div>
              <div><span>Transformers</span><strong>{activeTNote.transformers?.length || 0}</strong></div>
              <div><span>SPM Centers</span><strong>{getTNoteSpmCenter(activeTNote)}</strong></div>
            </div>
            {tnoteTransformerError && <p className="status status--error" role="alert">{tnoteTransformerError}</p>}
            <div className="tnote-transformer-section">
              <div className="tnote-transformer-section-heading">
                <div>
                  <h3>Transformers in this TNote</h3>
                  <p className="tnote-transformer-intake-note">A TNote can contain both new transformers and RGP returns; intake type is tracked separately for each transformer.</p>
                </div>
                <button
                  type="button"
                  className="btn btn--primary btn--small"
                  onClick={() => {
                    setNewTNoteTransformerError('')
                    setShowAddTNoteTransformer(current => !current)
                  }}
                  disabled={addingTNoteTransformer}
                >
                  {showAddTNoteTransformer ? 'Cancel Add' : '+ Add Transformer'}
                </button>
              </div>
              {showAddTNoteTransformer && (
                <div className="tnote-intake-panel">
                  <div className="tnote-intake-modes" role="group" aria-label="Transformer intake type">
                    <button
                      type="button"
                      className={`btn btn--small ${tNoteIntakeMode === 'NEW' ? 'btn--primary' : 'btn--ghost'}`}
                      onClick={() => {
                        setTNoteIntakeMode('NEW')
                        setRgpManualEntry(false)
                        setNewTNoteTransformerError('')
                      }}
                      disabled={addingTNoteTransformer}
                    >
                      New Transformer
                    </button>
                    <button
                      type="button"
                      className={`btn btn--small ${tNoteIntakeMode === 'RGP' ? 'btn--primary' : 'btn--ghost'}`}
                      onClick={() => {
                        setTNoteIntakeMode('RGP')
                        setRgpManualEntry(false)
                        setRgpLookupResults([])
                        setRgpLookupPerformed(false)
                        setNewTNoteTransformerError('')
                      }}
                      disabled={addingTNoteTransformer}
                    >
                      RGP Return
                    </button>
                  </div>
                  {tNoteIntakeMode === 'RGP' && !rgpManualEntry && (
                    <div className="tnote-rgp-lookup">
                      <p>Search by the exact DTR number or serial number to find and link an existing transformer to its asset history.</p>
                      <form className="tnote-rgp-search-form" onSubmit={searchRgpTransformer}>
                        <label>
                          Search by
                          <select value={rgpLookupField} onChange={event => setRgpLookupField(event.target.value)} disabled={rgpLookupLoading || addingTNoteTransformer}>
                            <option value="dtrNo">DTR No</option>
                            <option value="sNo">Serial No</option>
                          </select>
                        </label>
                        <label>
                          {rgpLookupField === 'dtrNo' ? 'DTR No' : 'Serial No'}
                          <input
                            value={rgpLookupValue}
                            onChange={event => setRgpLookupValue(event.target.value)}
                            required
                            disabled={rgpLookupLoading || addingTNoteTransformer}
                          />
                        </label>
                        <button type="submit" className="btn btn--primary" disabled={rgpLookupLoading || addingTNoteTransformer || !rgpLookupValue.trim()}>
                          {rgpLookupLoading ? 'Searching...' : 'Search Transformer'}
                        </button>
                      </form>
                      {rgpLookupPerformed && rgpLookupResults.length > 0 && (
                        <div className="tnote-rgp-results" aria-live="polite">
                          <p>{rgpLookupResults.length} exact match{rgpLookupResults.length === 1 ? '' : 'es'} found. Confirm the correct asset:</p>
                          {rgpLookupResults.map(transformer => (
                            <div className="tnote-rgp-result" key={transformer.id}>
                              <span><strong>{transformer.dtrNo || 'No DTR No'}</strong> · S/N {transformer.sNo || '—'} · {transformer.capacity || '—'} kVA · {transformer.spmCenter || '—'} · {transformer.status || '—'}</span>
                              <button type="button" className="btn btn--primary btn--small" onClick={() => linkExistingRgpTransformer(transformer)} disabled={addingTNoteTransformer}>
                                {addingTNoteTransformer ? 'Linking...' : 'Link as RGP'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {rgpLookupPerformed && rgpLookupResults.length === 0 && (
                        <div className="tnote-rgp-no-match" role="status">
                          <p>No existing transformer matched that value. You can add it as a new RGP record without linking it to a previous transformer.</p>
                          <button
                            type="button"
                            className="btn btn--ghost btn--small"
                            onClick={() => {
                              setNewTNoteTransformerError('')
                              setRgpManualEntry(true)
                            }}
                            disabled={addingTNoteTransformer}
                          >
                            Add Transformer Manually
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {newTNoteTransformerError && <p className="status status--error tnote-add-transformer-error" role="alert">{newTNoteTransformerError}</p>}
                  {(tNoteIntakeMode === 'NEW' || rgpManualEntry) && (
                    <form className="tnote-add-transformer-form" onSubmit={addTransformerToTNote}>
                      {rgpManualEntry && <p className="tnote-rgp-manual-note">This creates a separate transformer record for this non-billable RGP visit; it will not be linked to a previous transformer record.</p>}
                  <label>
                    SPM Center
                    <DefaultSelect
                      value={newTNoteTransformer.spmCenter}
                      options={dropdownDefaults.spmCenters}
                      placeholder="Select SPM Center"
                      onChange={event => setNewTNoteTransformer(current => ({ ...current, spmCenter: event.target.value }))}
                      required
                      disabled={addingTNoteTransformer}
                    />
                  </label>
                  <label>
                    DTR No
                    <input
                      value={newTNoteTransformer.dtrNo}
                      onChange={event => setNewTNoteTransformer(current => ({ ...current, dtrNo: event.target.value }))}
                      required
                      disabled={addingTNoteTransformer}
                    />
                  </label>
                  <label>
                    Serial No
                    <input
                      value={newTNoteTransformer.sNo}
                      onChange={event => setNewTNoteTransformer(current => ({ ...current, sNo: event.target.value }))}
                      required
                      disabled={addingTNoteTransformer}
                    />
                  </label>
                  <label>
                    Capacity
                    <DefaultSelect
                      value={String(newTNoteTransformer.capacity)}
                      options={transformerCapacityOptions}
                      placeholder="Select Capacity"
                      onChange={event => setNewTNoteTransformer(current => ({ ...current, capacity: event.target.value }))}
                      required
                      disabled={addingTNoteTransformer}
                    />
                  </label>
                  <label>
                    Type
                    <input
                      value={newTNoteTransformer.type}
                      onChange={event => setNewTNoteTransformer(current => ({ ...current, type: event.target.value }))}
                      required
                      disabled={addingTNoteTransformer}
                    />
                  </label>
                  <label>
                    Oil Capacity
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={newTNoteTransformer.oilCapacity}
                      onChange={event => setNewTNoteTransformer(current => ({ ...current, oilCapacity: event.target.value }))}
                      required
                      disabled={addingTNoteTransformer}
                    />
                  </label>
                  <div className="tnote-add-transformer-actions">
                    <button type="submit" className="btn btn--primary" disabled={addingTNoteTransformer}>
                      {addingTNoteTransformer ? 'Adding Transformer...' : rgpManualEntry ? 'Register RGP Transformer' : 'Save Transformer'}
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={() => {
                      if (rgpManualEntry) setRgpManualEntry(false)
                      else setShowAddTNoteTransformer(false)
                    }} disabled={addingTNoteTransformer}>
                      {rgpManualEntry ? 'Back to Search' : 'Cancel'}
                    </button>
                  </div>
                    </form>
                  )}
                </div>
              )}
              <div className="jobs-table-wrap">
                <table className="jobs-table tnote-transformers-table">
                  <thead>
                    <tr>
                      <th>SPM Center</th>
                      <th>DTR No</th>
                      <th>Serial No</th>
                      <th>Capacity</th>
                      <th>Type</th>
                      <th>Transformer Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeTNote.transformers || []).map((transformer) => (
                      <tr key={transformer.id}>
                        <td>{transformer.spmCenter || '—'}</td>
                        <td>{transformer.dtrNo || '—'}</td>
                        <td>{transformer.sNo || '—'}</td>
                        <td>{transformer.capacity || '—'}</td>
                        <td>{transformer.type || '—'}</td>
                        <td>
                          <span className={`tag tag--${(transformer.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{transformer.status || '—'}</span>
                          {['Recieved', 'Assesment', 'Repair In Progress'].includes(transformer.status) && (
                            <button
                              type="button"
                              className="btn btn--ghost btn--small tnote-next-status"
                              onClick={() => moveToNextStage(transformer)}
                              disabled={!hasValidTransformerId(transformer)}
                              title={`Advance transformer status to ${getNextTransformerStage(transformer)}`}
                            >
                              {getNextTransformerStage(transformer)}
                            </button>
                          )}
                          {getPreviousTransformerStage(transformer) && (
                            <button
                              type="button"
                              className="btn btn--ghost btn--small tnote-next-status"
                              onClick={() => moveToPreviousStage(transformer)}
                              disabled={!hasValidTransformerId(transformer)}
                              title={`Move transformer status back to ${getPreviousTransformerStage(transformer)}`}
                            >
                              Back to {getPreviousTransformerStage(transformer)}
                            </button>
                          )}
                          {transformer.intakeType === 'RGP' && (
                            <div className="tnote-rgp-status">
                              <span className="tag tag--rgp">RGP · Non-billable</span>
                              <span className="tnote-rgp-visit-stage">Visit: {transformer.visitStatus || 'Recieved'}</span>
                            </div>
                          )}
                        </td>
                        <td className="actions-cell">
                          <div className="tnote-transformer-actions">
                            <button type="button" className={`btn btn--small btn--icon ${activeTNoteTransformer?.id === transformer.id ? 'btn--primary' : 'btn--ghost'}`} aria-label={`View transformer ${transformer.dtrNo || transformer.id}`} title="View transformer details" onClick={() => setActiveTNoteTransformer(transformer)}>
                              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <button type="button" className="btn btn--ghost btn--small btn--icon" aria-label={`Edit transformer ${transformer.dtrNo || transformer.id}`} title="Edit transformer" onClick={() => openEditTransformerModal(transformer)} disabled={!hasValidTransformerId(transformer)}>
                              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="m16.5 3.5 4 4L8 20l-5 1 1-5L16.5 3.5Z" />
                              </svg>
                            </button>
                            {transformer.assessmentDetails ? (
                              <>
                                <button type="button" className="btn btn--ghost btn--small btn--icon tnote-assessment-action" aria-label={`View assessment for transformer ${transformer.dtrNo || transformer.id}`} title="View assessment" onClick={() => openAssessmentForm(transformer, 'view')}>
                                  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 3h9l4 4v14H6z" />
                                    <path d="M14 3v5h5M9 12h4M9 16h3" />
                                    <circle cx="17.5" cy="16.5" r="2.5" />
                                    <path d="m19.3 18.3 1.5 1.5" />
                                  </svg>
                                </button>
                                <button type="button" className="btn btn--ghost btn--small btn--icon tnote-assessment-action assessment-edit-button" aria-label={`Edit assessment for transformer ${transformer.dtrNo || transformer.id}`} title="Edit assessment" onClick={() => openAssessmentForm(transformer, 'edit')} disabled={transformer.status === 'Billed'}>
                                  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 3h9l4 4v7" />
                                    <path d="M14 3v5h5M9 12h3M9 16h2" />
                                    <path d="m14 19 5.5-5.5a2.1 2.1 0 0 1 3 3L17 22l-4 1 1-4Z" />
                                  </svg>
                                </button>
                                <button type="button" className="btn btn--danger btn--small btn--icon tnote-assessment-action" aria-label={`Delete assessment for transformer ${transformer.dtrNo || transformer.id}`} title="Delete assessment" onClick={() => deleteTransformerAssessment(transformer)} disabled={['Delivered', 'Billed'].includes(transformer.status)}>
                                  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 3h9l4 4v14H6z" />
                                    <path d="M14 3v5h5M10 12l5 5m0-5-5 5" />
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <button type="button" className="btn btn--ghost btn--small btn--icon" aria-label={`Add assessment for transformer ${transformer.dtrNo || transformer.id}`} title="Add assessment" onClick={() => openAssessmentForm(transformer)} disabled={!hasValidTransformerId(transformer) || ['Delivered', 'Billed'].includes(transformer.status)}>
                                <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 5v14M5 12h14" />
                                </svg>
                              </button>
                            )}
                            {transformer.intakeType === 'RGP' && transformer.visitStatus !== 'Repaired' && (
                              <button type="button" className="btn btn--ghost btn--small" onClick={() => updateRgpVisitStatus(transformer)} disabled={addingTNoteTransformer}>
                                Advance Visit
                              </button>
                            )}
                            <button type="button" className="btn btn--danger btn--small btn--icon" aria-label={`Remove transformer ${transformer.dtrNo || transformer.id} from this TNote`}                             title={transformer.intakeType === 'RGP' ? 'RGP visit history is retained' : ['delivered', 'billed'].includes(String(transformer.status || '').toLowerCase()) ? 'Delivered transformers cannot be removed from a TNote' : 'Remove from this TNote'} onClick={() => deleteTNoteTransformer(transformer)} disabled={!hasValidTransformerId(transformer) || transformer.intakeType === 'RGP' || ['delivered', 'billed'].includes(String(transformer.status || '').toLowerCase())}>
                              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(activeTNote.transformers || []).length === 0 && (
                      <tr><td colSpan="7" className="tnote-empty-state">No transformers are linked to this TNote.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {activeTNoteTransformer && (
              <section className="tnote-transformer-detail" aria-live="polite">
                <div className="tnote-transformer-detail-header">
                  <div>
                    <p className="tnote-details-eyebrow">Transformer details</p>
                    <h3>{activeTNoteTransformer.dtrNo || `Transformer ${activeTNoteTransformer.id}`}</h3>
                  </div>
                  <button className="btn btn--ghost btn--small" onClick={() => setActiveTNoteTransformer(null)}>Close details</button>
                </div>
                <dl>
                  <div><dt>Transformer ID</dt><dd>{activeTNoteTransformer.id}</dd></div>
                  <div><dt>SPM Center</dt><dd>{activeTNoteTransformer.spmCenter || '—'}</dd></div>
                  <div><dt>DTR No</dt><dd>{activeTNoteTransformer.dtrNo || '—'}</dd></div>
                  <div><dt>Serial No</dt><dd>{activeTNoteTransformer.sNo || '—'}</dd></div>
                  <div><dt>Capacity</dt><dd>{activeTNoteTransformer.capacity || '—'}</dd></div>
                  <div><dt>Type</dt><dd>{activeTNoteTransformer.type || '—'}</dd></div>
                  <div><dt>Oil Capacity</dt><dd>{activeTNoteTransformer.oilCapacity || '—'}</dd></div>
                  <div><dt>Status</dt><dd>{activeTNoteTransformer.status || '—'}</dd></div>
                  {activeTNoteTransformer.intakeType === 'RGP' && (
                    <>
                      <div><dt>TNote Intake</dt><dd>RGP · Non-billable</dd></div>
                      <div><dt>RGP Visit Stage</dt><dd>{activeTNoteTransformer.visitStatus || 'Recieved'}</dd></div>
                    </>
                  )}
                </dl>
              </section>
            )}
          </div>
        </div>
      )}

      {tnoteAttachmentTarget && (
        <div className="modal-overlay" onClick={closeTNoteAttachmentUpload}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="tnote-attachment-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 id="tnote-attachment-title">Add TNote Attachments</h2>
              <button className="modal-close" onClick={closeTNoteAttachmentUpload} aria-label="Close attachment upload">×</button>
            </div>
            <p>TNote {tnoteAttachmentTarget.tNoteNo || tnoteAttachmentTarget.id} has {tnoteAttachmentTarget.attachments?.length || 0} of {MAX_ATTACHMENTS} attachments.</p>
            {savedAttachmentLinks(tnoteAttachmentTarget.attachments)}
            <AttachmentUploadField
              id={`tnote-add-attachments-${tnoteAttachmentTarget.id}`}
              attachments={tnoteAdditionalAttachments}
              onChange={setTnoteAdditionalAttachments}
              onUploadingChange={setTnoteAdditionalAttachmentReading}
              label="Add photos or PDF documents"
              maxAttachments={Math.max(0, MAX_ATTACHMENTS - (tnoteAttachmentTarget.attachments?.length || 0))}
              disabled={tnoteAttachmentSaveLoading}
            />
            {tnoteAttachmentUploadError && <p className="status status--error" role="alert">{tnoteAttachmentUploadError}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={saveTNoteAttachments}
                disabled={tnoteAttachmentSaveLoading || tnoteAdditionalAttachmentReading || tnoteAdditionalAttachments.length === 0}
              >
                {tnoteAttachmentSaveLoading ? 'Uploading...' : 'Save Attachments'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={closeTNoteAttachmentUpload} disabled={tnoteAttachmentSaveLoading || tnoteAdditionalAttachmentReading}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showTNoteModal && (
        <div className="modal-overlay" onClick={closeTNoteModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New TNote with Transformers</h2>
              <button className="modal-close" onClick={closeTNoteModal}>×</button>
            </div>
            <form onSubmit={createTNoteWithTransformers}>
              <div className="form-group">
                <label htmlFor="tnote-number">TNote No</label>
                <input
                  id="tnote-number"
                  name="tNoteNo"
                  value={newTNote.tNoteNo}
                  onChange={(event) => setNewTNote((current) => ({ ...current, tNoteNo: event.target.value }))}
                  placeholder="Enter TNote number"
                  maxLength={100}
                  required
                />
              </div>
              <div className="form-group">
                <label>TNote Date</label>
                <input
                  type="date"
                  name="date"
                  value={newTNote.date}
                  onChange={handleCreateInputChange}
                  required
                />
              </div>
              <AttachmentUploadField
                id="tnote-attachments"
                attachments={tnoteAttachments}
                onChange={setTnoteAttachments}
                onUploadingChange={setTnoteAttachmentReading}
                disabled={tnoteCreateLoading}
              />
              {tnoteError && <p className="status status--error" role="alert">{tnoteError}</p>}

              <h3>Add Transformers</h3>
              <div className="transformers-list">
                {tnoteTransformers.map((transformer, index) => (
                  <div key={index} className="transformer-row">
                    <DefaultSelect
                      value={transformer.spmCenter}
                      options={dropdownDefaults.spmCenters}
                      placeholder="Select SPM Center"
                      onChange={(e) => handleTransformerInputChange(index, 'spmCenter', e.target.value)}
                      required
                    />
                    <input
                      placeholder="DTR No"
                      value={transformer.dtrNo}
                      onChange={(e) => handleTransformerInputChange(index, 'dtrNo', e.target.value)}
                      required
                    />
                    <input
                      placeholder="SNo"
                      value={transformer.sNo}
                      onChange={(e) => handleTransformerInputChange(index, 'sNo', e.target.value)}
                      required
                    />
                    <DefaultSelect
                      value={String(transformer.capacity)}
                      options={transformerCapacityOptions}
                      placeholder="Select Capacity"
                      onChange={(e) => handleTransformerInputChange(index, 'capacity', e.target.value)}
                      required
                    />
                    <input
                      placeholder="Type"
                      value={transformer.type}
                      onChange={(e) => handleTransformerInputChange(index, 'type', e.target.value)}
                      required
                    />
                    <input
                      placeholder="Oil Capacity"
                      type="number"
                      step="0.1"
                      value={transformer.oilCapacity}
                      onChange={(e) => handleTransformerInputChange(index, 'oilCapacity', e.target.value)}
                      required
                    />
                    {tnoteTransformers.length > 1 && (
                      <button
                        type="button"
                        className="btn btn--danger btn--small"
                        onClick={() => removeTransformerRow(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn--ghost" onClick={addTransformerRow}>
                  + Add Another Transformer
                </button>
                <div>
                  <button type="submit" className="btn btn--primary" disabled={tnoteCreateLoading || tnoteAttachmentReading}>
                    {tnoteCreateLoading ? 'Creating...' : tnoteAttachmentReading ? 'Reading attachments...' : 'Create TNote & Transformers'}
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={closeTNoteModal}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {attachmentViewer && (
        <AttachmentViewerModal
          title={attachmentViewer.title}
          attachments={attachmentViewer.attachments}
          onClose={() => setAttachmentViewer(null)}
        />
      )}
    </main>
  </div>
  )
}

export default App
