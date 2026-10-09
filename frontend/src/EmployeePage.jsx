import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api'
import './EmployeePage.css'

const EMPTY_EMPLOYEE = {
  employeeCode: '',
  name: '',
  department: '',
  salary: '',
  photoUrl: '',
  photoName: '',
  supportingDocuments: [],
  active: true,
}

const MAX_SUPPORTING_DOCUMENTS = 5
const MAX_SUPPORTING_DOCUMENT_SIZE = 2 * 1024 * 1024
const ALLOWED_SUPPORTING_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
  'image/heic', 'image/heif', 'image/avif',
])

const STATUS_CLASS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LEAVE: 'leave',
  GENERATED: 'generated',
  RECEIVED: 'received',
}

function getNextEmployeeCode(employees) {
  const dateParts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(new Date())
  const month = Number(dateParts.find(part => part.type === 'month')?.value)
  const year = Number(dateParts.find(part => part.type === 'year')?.value)
  const fiscalYearStart = month >= 4 ? year : year - 1
  const fiscalYear = `${String(fiscalYearStart).slice(-2)}-${String((fiscalYearStart + 1) % 100).padStart(2, '0')}`
  const pattern = new RegExp(`^DS/${fiscalYear}/(\\d+)$`, 'i')
  const highestSequence = employees.reduce((highest, employee) => {
    const match = String(employee.employeeCode || '').trim().match(pattern)
    return match ? Math.max(highest, Number(match[1]) || 0) : highest
  }, 0)
  return `DS/${fiscalYear}/${String(highestSequence + 1).padStart(3, '0')}`
}

function toDateInput(value) {
  if (!value) return ''
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return String(value).slice(0, 10)
}

function getLocalDateInput() {
  return toDateInput(new Date())
}

function getLocalTimeInput() {
  return new Date().toTimeString().slice(0, 5)
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
}

function formatOvertimeHours(value) {
  return (Number(value) || 0).toFixed(2)
}

function downloadWorkbook(fileName, sheets) {
  const importExcel = () => import('exceljs').then(module => module.default)
  return importExcel().then((ExcelJS) => {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'VSTMS Employee Management'
    sheets.forEach(({ name, rows, columns }) => {
      const worksheet = workbook.addWorksheet(name)
      worksheet.columns = columns
      worksheet.addRow(columns.map(column => column.header))
      rows.forEach(row => worksheet.addRow(row))
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } }
      worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: columns.length } }
    })
    return workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      URL.revokeObjectURL(url)
    })
  })
}

