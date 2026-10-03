import { Fragment, useEffect, useState, useSyncExternalStore } from 'react'
import LandingPage from './LandingPage'
import { signOut } from 'firebase/auth'
import { auth, getAuthSnapshot, subscribeToAuth } from './firebase'
import { apiFetch } from './api'
import './App.css'

const STATUS_ORDER = [
  'Recieved',
  'Assesment',
  'Repair In Progress',
  'Repaired',
  'Delivered',
  'Billed',
]

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
  const [currentTab, setCurrentTab] = useState('quotations')
  const [transformers, setTransformers] = useState([])
  const [transformersLoading, setTransformersLoading] = useState(false)
  const [transformersError, setTransformersError] = useState('')
  const [statusFilter, setStatusFilter] = useState([])
  const [spmCenterFilter, setSpmCenterFilter] = useState([])
  const [dtrNoFilter, setDtrNoFilter] = useState([])
  const [sNoFilter, setSNoFilter] = useState([])
  const [tNoteFilter, setTNoteFilter] = useState([])
  const [typeFilter, setTypeFilter] = useState([])
  const [capacityFilter, setCapacityFilter] = useState([])
  const [tnoteDateFilter, setTnoteDateFilter] = useState([])
  const [tnoteCountFilter, setTnoteCountFilter] = useState([])
  const [dcNoFilter, setDcNoFilter] = useState([])
  const [dcDateFilter, setDcDateFilter] = useState([])
  const [dcSpmCenterFilter, setDcSpmCenterFilter] = useState([])
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
  const [dcs, setDcs] = useState([])
  const [dcLoading, setDcLoading] = useState(false)
  const [showDCModal, setShowDCModal] = useState(false)
  const [showDCDetails, setShowDCDetails] = useState(false)
  const [activeDC, setActiveDC] = useState(null)
  const [dcDetailTransformers, setDcDetailTransformers] = useState([])
  const [dcEditMode, setDcEditMode] = useState(false)
  const [editDCDate, setEditDCDate] = useState(new Date().toISOString().split('T')[0])
  const [editingTransformer, setEditingTransformer] = useState(null)
  const [showEditTransformerModal, setShowEditTransformerModal] = useState(false)
  const [dcCandidates, setDcCandidates] = useState([])
  const [selectedDCTransformers, setSelectedDCTransformers] = useState([])
  const [dcCreateLoading, setDcCreateLoading] = useState(false)
  const [bills, setBills] = useState([])
  const [billLoading, setBillLoading] = useState(false)
  const [showBillModal, setShowBillModal] = useState(false)
  const [showBillDetails, setShowBillDetails] = useState(false)
  const [activeBill, setActiveBill] = useState(null)
  const [billDetailTransformers, setBillDetailTransformers] = useState([])
  const [billEditMode, setBillEditMode] = useState(false)
  const [editBillDate, setEditBillDate] = useState(new Date().toISOString().split('T')[0])
  const [billCandidates, setBillCandidates] = useState([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Enquiries state
  const [enquiries, setEnquiries] = useState([])
  const [enquiriesLoading, setEnquiriesLoading] = useState(false)
  const [enquiriesError, setEnquiriesError] = useState('')
  const [expandedEnquiryId, setExpandedEnquiryId] = useState(null)
  const [showEnquiryForm, setShowEnquiryForm] = useState(false)
  const [quotations, setQuotations] = useState([])
  const [quotationConfig, setQuotationConfig] = useState({ settings: {}, capacities: [], services: [], rates: {} })
  const [quotationsLoading, setQuotationsLoading] = useState(false)
  const [quotationsError, setQuotationsError] = useState('')
  const [showQuotationModal, setShowQuotationModal] = useState(false)
  const [quotationModalMode, setQuotationModalMode] = useState('create')
  const [activeQuotation, setActiveQuotation] = useState(null)
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
      id: 'transformers',
      label: 'Transformers',
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M5 4h2v16H5V4zm12 0h2v16h-2V4zM8 7h8v2H8V7zm0 8h8v2H8v-2zm-2 2h12v2H6v-2z" />
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
      id: 'dcs',
      label: 'DCs',
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
    date: new Date().toISOString().split('T')[0],
    numberOfTransformers: 1,
  })
  const [tnoteTransformers, setTnoteTransformers] = useState([
    { spmCenter: '', dtrNo: '', sNo: '', capacity: '', type: '', oilCapacity: '' },
  ])
  const [newDC, setNewDC] = useState({ dcNo: '', date: new Date().toISOString().split('T')[0], spmCenter: '', totalTransformers: 0 })
  const [newBill, setNewBill] = useState({ sapNo: '', date: new Date().toISOString().split('T')[0], spmCenter: '', totalTransformers: 0, billAmount: 0 })

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

  const filteredTNotes = tnotes.filter((tnote) => {
    const dateValue = formattedDate(tnote.date)
    return (
      (tnoteDateFilter.length === 0 || tnoteDateFilter.includes(dateValue)) &&
      (tnoteCountFilter.length === 0 || tnoteCountFilter.includes(String(tnote.numberOfTransformers)))
    )
  })

  const filteredDcs = dcs.filter((dc) => {
    const dateValue = formattedDate(dc.date)
    return (
      (dcNoFilter.length === 0 || dcNoFilter.some(filter => dc.dcNo.toLowerCase().includes(filter.toLowerCase()))) &&
      (dcDateFilter.length === 0 || dcDateFilter.includes(dateValue)) &&
      (dcSpmCenterFilter.length === 0 || dcSpmCenterFilter.some(filter => (dc.spmCenter || '').toLowerCase().includes(filter.toLowerCase())))
    )
  })

  const filteredBills = bills.filter((bill) => {
    const dateValue = formattedDate(bill.date)
    return (
      (billSapFilter.length === 0 || billSapFilter.some(filter => bill.sapNo.toLowerCase().includes(filter.toLowerCase()))) &&
      (billDateFilter.length === 0 || billDateFilter.includes(dateValue)) &&
      (billSpmCenterFilter.length === 0 || billSpmCenterFilter.some(filter => (bill.spmCenter || '').toLowerCase().includes(filter.toLowerCase())))
    )
  })

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
  const filteredEnquiries = enquiries.filter(enquiry =>
    enquiryColumns.every(({ key, value }) => {
      const selected = enquiryColumnFilters[key] || []
      return selected.length === 0 || selected.includes(value(enquiry))
    })
  )

  const quotationColumns = [
    { key: 'documentType', label: 'Document Type', value: quotation => quotation.documentType === 'BILL' ? 'Bill' : 'Quotation' },
    { key: 'number', label: 'Document No.', value: quotation => quotation.quotationNo || '—' },
    { key: 'date', label: 'Date', value: quotation => formattedDate(quotation.quotationDate) || '—' },
    { key: 'customer', label: 'Customer', value: quotation => quotation.customerName || '—' },
    { key: 'mobile', label: 'Mobile', value: quotation => quotation.mobile || '—' },
    { key: 'capacity', label: 'Capacity', value: quotation => quotation.transformerCapacity || '—' },
    { key: 'output', label: 'Output', value: quotation => quotation.outputFormat || (quotation.pdfUrl ? 'PDF' : 'PNG') },
  ]
  const filteredQuotations = quotations.filter(quotation =>
    quotationColumns.every(({ key, value }) => {
      const selected = quotationColumnFilters[key] || []
      return selected.length === 0 || selected.includes(value(quotation))
    })
  )

  const onEnquiryColumnFilter = (key) => (value) =>
    setEnquiryColumnFilters(current => ({ ...current, [key]: value }))
  const onQuotationColumnFilter = (key) => (value) =>
    setQuotationColumnFilters(current => ({ ...current, [key]: value }))

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
    date: uniqueValues(tnotes, (tnote) => formattedDate(tnote.date)),
    count: uniqueValues(tnotes, (tnote) => String(tnote.numberOfTransformers)),
  }

  const dcOptions = {
    dcNo: uniqueValues(dcs, (dc) => dc.dcNo),
    date: uniqueValues(dcs, (dc) => formattedDate(dc.date)),
    spmCenter: uniqueValues(dcs, (dc) => dc.spmCenter || ''),
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
    } catch (err) {
      setTnoteError(err instanceof Error ? err.message : 'Failed to load TNotes')
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
    setQuotationModalError('')
    setSelectedQuotationService('')
    setQuotationModalMode('create')
    setShowQuotationModal(true)
  }

  const openQuotation = (quotation, mode) => {
    setActiveQuotation(quotation)
    setQuotationModalError('')
    setQuotationDraft({
      ...quotation,
      documentType: quotation.documentType || 'QUOTATION',
      email: '',
      outputFormat: quotation.outputFormat || (quotation.pdfUrl ? 'PDF' : 'PNG'),
      lineItems: quotation.lineItems.map(item => ({
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

  const printQuotation = (quotation) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setQuotationModalError('Allow pop-ups for this site to print the quotation.')
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
    const letterheadUrl = `${window.location.origin}/api/quotations/letterhead`
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
          .totals { display: flow-root; width: 100%; margin: 3mm 0 0; padding: 3mm; border: 1px solid #dbe3ed; border-radius: 2mm; background: #f8fafc; }
          .totals p { display: flex; justify-content: space-between; width: 76mm; margin: 1mm 0 1mm auto; }
          .totals .grand { padding-top: 1.5mm; border-top: 1px solid #334155; font-size: 11pt; font-weight: 700; }
          .totals .amount-words { display: block; width: 100%; margin: 1mm 0 0; text-align: left; font-size: 8pt; line-height: 1.35; }
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
        <img class="letterhead" src="${letterheadUrl}" alt="">
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
  }

  const saveQuotationDraft = async (event) => {
    event.preventDefault()
    if (!quotationDraft) return
    const documentLabel = quotationDraft.documentType === 'BILL' ? 'bill' : 'quotation'
    setQuotationsError('')
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
      const isEditing = quotationModalMode === 'edit'
      const response = await apiFetch('/api/quotations', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...quotationDraft, email: '' }),
      })
      const result = await response.json()
      if (!response.ok || result.status !== 'SUCCESS') {
        throw new Error(result.message || `Failed to save ${documentLabel} (${response.status})`)
      }
      setShowQuotationModal(false)
      await fetchQuotations()
    } catch (err) {
      setQuotationModalError(err instanceof Error ? err.message : 'Failed to save quotation')
    } finally {
      setQuotationSaving(false)
    }
  }

  const deleteQuotation = async (quotation) => {
    const documentLabel = quotation.documentType === 'BILL' ? 'bill' : 'quotation'
    if (!confirm(`Delete ${documentLabel} ${quotation.quotationNo}? Its generated file will also be moved to trash.`)) return
    setQuotationsError('')
    try {
      const response = await apiFetch(`/api/quotations/${encodeURIComponent(quotation.quotationNo)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok || result.status !== 'SUCCESS') {
        throw new Error(result.message || `Failed to delete quotation (${response.status})`)
      }
      setQuotations(current => current.filter(item => item.quotationNo !== quotation.quotationNo))
      if (activeQuotation?.quotationNo === quotation.quotationNo) {
        setShowQuotationModal(false)
        setActiveQuotation(null)
      }
    } catch (err) {
      setQuotationsError(err instanceof Error ? err.message : 'Failed to delete quotation')
    }
  }

  const updateTransformerStatus = async (transformerId, nextStatus) => {
    setTransformersError('')
    try {
      const response = await apiFetch(`/api/transformers/${transformerId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `Failed to update status (${response.status})`)
      }
      const updated = await response.json()
      setTransformers((prevTransformers) =>
        prevTransformers.map((transformer) => (transformer.id === updated.id ? updated : transformer)),
      )
      await fetchSummary()
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Status update failed')
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
    if (tnoteTransformers.some((t) => !t.spmCenter || !t.dtrNo || !t.sNo || !t.capacity || !t.type || !t.oilCapacity)) {
      setTransformersError('Please fill all transformer fields')
      return
    }

    try {
      const tnoteResponse = await apiFetch('/api/tnotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newTNote.date,
          numberOfTransformers: tnoteTransformers.length,
        }),
      })
      if (!tnoteResponse.ok) throw new Error('Failed to create TNote')
      const createdTNote = await tnoteResponse.json()

      for (const transformer of tnoteTransformers) {
        await apiFetch('/api/transformers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...transformer,
            capacity: parseInt(transformer.capacity),
            oilCapacity: parseFloat(transformer.oilCapacity),
            tNoteId: createdTNote.id,
          }),
        })
      }

      setNewTNote({ date: new Date().toISOString().split('T')[0], numberOfTransformers: 1 })
      setTnoteTransformers([{ spmCenter: '', dtrNo: '', sNo: '', capacity: '', type: '', oilCapacity: '' }])
      setShowTNoteModal(false)
      await fetchTNotes()
      await fetchTransformers()
      await fetchSummary()
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to create TNote')
    }
  }

  const deleteTNote = async (id) => {
    if (!confirm('Delete this TNote and all associated transformers?')) return
    try {
      const response = await apiFetch(`/api/tnotes/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete TNote')
      setTnotes((prev) => prev.filter((t) => t.id !== id))
      await fetchTransformers()
      await fetchSummary()
    } catch (err) {
      setTransformersError('Failed to delete TNote')
    }
  }

  const createDC = async (event) => {
    event.preventDefault()
    setTransformersError('')
    try {
      const response = await apiFetch('/api/dcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDC),
      })
      if (!response.ok) throw new Error('Failed to create DC')
      setNewDC({ dcNo: '', date: new Date().toISOString().split('T')[0], spmCenter: '', totalTransformers: 0 })
      setShowDCForm(false)
      await fetchDCs()
    } catch (err) {
      setTransformersError('Failed to create DC')
    }
  }

  const deleteDC = async (dcNo) => {
    if (!confirm('Delete this DC?')) return
    try {
      const response = await apiFetch(`/api/dcs/${dcNo}`, { method: 'DELETE' })
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
      if (!response.ok) throw new Error('Failed to create Bill')
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
      const response = await apiFetch('/api/transformers?status=Repaired&page=0&size=100')
      if (!response.ok) throw new Error('Failed to load repaired transformers')
      const data = await response.json()
      setDcCandidates(data.content ?? [])
    } catch (err) {
      setTransformersError('Failed to load repaired transformers')
    }
  }

  const loadBillCandidates = async () => {
    try {
      const response = await apiFetch('/api/transformers?status=Delivered&page=0&size=100')
      if (!response.ok) throw new Error('Failed to load delivered transformers')
      const data = await response.json()
      setBillCandidates(data.content ?? [])
    } catch (err) {
      setTransformersError('Failed to load delivered transformers')
    }
  }

  const openDCModal = async () => {
    setShowDCModal(true)
    setSelectedDCTransformers([])
    await loadDCCandidates()
  }

  const openDCDetails = async (dcNo) => {
    setTransformersError('')
    try {
      const [dcRes, transformersRes] = await Promise.all([
        apiFetch(`/api/dcs/${dcNo}`),
        apiFetch(`/api/transformers/dc/${dcNo}`),
      ])
      if (!dcRes.ok) throw new Error('Failed to load DC details')
      if (!transformersRes.ok) throw new Error('Failed to load DC transformers')
      const dcData = await dcRes.json()
      const transformerData = await transformersRes.json()
      setActiveDC(dcData)
      setDcDetailTransformers(Array.isArray(transformerData) ? transformerData : [])
      setEditDCDate(dcData.date || new Date().toISOString().split('T')[0])
      setDcEditMode(false)
      setShowDCDetails(true)
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to load DC details')
    }
  }

  const closeDCDetails = () => {
    setShowDCDetails(false)
    setActiveDC(null)
    setDcDetailTransformers([])
    setDcEditMode(false)
    setShowEditTransformerModal(false)
    setEditingTransformer(null)
  }

  const saveDCUpdate = async (event) => {
    event.preventDefault()
    if (!activeDC?.dcNo) return
    try {
      const response = await apiFetch(`/api/dcs/${activeDC.dcNo}`, {
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
      setTransformers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      closeEditTransformerModal()
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to update transformer')
    }
  }

  const openBillDetails = async (sapNo) => {
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
      setBillDetailTransformers(Array.isArray(transformerData) ? transformerData : [])
      setEditBillDate(billData.date || new Date().toISOString().split('T')[0])
      setBillEditMode(false)
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
    setShowEditTransformerModal(false)
    setEditingTransformer(null)
  }

  const saveBillUpdate = async (event) => {
    event.preventDefault()
    if (!activeBill?.sapNo) return
    try {
      const response = await apiFetch(`/api/bills/${activeBill.sapNo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sapNo: activeBill.sapNo, date: editBillDate }),
      })
      if (!response.ok) throw new Error('Failed to update Bill')
      const updated = await response.json()
      setActiveBill(updated)
      setBillEditMode(false)
      await fetchBills()
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to update Bill')
    }
  }

  const openBillModal = async () => {
    setShowBillModal(true)
    setSelectedBillTransformers([])
    await loadBillCandidates()
  }

  const toggleDCSelection = (id) => {
    setSelectedDCTransformers((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    )
  }

  const toggleBillSelection = (id) => {
    setSelectedBillTransformers((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    )
  }

  const createDCWithSelection = async (event) => {
    event.preventDefault()
    if (!newDC.dcNo) {
      setTransformersError('Enter DC number')
      return
    }
    if (selectedDCTransformers.length === 0) {
      setTransformersError('Select at least one repaired transformer')
      return
    }
    setTransformersError('')
    setDcCreateLoading(true)
    try {
      const dcRequest = {
        ...newDC,
        totalTransformers: selectedDCTransformers.length,
      }
      const response = await apiFetch('/api/dcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dcRequest),
      })
      if (!response.ok) throw new Error('Failed to create DC')
      for (const id of selectedDCTransformers) {
        const deliverRes = await apiFetch(`/api/transformers/${id}/deliver`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dcNo: newDC.dcNo }),
        })
        if (!deliverRes.ok) throw new Error('Failed to assign transformer to DC')
      }
      setNewDC({ dcNo: '', date: new Date().toISOString().split('T')[0], spmCenter: '', totalTransformers: 0 })
      setShowDCModal(false)
      setSelectedDCTransformers([])
      await fetchDCs()
      await fetchTransformers()
      await fetchSummary()
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to create DC')
    } finally {
      setDcCreateLoading(false)
    }
  }

  const createBillWithSelection = async (event) => {
    event.preventDefault()
    if (!newBill.sapNo) {
      setTransformersError('Enter SAP number')
      return
    }
    if (selectedBillTransformers.length === 0) {
      setTransformersError('Select at least one delivered transformer')
      return
    }
    setTransformersError('')
    setBillCreateLoading(true)
    try {
      // Auto-calculate totalTransformers based on selected transformers
      const billData = {
        ...newBill,
        totalTransformers: selectedBillTransformers.length
      }
      const response = await apiFetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData),
      })
      if (!response.ok) throw new Error('Failed to create Bill')
      for (const id of selectedBillTransformers) {
        const billRes = await apiFetch(`/api/transformers/${id}/bill`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sapNo: newBill.sapNo }),
        })
        if (!billRes.ok) throw new Error('Failed to assign transformer to Bill')
      }
      setNewBill({ sapNo: '', date: new Date().toISOString().split('T')[0], spmCenter: '', totalTransformers: 0, billAmount: 0 })
      setShowBillModal(false)
      setSelectedBillTransformers([])
      await fetchBills()
      await fetchTransformers()
      await fetchSummary()
    } catch (err) {
      setTransformersError(err instanceof Error ? err.message : 'Failed to create Bill')
    } finally {
      setBillCreateLoading(false)
    }
  }

  const moveToNextStage = (transformer) => {
    const currentIndex = STATUS_ORDER.indexOf(transformer.status)
    if (currentIndex < 0 || currentIndex >= STATUS_ORDER.length - 2) {
      return
    }
    const nextStatus = STATUS_ORDER[currentIndex + 1]
    if (nextStatus === 'Delivered' || nextStatus === 'Billed') {
      return
    }
    updateTransformerStatus(transformer.id, nextStatus)
  }

  const deliverTransformer = async (transformer) => {
    if (transformer.status !== 'Repaired') {
      return
    }
    const dcNo = prompt('Enter DC No:')
    if (!dcNo) return
    try {
      const response = await apiFetch(`/api/transformers/${transformer.id}/deliver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dcNo }),
      })
      if (!response.ok) throw new Error('Failed to deliver')
      const updated = await response.json()
      setTransformers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      await fetchSummary()
    } catch (err) {
      setTransformersError('Delivery failed')
    }
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
      if (resetPage) setPage(0)
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
          <div className="hero__content hero__content--compact" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="DS Transformers logo" className="hero-logo" />
              <h1>V S Transformers Management System</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setShowPublicSite(true)}
                style={{ padding: '0.55rem 1rem', fontSize: '0.88rem', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                title="View the public website"
              >
                🌐 Public Website
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => signOut(auth)}
                style={{ padding: '0.55rem 1rem', fontSize: '0.88rem', borderRadius: '8px', cursor: 'pointer', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                title="Sign out from admin portal"
              >
                🔒 Logout
              </button>
            </div>
          </div>
        </header>

        <section className="kpis">
        <article className="card">
          <p>Recieved</p>
          <h3>{summary.recieve}</h3>
          <small>New inward entries</small>
        </article>
        <article className="card">
          <p>Assesment</p>
          <h3>{summary.assesment}</h3>
          <small>Fault verification pending</small>
        </article>
        <article className="card">
          <p>Repair In Progress</p>
          <h3>{summary.repairInProgress}</h3>
          <small>Workshop jobs in progress</small>
        </article>
        <article className="card">
          <p>Repaired</p>
          <h3>{summary.repaired}</h3>
          <small>Ready for dispatch planning</small>
        </article>
        <article className="card">
          <p>Delivered</p>
          <h3>{summary.delivered}</h3>
          <small>Customer handover completed</small>
        </article>
        <article className="card">
          <p>Billed</p>
          <h3>{summary.billed}</h3>
          <small>Invoice posted after delivery</small>
        </article>
      </section>

      {currentTab === 'enquiries' && (
        <section className="panel jobs-panel">
          <div className="panel-header">
            <h2>Service Enquiries</h2>
            <button className="btn btn--primary" onClick={() => setShowEnquiryForm(true)}>
              New Enquiry
            </button>
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
                  <input
                    type="text"
                    placeholder="Service Required"
                    className="form-input"
                    value={newEnquiry.servicesRequired}
                    onChange={(e) => setNewEnquiry({...newEnquiry, servicesRequired: e.target.value})}
                    required
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
            <table className="jobs-table">
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
                      <td className="actions-cell">
                        <button
                          className="btn btn--ghost btn--small"
                          aria-expanded={expandedEnquiryId === enquiry.ID}
                          onClick={() => setExpandedEnquiryId(current => current === enquiry.ID ? null : enquiry.ID)}
                        >
                          {expandedEnquiryId === enquiry.ID ? 'Hide details' : 'View details'}
                        </button>
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
                    <td>{quotation.documentType === 'BILL' ? 'Bill' : 'Quotation'}</td>
                    <td>{quotation.quotationNo}</td>
                    <td>{formattedDate(quotation.quotationDate)}</td>
                    <td>{quotation.customerName}</td>
                    <td>{quotation.mobile}</td>
                    <td>{quotation.transformerCapacity}</td>
                    <td>{quotation.outputFormat || (quotation.pdfUrl ? 'PDF' : 'PNG')}</td>
                    <td className="actions-cell">
                      <button className="btn btn--ghost btn--small" onClick={() => openQuotation(quotation, 'view')}>View</button>
                      <button className="btn btn--ghost btn--small" onClick={() => openQuotation(quotation, 'edit')}>Edit</button>
                      <button className="btn btn--danger btn--small" onClick={() => deleteQuotation(quotation)}>Delete</button>
                      {(quotation.fileUrl || quotation.pdfUrl) && (
                        <a className="btn btn--ghost btn--small" href={quotation.fileUrl || quotation.pdfUrl} target="_blank" rel="noreferrer">
                          Open {quotation.outputFormat || (quotation.pdfUrl ? 'PDF' : 'PNG')}
                        </a>
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
                {activeQuotation.documentType === 'BILL' && (() => {
                  const subtotal = Math.round(activeQuotation.lineItems.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.rate || 0), 0) * 100) / 100
                  const gst = activeQuotation.gstApplicable ? Math.round(subtotal * Number(activeQuotation.gstRate || 19)) / 100 : 0
                  return <div className="bill-total-summary">
                    <p className="bill-total-words"><span>Amount in words: </span><strong>{indianCurrencyWords(subtotal + gst)}</strong></p>
                    <p><span>Subtotal</span><strong>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                    {activeQuotation.gstApplicable && <p><span>GST ({Number(activeQuotation.gstRate || 19)}%)</span><strong>₹{gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>}
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
                  <button className="btn btn--secondary" onClick={() => printQuotation(activeQuotation)}>Print on Local Letterhead</button>
                  {(activeQuotation.fileUrl || activeQuotation.pdfUrl) && (
                    <a className="btn btn--primary" href={activeQuotation.fileUrl || activeQuotation.pdfUrl} target="_blank" rel="noreferrer">
                      Open / Download {activeQuotation.outputFormat || (activeQuotation.pdfUrl ? 'PDF' : 'PNG')}
                    </a>
                  )}
                  <button className="btn btn--ghost" onClick={() => openQuotation(activeQuotation, 'edit')}>Edit {activeQuotation.documentType === 'BILL' ? 'Bill' : 'Quotation'}</button>
                  <button className="btn btn--danger" onClick={() => deleteQuotation(activeQuotation)}>Delete {activeQuotation.documentType === 'BILL' ? 'Bill' : 'Quotation'}</button>
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
                    <label>{quotationDraft.documentType === 'BILL' ? 'Bill Date' : 'Quotation Date'}<input type="date" value={quotationDraft.quotationDate} onChange={event => updateQuotationDraft('quotationDate', event.target.value)} required /></label>
                  </div>
                </section>

                <section className="quotation-editor-section">
                  <h3>Transformer Details</h3>
                  <div className="quotation-editor-grid">
                    <label>Transformer Make<input value={quotationDraft.transformerMake} onChange={event => updateQuotationDraft('transformerMake', event.target.value)} /></label>
                    <label>Transformer Capacity
                      <select value={quotationDraft.transformerCapacity} onChange={event => updateQuotationCapacity(event.target.value)} required>
                        <option value="">Select capacity</option>
                        {quotationConfig.capacities.map(capacity => <option key={capacity}>{capacity}</option>)}
                      </select>
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
                  <p className="quotation-financial-year">The quotation will use the letterhead from the configured Google Slides template.</p>
                </section>
                <p className="quotation-financial-year">Financial Year: {quotationDraft.financialYear || quotationConfig.settings['Financial Year']}</p>
                <div className="quotation-modal-actions">
                  <button type="button" className="btn btn--secondary" onClick={() => printQuotation(quotationDraft)}>
                    Print Draft on Local Letterhead
                  </button>
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
              <button className="btn btn--primary" onClick={() => setShowTNoteModal(true)}>
                Create New TNote
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
                      <button
                        className="btn btn--ghost btn--small"
                        onClick={() => moveToNextStage(transformer)}
                        disabled={!hasValidTransformerId(transformer) || ['Repaired', 'Delivered', 'Billed'].includes(transformer.status)}
                        title={!hasValidTransformerId(transformer) ? 'This record has no valid transformer ID.' : undefined}
                      >
                        Move Stage
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
            <button className="btn btn--primary" onClick={() => setShowTNoteModal(true)}>
              Create New TNote
            </button>
          </div>
          {tnoteLoading && <p className="status jobs-feedback">Loading TNotes...</p>}
          {tnoteError && <p className="status status--error jobs-feedback">{tnoteError}</p>}
          <div className="jobs-table-wrap">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>TNote No</th>
                  <th>SPM Center</th>
                  <th>
                    <FilterHeader
                      column="Date"
                      value={tnoteDateFilter}
                      onFilter={setTnoteDateFilter}
                      options={tnoteOptions.date}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="Transformers Count"
                      value={tnoteCountFilter}
                      onFilter={setTnoteCountFilter}
                      options={tnoteOptions.count}
                    />
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTNotes.map((tnote) => (
                  <tr key={tnote.id}>
                    <td>{tnote.id}</td>
                    <td>{getTNoteSpmCenter(tnote)}</td>
                    <td>{formattedDate(tnote.date) || '—'}</td>
                    <td>{tnote.numberOfTransformers}</td>
                    <td className="actions-cell">
                      <button className="btn btn--ghost btn--small" onClick={() => alert(`View TNote ${tnote.id}`)}>
                        View
                      </button>
                      <button className="btn btn--danger btn--small" onClick={() => deleteTNote(tnote.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredTNotes.length === 0 && (
                  <tr>
                    <td colSpan="5">No TNotes available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {currentTab === 'dcs' && (
        <section className="panel jobs-panel">
          <div className="panel-header">
            <h2>Delivery Chalan Management</h2>
            <button className="btn btn--primary" onClick={openDCModal}>
              Create New DC
            </button>
          </div>
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
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="Date"
                      value={dcDateFilter}
                      onFilter={setDcDateFilter}
                      options={dcOptions.date}
                    />
                  </th>
                  <th>
                    <FilterHeader
                      column="SPM Center"
                      value={dcSpmCenterFilter}
                      onFilter={setDcSpmCenterFilter}
                      options={dcOptions.spmCenter}
                    />
                  </th>
                  <th>Total Transformers</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDcs.map((dc) => (
                  <tr key={dc.dcNo}>
                    <td>{dc.dcNo}</td>
                    <td>{formattedDate(dc.date) || '—'}</td>
                    <td>{dc.spmCenter || '-'}</td>
                    <td>{dc.totalTransformers || 0}</td>
                    <td className="actions-cell">
                      <button className="btn btn--ghost btn--small" onClick={() => openDCDetails(dc.dcNo)}>
                        View
                      </button>
                      <button className="btn btn--danger btn--small" onClick={() => deleteDC(dc.dcNo)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDcs.length === 0 && (
                  <tr>
                    <td colSpan="5">No DCs available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showDCModal && (
        <div className="modal-overlay" onClick={() => setShowDCModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Delivery Challan</h2>
              <button className="modal-close" onClick={() => setShowDCModal(false)}>×</button>
            </div>
            <form onSubmit={createDCWithSelection}>
              <div className="form-group">
                <label>DC No</label>
                <input
                  name="dcNo"
                  value={newDC.dcNo}
                  onChange={(e) => setNewDC({ ...newDC, dcNo: e.target.value })}
                  placeholder="DC-001"
                  required
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input
                  name="date"
                  type="date"
                  value={newDC.date}
                  onChange={(e) => setNewDC({ ...newDC, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>SPM Center</label>
                <input
                  name="spmCenter"
                  value={newDC.spmCenter || ''}
                  onChange={(e) => setNewDC({ ...newDC, spmCenter: e.target.value })}
                  placeholder="Enter SPM Center"
                />
              </div>
              <h3>Select repaired transformers</h3>
              <div className="jobs-table-wrap">
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>ID</th>
                      <th>SPM Center</th>
                      <th>DTR No</th>
                      <th>SNo</th>
                      <th>Capacity</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dcCandidates.map((transformer, index) => (
                      <tr key={`${transformer.id}-${index}`}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedDCTransformers.includes(transformer.id)}
                            onChange={() => toggleDCSelection(transformer.id)}
                            disabled={!hasValidTransformerId(transformer)}
                          />
                        </td>
                        <td>{transformer.id}</td>
                        <td>{transformer.spmCenter}</td>
                        <td>{transformer.dtrNo}</td>
                        <td>{transformer.sNo}</td>
                        <td>{transformer.capacity}</td>
                        <td>{transformer.type}</td>
                      </tr>
                    ))}
                    {dcCandidates.length === 0 && (
                      <tr>
                        <td colSpan="7">No repaired transformers available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn--primary" disabled={dcCreateLoading}>
                  {dcCreateLoading ? 'Creating...' : 'Create DC and Assign'}
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
              <label>Date</label>
              {dcEditMode ? (
                <input type="date" value={editDCDate} onChange={(e) => setEditDCDate(e.target.value)} />
              ) : (
                <input value={formattedDate(activeDC?.date)} disabled />
              )}
            </div>
            <div className="modal-actions">
              {dcEditMode ? (
                <>
                  <button className="btn btn--primary" onClick={saveDCUpdate}>Save DC</button>
                  <button className="btn btn--ghost" onClick={() => setDcEditMode(false)}>Cancel</button>
                </>
              ) : (
                <button className="btn btn--primary" onClick={() => setDcEditMode(true)}>Edit</button>
              )}
            </div>
            <h3>Assigned Transformers</h3>
            <div className="jobs-table-wrap">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>ID</th>
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
                  {dcDetailTransformers.map((transformer, index) => (
                    <tr key={`${transformer.id}-${index}`}>
                      <td>{transformer.id}</td>
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
                  {dcDetailTransformers.length === 0 && (
                    <tr>
                      <td colSpan="8">No transformers assigned to this DC yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showEditTransformerModal && editingTransformer && (
        <div className="modal-overlay" onClick={closeEditTransformerModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Transformer #{editingTransformer.id}</h2>
              <button className="modal-close" onClick={closeEditTransformerModal}>×</button>
            </div>
            <form onSubmit={saveTransformerUpdate}>
              <div className="form-group">
                <label>SPM Center</label>
                <input
                  value={editingTransformer.spmCenter || ''}
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
                <input
                  type="number"
                  value={editingTransformer.capacity || ''}
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
              <label>Date</label>
              {billEditMode ? (
                <input type="date" value={editBillDate} onChange={(e) => setEditBillDate(e.target.value)} />
              ) : (
                <input value={formattedDate(activeBill?.date)} disabled />
              )}
            </div>
            <div className="form-group">
              <label>SPM Center</label>
              <input value={activeBill?.spmCenter || ''} disabled />
            </div>
            <div className="form-group">
              <label>Total Transformers</label>
              <input value={activeBill?.totalTransformers || ''} disabled />
            </div>
            <div className="form-group">
              <label>Bill Amount</label>
              <input value={activeBill?.billAmount ? `₹${activeBill.billAmount.toLocaleString()}` : ''} disabled />
            </div>
            <div className="modal-actions">
              {billEditMode ? (
                <>
                  <button className="btn btn--primary" onClick={saveBillUpdate}>Save Bill</button>
                  <button className="btn btn--ghost" onClick={() => setBillEditMode(false)}>Cancel</button>
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
                      <td colSpan="8">No transformers assigned to this Bill yet.</td>
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
                  <th>Total Transformers</th>
                  <th>Bill Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill, index) => (
                  <tr key={`${bill.sapNo || 'bill'}-${index}`}>
                    <td>{bill.sapNo}</td>
                    <td>{formattedDate(bill.date) || '—'}</td>
                    <td>{bill.spmCenter}</td>
                    <td>{bill.totalTransformers}</td>
                    <td>{bill.billAmount ? `₹${bill.billAmount.toLocaleString()}` : '-'}</td>
                    <td className="actions-cell">
                      <button className="btn btn--ghost btn--small" onClick={() => openBillDetails(bill.sapNo)}>
                        View
                      </button>
                      <button className="btn btn--danger btn--small" onClick={() => deleteBill(bill.sapNo)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredBills.length === 0 && (
                  <tr>
                    <td colSpan="6">No Bills available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showBillModal && (
        <div className="modal-overlay" onClick={() => setShowBillModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Bill</h2>
              <button className="modal-close" onClick={() => setShowBillModal(false)}>×</button>
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
                <input
                  name="spmCenter"
                  value={newBill.spmCenter}
                  onChange={(e) => setNewBill({ ...newBill, spmCenter: e.target.value })}
                  placeholder="Warangal"
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
                  value={newBill.billAmount}
                  onChange={(e) => setNewBill({ ...newBill, billAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="50000"
                  required
                />
              </div>
              <h3>Select delivered transformers</h3>
              <div className="jobs-table-wrap">
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>ID</th>
                      <th>SPM Center</th>
                      <th>DTR No</th>
                      <th>SNo</th>
                      <th>Capacity</th>
                      <th>Type</th>
                      <th>DC No</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billCandidates.map((transformer, index) => (
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
                        <td>{transformer.spmCenter}</td>
                        <td>{transformer.dtrNo}</td>
                        <td>{transformer.sNo}</td>
                        <td>{transformer.capacity}</td>
                        <td>{transformer.type}</td>
                        <td>{transformer.dcNo ?? '-'}</td>
                      </tr>
                    ))}
                    {billCandidates.length === 0 && (
                      <tr>
                        <td colSpan="8">No delivered transformers available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn--primary" disabled={billCreateLoading}>
                  {billCreateLoading ? 'Creating...' : 'Create Bill and Assign'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowBillModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTNoteModal && (
        <div className="modal-overlay" onClick={() => setShowTNoteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New TNote with Transformers</h2>
              <button className="modal-close" onClick={() => setShowTNoteModal(false)}>×</button>
            </div>
            <form onSubmit={createTNoteWithTransformers}>
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

              <h3>Add Transformers</h3>
              <div className="transformers-list">
                {tnoteTransformers.map((transformer, index) => (
                  <div key={index} className="transformer-row">
                    <input
                      placeholder="SPM Center"
                      value={transformer.spmCenter}
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
                    <input
                      placeholder="Capacity"
                      type="number"
                      value={transformer.capacity}
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
                  <button type="submit" className="btn btn--primary">
                    Create TNote & Transformers
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setShowTNoteModal(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  </div>
  )
}

export default App
