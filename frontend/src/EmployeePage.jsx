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
  active: true,
}

const STATUS_CLASS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  GENERATED: 'generated',
  RECEIVED: 'received',
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

function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
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
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [employeeForm, setEmployeeForm] = useState(EMPTY_EMPLOYEE)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const [showClock, setShowClock] = useState(null)
  const [clockMode, setClockMode] = useState('in')
  const [clockTime, setClockTime] = useState('')
  const [clockSaving, setClockSaving] = useState(false)
  const [photoReading, setPhotoReading] = useState(false)
  const [holidayEmployeeId, setHolidayEmployeeId] = useState('')
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

  const holidaysByEmployeeAndDate = useMemo(() => {
    return holidays.reduce((result, holiday) => {
      const employeeKey = String(holiday.employeeId)
      const dateKey = toDateInput(holiday.date)
      if (!result[employeeKey]) result[employeeKey] = {}
      result[employeeKey][dateKey] = holiday
      return result
    }, {})
  }, [holidays])

  const calendarDays = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const selectedEmployeeId = holidayEmployeeId || ''
    const selectedEmployeeAttendance = attendanceByEmployeeAndDate[selectedEmployeeId] || {}
    const selectedEmployeeHolidays = holidaysByEmployeeAndDate[selectedEmployeeId] || {}
    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month - 1, index + 1)
      const dateKey = toDateInput(date)
      const record = selectedEmployeeAttendance[dateKey]
      return {
        date,
        record,
        holiday: selectedEmployeeHolidays[dateKey],
        isAbsent: Boolean(selectedEmployeeId && !record && !selectedEmployeeHolidays[dateKey]),
      }
    })
  }, [attendanceByEmployeeAndDate, attendanceByDate, holidaysByEmployeeAndDate, holidayEmployeeId, selectedMonth])

  const openNewEmployee = () => {
    setEditingEmployee(null)
    setEmployeeForm({ ...EMPTY_EMPLOYEE })
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
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || body.detail || 'Unable to save employee.')
      }
      const saved = await response.json()
      setEmployees(current => editingEmployee
        ? current.map(employee => employee.id === saved.id ? saved : employee)
        : [...current, saved])
      setShowEmployeeForm(false)
      setMessage(editingEmployee ? 'Employee updated.' : 'Employee added.')
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

  const toggleHoliday = async (date) => {
    const dateKey = toDateInput(date)
    const holidayEmployee = employees.find(item => item.id === Number(holidayEmployeeId))
    if (!holidayEmployee) return

    const existingHoliday = holidays.find(holiday => holiday.employeeId === holidayEmployee.id && toDateInput(holiday.date) === dateKey)
    if (existingHoliday) {
      const response = await apiFetch(`/api/employees/holidays/${existingHoliday.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Unable to remove holiday.')
      setHolidays(current => current.filter(holiday => holiday.id !== existingHoliday.id))
      setMessage(`${holidayEmployee.name} · ${dateKey} was marked as a working day.`)
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
    setMessage(`${dateKey} was marked as a holiday.`)
  }

  const openClock = (employee, mode) => {
    setShowClock({ employeeId: employee.id, employeeCode: employee.employeeCode, employeeName: employee.name })
    setClockMode(mode)
    setClockTime(new Date().toTimeString().slice(0, 5))
  }

  const clockAttendance = async () => {
    if (!showClock) return
    const response = await apiFetch('/api/employees/attendance/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: showClock.employeeId,
        date: new Date().toISOString().slice(0, 10),
        inTime: clockMode === 'in' ? clockTime : '',
        outTime: clockMode === 'out' ? clockTime : '',
        photoUrl: '',
      }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setError(body.message || body.detail || 'Attendance could not be saved.')
      return
    }
    const recordedAttendance = await response.json()
    setAttendance(current => [...current, recordedAttendance])
    setShowClock(null)
    setMessage(`${showClock.employeeName} marked ${clockMode === 'in' ? 'clock-in' : 'clock-out'}.`)
    await loadData()
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
        { header: 'Regular Pay', key: 'regularPay' },
        { header: 'Overtime Pay', key: 'overtimePay' },
        { header: 'Total Amount', key: 'totalAmount' },
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
            return (
              <article className="employee-card" key={employee.id}>
                <div className="employee-photo-wrap">
                  <button className="employee-photo" onClick={() => openClock(employee, 'in')} aria-label={`Clock in ${employee.name}`}>
                    {employee.photoUrl ? <img src={employee.photoUrl} alt={employee.name} /> : <span>{employee.name.slice(0, 1).toUpperCase()}</span>}
                    <span className="employee-photo-hint">Click to clock in</span>
                  </button>
                  <div className="employee-card-actions">
                    <button type="button" onClick={() => openEditEmployee(employee)} title="Edit employee">✎</button>
                    <button type="button" onClick={() => openClock(employee, 'out')} title="Clock out">↗</button>
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
          <div><h3>Monthly Attendance Calendar</h3><p>Present, absent, overtime, and employee-specific holiday entries</p></div>
          <label className="holiday-employee-select">Holiday employee
            <select value={holidayEmployeeId} onChange={event => setHolidayEmployeeId(event.target.value)}>
              <option value="">Select employee</option>
              {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </label>
        </div>
        <div className="attendance-calendar">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div className="calendar-weekday" key={day}>{day}</div>)}
              {calendarDays.map(({ date, record, holiday, isAbsent }) => (
            <button
              type="button"
              className={`calendar-day ${record ? `calendar-day--${record.status.toLowerCase()}` : ''} ${isAbsent ? 'calendar-day--absent' : ''} ${record?.overtimeHours > 0 ? 'calendar-day--overtime' : ''} ${holiday ? 'calendar-day--holiday' : ''}`}
              key={date.toISOString()}
              onClick={() => toggleHoliday(date)}
              disabled={!holidayEmployeeId}
              title={holiday ? 'Click to remove this holiday' : 'Click to mark this date as a holiday'}
            >
              <span>{date.getDate()}</span>
              {holiday && <small>HOLIDAY</small>}
              {record && <small>{record.inTime || '—'} / {record.outTime || '—'}</small>}
              {record?.overtimeHours > 0 && <small>OT {record.overtimeHours}h</small>}
            </button>
          ))}
        </div>
      </div>

      <div className="employee-section">
        <div className="section-heading">
          <div><h3>Monthly Salary</h3><p>Salary is calculated from daily rate and completed attendance hours.</p></div>
        </div>
        <div className="salary-list">
          {employees.map(employee => {
            const salary = salaries.find(item => item.employeeId === employee.id)
            return (
              <article className="salary-row" key={employee.id}>
                <div><strong>{employee.name}</strong><span>{employee.employeeCode} · {employee.department}</span></div>
                <div className="salary-amount"><strong>{formatMoney(salary?.totalAmount)}</strong><span>{salary ? `${salary.paidDays} paid days · ${salary.holidayCount} holidays · ${salary.regularHours} regular · ${salary.overtimeHours} OT` : 'Not generated'}</span></div>
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
              <label>Employee Code<input required value={employeeForm.employeeCode} onChange={event => setEmployeeForm(current => ({ ...current, employeeCode: event.target.value }))} /></label>
              <label>Name<input required value={employeeForm.name} onChange={event => setEmployeeForm(current => ({ ...current, name: event.target.value }))} /></label>
              <label>Department<input required value={employeeForm.department} onChange={event => setEmployeeForm(current => ({ ...current, department: event.target.value }))} /></label>
              <label>Monthly Salary<input required type="number" min="0" step="0.01" value={employeeForm.salary} onChange={event => setEmployeeForm(current => ({ ...current, salary: event.target.value }))} /></label>
              <label className="form-grid--full">Photo<input type="file" accept="image/*" onChange={event => readPhoto(event.target.files?.[0])} disabled={photoReading} /></label>
              {employeeForm.photoUrl && <div className="form-grid--full employee-photo-preview"><img src={employeeForm.photoUrl} alt="Employee preview" /><span>{employeeForm.photoName}</span></div>}
              <label className="form-grid--full"><input type="checkbox" checked={employeeForm.active} onChange={event => setEmployeeForm(current => ({ ...current, active: event.target.checked }))} /> Active employee</label>
            </div>
            <div className="modal-actions"><button type="button" className="btn btn--ghost" onClick={() => setShowEmployeeForm(false)}>Cancel</button><button type="submit" className="btn btn--primary" disabled={photoReading}>{photoReading ? 'Reading photo...' : editingEmployee ? 'Save Changes' : 'Add Employee'}</button></div>
          </form>
        </div>
      )}

      {showClock && (
        <div className="modal-overlay" onClick={() => !clockSaving && setShowClock(null)}>
          <div className="modal-content employee-clock-modal" onClick={event => event.stopPropagation()}>
            <div className="modal-header"><div><h2>{clockMode === 'in' ? 'Clock In' : 'Clock Out'} · {showClock.employeeName}</h2></div><button className="modal-close" onClick={() => setShowClock(null)} disabled={clockSaving}>×</button></div>
            <label>Time<input type="time" value={clockTime} onChange={event => setClockTime(event.target.value)} disabled={clockSaving} /></label>
            <div className="modal-actions"><button className="btn btn--ghost" onClick={() => setShowClock(null)} disabled={clockSaving}>Cancel</button><button className="btn btn--primary" onClick={clockAttendance} disabled={clockSaving || !clockTime}>{clockSaving ? 'Saving...' : 'Save Attendance'}</button></div>
          </div>
        </div>
      )}
    </section>
  )
}