export default function EmployeePage() {
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState([])
  const [holidays, setHolidays] = useState([])
  const [salaries, setSalaries] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDateInput().slice(0, 7))
  const [photoAttendanceDate, setPhotoAttendanceDate] = useState(getLocalDateInput)
  const [employeeForm, setEmployeeForm] = useState(EMPTY_EMPLOYEE)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const [showClock, setShowClock] = useState(null)
  const [clockMode, setClockMode] = useState('in')
  const [clockDate, setClockDate] = useState(getLocalDateInput)
  const [clockInTime, setClockInTime] = useState('')
  const [clockOutTime, setClockOutTime] = useState('')
  const [clockSaving, setClockSaving] = useState(false)
  const [photoAttendanceSaving, setPhotoAttendanceSaving] = useState(false)
  const [photoReading, setPhotoReading] = useState(false)
  const [documentsReading, setDocumentsReading] = useState(false)
  const [holidayEmployeeId, setHolidayEmployeeId] = useState('')
  const [attendanceAction, setAttendanceAction] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const employeeResponse = await apiFetch('/api/employees')
      if (!employeeResponse.ok) throw new Error('Unable to load employee data.')
      const employeeData = await employeeResponse.json()
      setEmployees(employeeData)
      setHolidayEmployeeId(current =>
        current && employeeData.some(employee => String(employee.id) === current)
          ? current
          : employeeData.length > 0 ? String(employeeData[0].id) : '')

      const requestData = async (path) => {
        const response = await apiFetch(path)
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.message || body.detail || `Unable to load employee data (${response.status}).`)
        }
        return response.json()
      }
      const [attendanceData, holidayData, salaryData] = await Promise.all([
        requestData(`/api/employees/attendance?month=${selectedMonth}`),
        requestData(`/api/employees/holidays?month=${selectedMonth}`),
        requestData(`/api/employees/salaries?month=${selectedMonth}`),
      ])
      setAttendance(attendanceData)
      setHolidays(holidayData)
      setSalaries(salaryData)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load employee data.')
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => { loadData() }, [loadData])

  const attendanceByEmployeeAndDate = useMemo(() => {
    return attendance.reduce((result, record) => {
      const employeeKey = String(record.employeeId)
      const dateKey = toDateInput(record.date)
      if (!result[employeeKey]) result[employeeKey] = {}
      result[employeeKey][dateKey] = record
      return result
    }, {})
  }, [attendance])

  const attendanceByDate = useMemo(() => {
    return attendance.reduce((result, record) => {
      result[toDateInput(record.date)] = record
      return result
    }, {})
  }, [attendance])

  const holidaysByDate = useMemo(() => {
    return holidays.reduce((result, holiday) => {
      const dateKey = toDateInput(holiday.date)
      result[dateKey] = holiday
      return result
    }, {})
  }, [holidays])

  const calendarDays = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const selectedEmployeeId = holidayEmployeeId || ''
    const selectedEmployeeAttendance = attendanceByEmployeeAndDate[selectedEmployeeId] || {}
    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month - 1, index + 1)
      const dateKey = toDateInput(date)
      const record = selectedEmployeeAttendance[dateKey]
      const holiday = holidaysByDate[dateKey]
      return {
        date,
        record,
        holiday,
        isAbsent: Boolean(selectedEmployeeId && !record && !holiday),
      }
    })
  }, [attendanceByEmployeeAndDate, attendanceByDate, holidaysByDate, holidayEmployeeId, selectedMonth])

  const openNewEmployee = () => {
    setEditingEmployee(null)
    setEmployeeForm({ ...EMPTY_EMPLOYEE, employeeCode: getNextEmployeeCode(employees) })
    setShowEmployeeForm(true)
    setError('')
  }

  const openEditEmployee = (employee) => {
    setEditingEmployee(employee)
    setEmployeeForm({
      employeeCode: employee.employeeCode,
      name: employee.name,
      department: employee.department,
      salary: employee.salary || '',
      photoUrl: employee.photoUrl || '',
      photoName: employee.photoName || '',
      supportingDocuments: employee.supportingDocuments || [],
      active: employee.active !== false,
    })
    setShowEmployeeForm(true)
    setError('')
  }

  const saveEmployee = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    const payload = {
      ...employeeForm,
      salary: Number(employeeForm.salary),
    }
    try {
      const response = await apiFetch(editingEmployee ? `/api/employees/${editingEmployee.id}` : '/api/employees', {
        method: editingEmployee ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const responseText = await response.text()
        let body
        try {
          body = JSON.parse(responseText)
        } catch {
          body = null
        }
        const serverMessage = body?.message || body?.detail || body?.title || body?.error
        const responseMessage = serverMessage || responseText.trim().slice(0, 500)
        throw new Error(responseMessage
          ? `Unable to save employee (HTTP ${response.status}): ${responseMessage}`
          : `Unable to save employee (HTTP ${response.status}).`)
      }
      const saved = await response.json()
      const photoWasUploaded = employeeForm.photoUrl.startsWith('data:')
      const missingPhoto = photoWasUploaded && !saved.photoUrl
      const uploadedDocumentNames = employeeForm.supportingDocuments
        .filter(document => document.dataUrl)
        .map(document => document.name)
      const savedDocumentNames = [...(saved.supportingDocuments || [])]
        .filter(document => document.url)
        .map(document => document.name)
      const missingDocumentNames = uploadedDocumentNames.filter(name => {
        const savedIndex = savedDocumentNames.indexOf(name)
        if (savedIndex === -1) return true
        savedDocumentNames.splice(savedIndex, 1)
        return false
      })

      setEmployees(current => editingEmployee
        ? current.map(employee => employee.id === saved.id ? saved : employee)
        : [...current, saved])
      if (missingPhoto || missingDocumentNames.length > 0) {
        const missingFiles = [
          missingPhoto && 'photo',
          missingDocumentNames.length > 0 && `document${missingDocumentNames.length === 1 ? '' : 's'}: ${missingDocumentNames.join(', ')}`,
        ].filter(Boolean).join('; ')
        throw new Error(
          `Employee details were saved, but the ${missingFiles} were not confirmed as saved. ` +
          'Deploy the latest Google Apps Script and retry the upload.',
        )
      }
      setShowEmployeeForm(false)
      setMessage(editingEmployee ? 'Employee updated.' : `Employee added with code ${saved.employeeCode}.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save employee.')
    }
  }

  const readPhoto = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Select a valid image file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Photo must be 2 MB or smaller.')
      return
    }
    setPhotoReading(true)
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      setEmployeeForm(current => ({ ...current, photoUrl: reader.result, photoName: file.name }))
      setPhotoReading(false)
    }
    reader.onerror = () => {
      setError('Unable to read the selected photo.')
      setPhotoReading(false)
    }
    reader.readAsDataURL(file)
  }

  const readSupportingDocuments = async (files) => {
    const selectedFiles = Array.from(files || [])
    if (employeeForm.supportingDocuments.length + selectedFiles.length > MAX_SUPPORTING_DOCUMENTS) {
      setError(`You can attach up to ${MAX_SUPPORTING_DOCUMENTS} supporting documents.`)
      return
    }
    const invalidFile = selectedFiles.find(file =>
      file.size > MAX_SUPPORTING_DOCUMENT_SIZE ||
      (file.type !== 'application/pdf' && !ALLOWED_SUPPORTING_IMAGE_TYPES.has(file.type)))
    if (invalidFile) {
      setError(`${invalidFile.name} must be a PDF or supported image no larger than 2 MB.`)
      return
    }

    setDocumentsReading(true)
    setError('')
    try {
      const documents = await Promise.all(selectedFiles.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result,
        })
        reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`))
        reader.readAsDataURL(file)
      })))
      setEmployeeForm(current => ({
        ...current,
        supportingDocuments: [...current.supportingDocuments, ...documents],
      }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to read selected documents.')
    } finally {
      setDocumentsReading(false)
    }
  }

  const toggleHoliday = async (date) => {
    const dateKey = toDateInput(date)
    const holidayEmployee = employees.find(item => item.id === Number(holidayEmployeeId)) || employees[0]
    if (!holidayEmployee) return

    setAttendanceAction(dateKey)
    setError('')
    try {
      const existingHoliday = holidays.find(holiday => toDateInput(holiday.date) === dateKey)
      if (existingHoliday) {
        const response = await apiFetch(`/api/employees/holidays/${existingHoliday.id}`, { method: 'DELETE' })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.message || body.detail || 'Unable to remove holiday.')
        }
        setHolidays(current => current.filter(holiday => toDateInput(holiday.date) !== dateKey))
        setSalaries(current => current.filter(item =>
          !String(item.month).startsWith(selectedMonth) || item.status !== 'GENERATED'))
        setMessage(`${dateKey} was removed as a holiday for all employees.`)
        return
      }

      const response = await apiFetch('/api/employees/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: holidayEmployee.id, date: dateKey }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || body.detail || 'Unable to mark holiday.')
      }
      const holiday = await response.json()
      setHolidays(current => [...current, holiday])
      setSalaries(current => current.filter(item =>
        !String(item.month).startsWith(selectedMonth) || item.status !== 'GENERATED'))
      setMessage(`${dateKey} was marked as a holiday for all employees.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update holiday.')
    } finally {
      setAttendanceAction('')
    }
  }

  const toggleLeave = async (date, record, holiday) => {
    const dateKey = toDateInput(date)
    const employeeId = Number(holidayEmployeeId)
    const employee = employees.find(item => item.id === employeeId)
    if (!employee || holiday || (record && record.status !== 'LEAVE' &&
        (record.status === 'PRESENT' || record.inTime || record.outTime))) return

    setAttendanceAction(dateKey)
    setError('')
    try {
      const response = record?.status === 'LEAVE'
        ? await apiFetch(`/api/employees/attendance/leave?employeeId=${employeeId}&date=${dateKey}`, { method: 'DELETE' })
        : await apiFetch('/api/employees/attendance/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, date: dateKey }),
          })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || body.detail || 'Unable to update leave.')
      }
      const updatedRecord = await response.json()
      setAttendance(current => [
        ...current.filter(item => item.id !== updatedRecord.id),
        updatedRecord,
      ])
      setSalaries(current => current.filter(item =>
        item.employeeId !== employeeId || !String(item.month).startsWith(selectedMonth)))
      setMessage(`${employee.name} · ${dateKey} ${updatedRecord.status === 'LEAVE' ? 'marked as leave' : 'leave removed'}.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update leave.')
    } finally {
      setAttendanceAction('')
    }
  }

  const openClock = (employee, mode, date = getLocalDateInput()) => {
    const record = attendanceByEmployeeAndDate[String(employee.id)]?.[date]
    const now = getLocalTimeInput()
    setShowClock({
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.name,
      record,
    })
    setClockMode(mode)
    setClockDate(date)
    setClockInTime(record?.inTime || (date === getLocalDateInput() && mode !== 'out' ? now : ''))
    setClockOutTime(record?.outTime || (date === getLocalDateInput() && mode === 'out' ? now : ''))
  }

  const clockAttendance = async () => {
    if (!showClock) return
    const inTime = clockInTime
    const outTime = clockOutTime
    if (!inTime && !outTime) {
      setError('Enter an in time or out time before saving attendance.')
      return
    }
    setClockSaving(true)
    setError('')
    try {
      const response = await apiFetch('/api/employees/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: showClock.employeeId,
          date: clockDate,
          inTime,
          outTime,
          photoUrl: '',
          replaceTimes: true,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || body.detail || body.title || body.error ||
          `Attendance could not be saved (HTTP ${response.status}).`)
      }
      const recordedAttendance = await response.json()
      setAttendance(current => [
        ...current.filter(record =>
          !(Number(record.employeeId) === Number(recordedAttendance.employeeId) &&
            toDateInput(record.date) === clockDate)),
        recordedAttendance,
      ])
      setShowClock(null)
      setMessage(`${showClock.employeeName} attendance saved for ${clockDate}.`)
      setSalaries(current => current.filter(item =>
        Number(item.employeeId) !== Number(showClock.employeeId) ||
        !String(item.month).startsWith(clockDate.slice(0, 7))))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Attendance could not be saved.')
    } finally {
      setClockSaving(false)
    }
  }

  const recordPhotoAttendance = async (employee) => {
    if (photoAttendanceSaving || loading || !photoAttendanceDate) return
    const existing = attendanceByEmployeeAndDate[String(employee.id)]?.[photoAttendanceDate]
    if (existing?.status === 'LEAVE') {
      setError(`Remove ${employee.name}'s leave record before recording attendance for ${photoAttendanceDate}.`)
      return
    }
    if (existing?.inTime && existing?.outTime) {
      setError(`${employee.name} already has both times recorded for ${photoAttendanceDate}.`)
      return
    }

    setPhotoAttendanceSaving(true)
    setError('')
    setMessage('')
    const currentTime = getLocalTimeInput()
    const recordingOutTime = Boolean(existing?.inTime)
    try {
      const response = await apiFetch('/api/employees/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          date: photoAttendanceDate,
          inTime: recordingOutTime ? '' : currentTime,
          outTime: recordingOutTime ? currentTime : '',
          photoUrl: '',
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || body.detail || body.title || body.error ||
          `Attendance could not be saved (HTTP ${response.status}).`)
      }
      const recordedAttendance = await response.json()
      setAttendance(current => [
        ...current.filter(record =>
          !(Number(record.employeeId) === Number(recordedAttendance.employeeId) &&
            toDateInput(record.date) === photoAttendanceDate)),
        recordedAttendance,
      ])
      setMessage(`${employee.name} clocked ${recordingOutTime ? 'out' : 'in'} at ${currentTime} on ${photoAttendanceDate}.`)
      setSalaries(current => current.filter(item =>
        Number(item.employeeId) !== Number(employee.id) ||
        !String(item.month).startsWith(photoAttendanceDate.slice(0, 7))))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Attendance could not be saved.')
    } finally {
      setPhotoAttendanceSaving(false)
    }
  }

  const generateSalary = async (employee) => {
    const response = await apiFetch('/api/employees/salaries/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: employee.id, month: selectedMonth + '-01' }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setError(body.message || body.detail || 'Salary generation failed.')
      return
    }
    const generated = await response.json()
    setSalaries(current => {
      const withoutEmployee = current.filter(item => item.employeeId !== employee.id)
      return [...withoutEmployee, generated]
    })
    setMessage(`${employee.name} salary generated for ${selectedMonth}.`)
  }

  const updateSalaryStatus = async (salary, status) => {
    const response = await apiFetch(`/api/employees/salaries/${salary.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, receivedAt: status === 'RECEIVED' ? new Date().toISOString().slice(0, 10) : null }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setError(body.message || body.detail || 'Salary status could not be updated.')
      return
    }
    const updatedSalary = await response.json()
    setSalaries(current => current.map(item => item.id === salary.id ? updatedSalary : item))
  }

  const employeeExportDetails = (record) => {
    const employee = employees.find(item => String(item.id) === String(record.employeeId))
    return {
      ...record,
      employeeCode: record.employeeCode || employee?.employeeCode || '',
      employeeName: record.employeeName || employee?.name || '',
      overtimeHours: Number(formatOvertimeHours(record.overtimeHours)),
    }
  }

  const exportAttendance = async () => {
    await downloadWorkbook(`Attendance-${selectedMonth}.xlsx`, [{
      name: 'Attendance',
      columns: [
        { header: 'Employee Code', key: 'employeeCode' },
        { header: 'Employee Name', key: 'employeeName' },
        { header: 'Date', key: 'date' },
        { header: 'In Time', key: 'inTime' },
        { header: 'Out Time', key: 'outTime' },
        { header: 'Hours', key: 'hours' },
        { header: 'Overtime Hours', key: 'overtimeHours' },
        { header: 'Status', key: 'status' },
      ],
      rows: attendance.map(employeeExportDetails),
    }])
  }

  const exportSalaries = async () => {
    await downloadWorkbook(`Salary-${selectedMonth}.xlsx`, [{
      name: 'Salary',
      columns: [
        { header: 'Employee Code', key: 'employeeCode' },
        { header: 'Employee Name', key: 'employeeName' },
        { header: 'Month', key: 'month' },
        { header: 'Paid Days', key: 'paidDays' },
        { header: 'Holiday Count', key: 'holidayCount' },
        { header: 'Regular Hours', key: 'regularHours' },
        { header: 'Overtime Hours', key: 'overtimeHours' },
        { header: 'Regular Pay (₹)', key: 'regularPay' },
        { header: 'Overtime Pay (₹)', key: 'overtimePay' },
        { header: 'Total Amount (₹)', key: 'totalAmount' },
        { header: 'Status', key: 'status' },
      ],
      rows: salaries.map(employeeExportDetails),
    }])
  }

  return (
    <section className="page employee-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workforce</p>
          <h2>Employees</h2>
        </div>
        <button className="btn btn--primary" onClick={openNewEmployee}>+ Add Employee</button>
      </div>

      {message && <div className="status status--success">{message}</div>}
      {error && <div className="status status--error">{error}</div>}

      <div className="employee-toolbar">
        <label>Month <input type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} /></label>
        <label>Attendance date
          <input
            type="date"
            value={photoAttendanceDate}
            onChange={event => {
              const date = event.target.value
              setPhotoAttendanceDate(date)
              if (date) setSelectedMonth(date.slice(0, 7))
            }}
          />
        </label>
        <div className="employee-toolbar-actions">
          <button className="btn btn--secondary" onClick={exportAttendance}>Export Attendance</button>
          <button className="btn btn--secondary" onClick={exportSalaries}>Export Salary</button>
        </div>
      </div>

      {loading ? <div className="empty-state">Loading employees...</div> : employees.length === 0 ? (
        <div className="empty-state">No employees have been added yet.</div>
      ) : (
        <div className="employee-grid">
          {employees.map(employee => {
            const records = attendanceByEmployeeAndDate[String(employee.id)] || {}
            const record = Object.values(records).at(-1)
            const selectedDateRecord = records[photoAttendanceDate]
            const attendanceComplete = Boolean(selectedDateRecord?.inTime && selectedDateRecord?.outTime)
            return (
              <article className="employee-card" key={employee.id}>
                <div className="employee-photo-wrap">
                  <button
                    className="employee-photo"
                    onClick={() => recordPhotoAttendance(employee)}
                    disabled={loading || photoAttendanceSaving || !photoAttendanceDate || attendanceComplete}
                    aria-label={`${attendanceComplete ? 'Attendance complete for' : selectedDateRecord?.inTime ? 'Clock out' : 'Clock in'} ${employee.name} on ${photoAttendanceDate}`}
                  >
                    {employee.photoUrl ? <img src={employee.photoUrl} alt={employee.name} /> : <span>{employee.name.slice(0, 1).toUpperCase()}</span>}
                    <span className="employee-photo-hint">
                      {photoAttendanceSaving ? 'Saving attendance...' : attendanceComplete ? 'Attendance complete' : selectedDateRecord?.inTime ? 'Tap to clock out' : 'Tap to clock in'}
                    </span>
                  </button>
                  <div className="employee-card-actions">
                    <button type="button" onClick={() => openEditEmployee(employee)} title="Edit employee" aria-label={`Edit ${employee.name}`}>✎</button>
                    <button type="button" onClick={() => openClock(employee, 'out')} title="Clock out" aria-label={`Edit attendance for ${employee.name}`}>↗</button>
                  </div>
                </div>
                <div className="employee-card-copy">
                  <h3>{employee.name}</h3>
                  <p>{employee.department} · {formatMoney(employee.salary)} monthly</p>
                  <span className={`attendance-badge ${record ? STATUS_CLASS[record.status] || 'present' : 'absent'}`}>
                    {record ? `${record.status} · ${record.date}` : 'No attendance'}
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="employee-section">
        <div className="section-heading">
          <div><h3>Monthly Attendance Calendar</h3><p>{holidayEmployeeId
            ? 'Showing this employee’s attendance, leave, and shared holidays.'
            : 'Holidays are shown read-only for all employees. Select an employee to view leave and attendance.'}</p></div>
          <label className="holiday-employee-select">View
            <select value={holidayEmployeeId} onChange={event => setHolidayEmployeeId(event.target.value)}>
              <option value="">Holidays only</option>
              {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </label>
        </div>
        <div className="attendance-calendar-scroll">
          <div className="attendance-calendar">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div className="calendar-weekday" key={day}>{day}</div>)}
            {calendarDays.length > 0 && Array.from(
              { length: calendarDays[0].date.getDay() },
              (_, index) => <div className="calendar-day calendar-day--empty" aria-hidden="true" key={`empty-${index}`} />,
            )}
            {calendarDays.map(({ date, record, holiday, isAbsent }) => (
              <div
                className={`calendar-day ${record ? `calendar-day--${record.status.toLowerCase()}` : ''} ${isAbsent ? 'calendar-day--absent' : ''} ${record?.overtimeHours > 0 ? 'calendar-day--overtime' : ''} ${holiday ? 'calendar-day--holiday' : ''}`}
                key={date.toISOString()}
              >
                <div className="calendar-day-info">
                  <span className="calendar-day-date">{date.getDate()}</span>
                  {holiday && <small>HOLIDAY</small>}
                  {record?.status === 'LEAVE' && <small>LEAVE</small>}
                  {record && (record.inTime || record.outTime) && <small>{record.inTime || '—'} / {record.outTime || '—'}</small>}
                  {record?.overtimeHours > 0 && <small>OT {formatOvertimeHours(record.overtimeHours)}h</small>}
                </div>
                <div className="calendar-day-actions">
                  {holidayEmployeeId && (
                    <button
                      type="button"
                      onClick={() => {
                        const employee = employees.find(item => String(item.id) === String(holidayEmployeeId))
                        if (employee) openClock(employee, 'attendance', toDateInput(date))
                      }}
                      disabled={Boolean(attendanceAction) || Boolean(holiday) || record?.status === 'LEAVE'}
                      title="Add or complete attendance for this date"
                      aria-label={`Edit attendance for ${toDateInput(date)}`}
                    >
                      <span className="calendar-action-full">Edit times</span>
                      <span className="calendar-action-short">Times</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleHoliday(date)}
                    disabled={Boolean(attendanceAction) || employees.length === 0}
                    title={holiday ? 'Remove holiday for all employees' : 'Mark holiday for all employees'}
                    aria-label={`${holiday ? 'Remove' : 'Mark'} holiday for all employees on ${toDateInput(date)}`}
                  >
                    <span className="calendar-action-full">{holiday ? 'Unmark holiday' : 'Holiday (all)'}</span>
                    <span className="calendar-action-short">{holiday ? 'Unmark' : 'Holiday'}</span>
                  </button>
                  {holidayEmployeeId && (
                    <button
                      type="button"
                      onClick={() => toggleLeave(date, record, holiday)}
                      disabled={Boolean(attendanceAction) || Boolean(holiday) ||
                        (Boolean(record) && record.status !== 'LEAVE' &&
                          (record.status === 'PRESENT' || record.inTime || record.outTime))}
                      title={record?.status === 'LEAVE' ? 'Remove leave' : 'Mark leave'}
                      aria-label={`${record?.status === 'LEAVE' ? 'Remove' : 'Mark'} leave for the selected employee on ${toDateInput(date)}`}
                    >
                      <span className="calendar-action-full">{record?.status === 'LEAVE' ? 'Unmark leave' : 'Leave'}</span>
                      <span className="calendar-action-short">{record?.status === 'LEAVE' ? 'Unmark' : 'Leave'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="employee-section">
        <div className="section-heading">
          <div><h3>Monthly Salary</h3><p>Holidays and up to two absences are paid. Additional absences are deducted at the daily rate; overtime is paid hourly.</p></div>
        </div>
        <div className="salary-list">
          {employees.map(employee => {
            const salary = salaries.find(item => item.employeeId === employee.id)
            return (
              <article className="salary-row" key={employee.id}>
                <div><strong>{employee.name}</strong><span>{employee.employeeCode} · {employee.department}</span></div>
                <div className="salary-amount"><strong>{formatMoney(salary?.totalAmount)}</strong><span>{salary ? `${salary.paidDays} paid days · ${salary.holidayCount} holidays · ${salary.regularHours} regular · ${formatOvertimeHours(salary.overtimeHours)} OT` : 'Not generated'}</span></div>
                <div className="salary-actions">
                  <button className="btn btn--secondary btn--small" onClick={() => generateSalary(employee)}>Generate</button>
                  {salary && <button className="btn btn--primary btn--small" onClick={() => updateSalaryStatus(salary, 'RECEIVED')}>{salary.status === 'RECEIVED' ? 'Received' : 'Mark Received'}</button>}
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {showEmployeeForm && (
        <div className="modal-overlay" onClick={() => setShowEmployeeForm(false)}>
          <form className="modal-content employee-modal" onSubmit={saveEmployee} onClick={event => event.stopPropagation()}>
            <div className="modal-header"><div><h2>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</h2></div><button type="button" className="modal-close" onClick={() => setShowEmployeeForm(false)}>×</button></div>
            <div className="form-grid">
              <label>Employee Code<input value={employeeForm.employeeCode} readOnly /></label>
              {!editingEmployee && <p className="form-grid--full employee-code-hint">Assigned automatically for the current financial year.</p>}
              <label>Name<input required value={employeeForm.name} onChange={event => setEmployeeForm(current => ({ ...current, name: event.target.value }))} /></label>
              <label>Department<input required value={employeeForm.department} onChange={event => setEmployeeForm(current => ({ ...current, department: event.target.value }))} /></label>
              <label>Monthly Salary (₹)<input required type="number" min="0" step="0.01" value={employeeForm.salary} onChange={event => setEmployeeForm(current => ({ ...current, salary: event.target.value }))} /></label>
              <label className="form-grid--full">Photo<input type="file" accept="image/*" onChange={event => readPhoto(event.target.files?.[0])} disabled={photoReading} /></label>
              {employeeForm.photoUrl && <div className="form-grid--full employee-photo-preview"><img src={employeeForm.photoUrl} alt="Employee preview" /><span>{employeeForm.photoName}</span></div>}
              <label className="form-grid--full">Supporting documents (PDF or images, up to 5 files, 2 MB each)
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/gif,image/webp,image/bmp,image/heic,image/heif,image/avif"
                  multiple
                  disabled={documentsReading}
                  onChange={event => {
                    readSupportingDocuments(event.target.files)
                    event.target.value = ''
                  }}
                />
              </label>
              {employeeForm.supportingDocuments.length > 0 && (
                <ul className="form-grid--full employee-supporting-documents">
                  {employeeForm.supportingDocuments.map((document, index) => (
                    <li key={`${document.name}-${index}`}>
                      {document.url
                        ? <a href={document.url} target="_blank" rel="noreferrer">{document.name}</a>
                        : <span>{document.name}</span>}
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        onClick={() => setEmployeeForm(current => ({
                          ...current,
                          supportingDocuments: current.supportingDocuments.filter((_, itemIndex) => itemIndex !== index),
                        }))}
                        disabled={documentsReading}
                        aria-label={`Remove ${document.name}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="form-grid--full"><input type="checkbox" checked={employeeForm.active} onChange={event => setEmployeeForm(current => ({ ...current, active: event.target.checked }))} /> Active employee</label>
            </div>
            <div className="modal-actions"><button type="button" className="btn btn--ghost" onClick={() => setShowEmployeeForm(false)}>Cancel</button><button type="submit" className="btn btn--primary" disabled={photoReading || documentsReading}>{photoReading || documentsReading ? 'Reading files...' : editingEmployee ? 'Save Changes' : 'Add Employee'}</button></div>
          </form>
        </div>
      )}

      {showClock && (
        <div className="modal-overlay" onClick={() => !clockSaving && setShowClock(null)}>
          <div className="modal-content employee-clock-modal" onClick={event => event.stopPropagation()}>
            <div className="modal-header"><div><h2>{clockMode === 'attendance' ? 'Attendance' : clockMode === 'in' ? 'Clock In' : 'Clock Out'} · {showClock.employeeName}</h2></div><button className="modal-close" onClick={() => setShowClock(null)} disabled={clockSaving}>×</button></div>
            <label>Date
              <input
                type="date"
                value={clockDate}
                onChange={event => {
                  const employee = employees.find(item => Number(item.id) === Number(showClock.employeeId))
                  if (employee) openClock(employee, clockMode, event.target.value)
                }}
                disabled={clockSaving}
              />
            </label>
            <label>In time
              <input
                type="time"
                value={clockInTime}
                onChange={event => {
                  setClockInTime(event.target.value)
                  event.currentTarget.blur()
                }}
                disabled={clockSaving}
              />
            </label>
            <label>Out time
              <input
                type="time"
                value={clockOutTime}
                onChange={event => {
                  setClockOutTime(event.target.value)
                  event.currentTarget.blur()
                }}
                disabled={clockSaving}
              />
            </label>
            <div className="modal-actions"><button className="btn btn--ghost" onClick={() => setShowClock(null)} disabled={clockSaving}>Cancel</button><button className="btn btn--primary" onClick={clockAttendance} disabled={clockSaving || !clockDate || (!clockInTime && !clockOutTime)}>{clockSaving ? 'Saving...' : 'Save Attendance'}</button></div>
          </div>
        </div>
      )}
    </section>
  )
}
