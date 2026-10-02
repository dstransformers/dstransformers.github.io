import { useEffect, useState } from 'react'
import './App.css'

const STATUS_ORDER = [
  'Recieved',
  'Assesment',
  'Repair In Progress',
  'Repaired',
  'Delivered',
  'Billed',
]

function App() {
  const [currentTab, setCurrentTab] = useState('transformers')
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
  const [showEnquiryForm, setShowEnquiryForm] = useState(false)
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
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState([])

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
    fetchTransformers()
    fetchSummary()
  }, [page, pageSize, statusFilter, spmCenterFilter, dtrNoFilter, sNoFilter, typeFilter, capacityFilter])

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
    if (currentTab === 'enquiries') fetchEnquiries()
    if (currentTab === 'tnotes') fetchTNotes()
    if (currentTab === 'dcs') fetchDCs()
    if (currentTab === 'bills') fetchBills()
  }, [currentTab])

  const uniqueValues = (items, accessor) =>
    [...new Set(items.map(accessor).filter((value) => value !== undefined && value !== null && value !== ''))]
      .sort((a, b) => a < b ? -1 : a > b ? 1 : 0)

  const formattedDate = (value) => {
    if (!value) return ''
    return new Date(value).toLocaleDateString()
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
      const response = await fetch(`/api/transformers?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch transformers (${response.status})`)
      }
      const data = await response.json()
      setTransformers(data.content ?? [])
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
      const response = await fetch('/api/transformers/summary')
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
      const response = await fetch('http://localhost:8082/api/enquiries')
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
      const response = await fetch('http://localhost:8082/api/enquiries', {
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
      let response = await fetch('/api/tnotes')
      if (!response.ok) {
        response = await fetch('http://localhost:8082/api/tnotes')
      }
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
      const response = await fetch('/api/dcs')
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
      const response = await fetch('/api/bills')
      if (!response.ok) throw new Error('Failed to fetch bills')
      const data = await response.json()
      setBills(Array.isArray(data) ? data : [])
    } catch (err) {
      setTransformersError('Failed to load Bills')
    } finally {
      setBillLoading(false)
    }
  }

  const updateTransformerStatus = async (transformerId, nextStatus) => {
    setTransformersError('')
    try {
      const response = await fetch(`/api/transformers/${transformerId}/status`, {
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
      const tnoteResponse = await fetch('/api/tnotes', {
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
        await fetch('/api/transformers', {
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
      const response = await fetch(`/api/tnotes/${id}`, { method: 'DELETE' })
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
      const response = await fetch('/api/dcs', {
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
      const response = await fetch(`/api/dcs/${dcNo}`, { method: 'DELETE' })
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
      const response = await fetch('/api/bills', {
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
      const response = await fetch(`/api/bills/${sapNo}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete Bill')
      setBills((prev) => prev.filter((b) => b.sapNo !== sapNo))
    } catch (err) {
      setTransformersError('Failed to delete Bill')
    }
  }

  const loadDCCandidates = async () => {
    try {
      const response = await fetch('/api/transformers?status=Repaired&page=0&size=100')
      if (!response.ok) throw new Error('Failed to load repaired transformers')
      const data = await response.json()
      setDcCandidates(data.content ?? [])
    } catch (err) {
      setTransformersError('Failed to load repaired transformers')
    }
  }

  const loadBillCandidates = async () => {
    try {
      const response = await fetch('/api/transformers?status=Delivered&page=0&size=100')
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
        fetch(`/api/dcs/${dcNo}`),
        fetch(`/api/transformers/dc/${dcNo}`),
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
      const response = await fetch(`/api/dcs/${activeDC.dcNo}`, {
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
      const response = await fetch(`/api/transformers/${editingTransformer.id}`, {
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
        fetch(`/api/bills/${sapNo}`),
        fetch(`/api/transformers/bill/${sapNo}`),
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
      const response = await fetch(`/api/bills/${activeBill.sapNo}`, {
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
      const response = await fetch('/api/dcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dcRequest),
      })
      if (!response.ok) throw new Error('Failed to create DC')
      for (const id of selectedDCTransformers) {
        const deliverRes = await fetch(`/api/transformers/${id}/deliver`, {
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
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData),
      })
      if (!response.ok) throw new Error('Failed to create Bill')
      for (const id of selectedBillTransformers) {
        const billRes = await fetch(`/api/transformers/${id}/bill`, {
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
      const response = await fetch(`/api/transformers/${transformer.id}/deliver`, {
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
      const response = await fetch(`/api/transformers/${transformer.id}/bill`, {
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

  const FilterHeader = ({ column, value, onFilter, options = null }) => {
    const isOpen = openFilterColumn === column
    const searchText = filterSearchText[column] || ''

    const handleFilterChange = (newValue) => {
      setPage(0)
      onFilter(newValue)
      setOpenFilterColumn(null)
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
            {column === 'Status' ? (
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
                        handleFilterChange(newValue)
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
                          handleFilterChange(newValue)
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

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed((prev) => !prev)} aria-label="Toggle sidebar">
            {sidebarCollapsed ? '>' : '<'}
          </button>
          <img src="/logo.svg" alt="DS Transformers logo" className="sidebar-logo" />
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
          <div className="hero__content hero__content--compact">
            <img src="/logo.svg" alt="DS Transformers logo" className="hero-logo" />
            <h1>V S Transformers Management System</h1>
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
                  <th>ID</th>
                  <th>Date</th>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Service Required</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((enquiry) => (
                  <tr key={enquiry.ID}>
                    <td>{enquiry.ID}</td>
                    <td>{formattedDate(enquiry.Date)}</td>
                    <td>{enquiry.CustomerName}</td>
                    <td>{enquiry.CustomerPhone}</td>
                    <td>{enquiry.CustomerEmail}</td>
                    <td>{enquiry.ServicesRequired}</td>
                    <td>{enquiry.TransformerLocation}</td>
                    <td>
                      <span className={`tag tag--${(enquiry.Status || 'new').toLowerCase().replace(/\s+/g, '-')}`}>
                        {enquiry.Status || 'NEW'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="btn btn--ghost btn--small" onClick={() => alert(`View Enquiry ${enquiry.ID}`)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {!enquiriesLoading && enquiries.length === 0 && (
                  <tr>
                    <td colSpan="9">No enquiries available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
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
                {transformers.map((transformer) => (
                  <tr key={transformer.id}>
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
                        disabled={['Repaired', 'Delivered', 'Billed'].includes(transformer.status)}
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
                    <td>{new Date(tnote.date).toLocaleDateString()}</td>
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
                    <td>{new Date(dc.date).toLocaleDateString()}</td>
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
                    {dcCandidates.map((transformer) => (
                      <tr key={transformer.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedDCTransformers.includes(transformer.id)}
                            onChange={() => toggleDCSelection(transformer.id)}
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
                <input value={new Date(activeDC?.date || '').toLocaleDateString() || ''} disabled />
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
                  {dcDetailTransformers.map((transformer) => (
                    <tr key={transformer.id}>
                      <td>{transformer.id}</td>
                      <td>{transformer.spmCenter}</td>
                      <td>{transformer.dtrNo}</td>
                      <td>{transformer.sNo}</td>
                      <td>{transformer.capacity}</td>
                      <td>{transformer.type}</td>
                      <td>{transformer.status}</td>
                      <td>
                        <button className="btn btn--ghost btn--small" onClick={() => openEditTransformerModal(transformer)}>
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
                <input value={new Date(activeBill?.date || '').toLocaleDateString() || ''} disabled />
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
                  {billDetailTransformers.map((transformer) => (
                    <tr key={transformer.id}>
                      <td>{transformer.id}</td>
                      <td>{transformer.spmCenter}</td>
                      <td>{transformer.dtrNo}</td>
                      <td>{transformer.sNo}</td>
                      <td>{transformer.capacity}</td>
                      <td>{transformer.type}</td>
                      <td>{transformer.status}</td>
                      <td>
                        <button className="btn btn--ghost btn--small" onClick={() => openEditTransformerModal(transformer)}>
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
                {filteredBills.map((bill) => (
                  <tr key={bill.sapNo}>
                    <td>{bill.sapNo}</td>
                    <td>{new Date(bill.date).toLocaleDateString()}</td>
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
                    {billCandidates.map((transformer) => (
                      <tr key={transformer.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedBillTransformers.includes(transformer.id)}
                            onChange={() => toggleBillSelection(transformer.id)}
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
