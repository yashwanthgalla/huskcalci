import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import './App.css'

interface WeighbridgeLog {
  id: string
  serialNumber: number
  date: string
  name: string
  vehicleNumber: string
  rstNumber: string
  grossWeight: number
  tareWeight: number
  netWeight: number
  rate: number
  amount: number
}

interface FormState {
  serialNumber: string
  date: string
  name: string
  vehicleNumber: string
  rstNumber: string
  grossWeight: string
  tareWeight: string
  netWeight: string
  rate: string
  amount: string
}

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export default function App() {
  // --- Persistent State ---
  const [logs, setLogs] = useState<WeighbridgeLog[]>(() => {
    const saved = localStorage.getItem('weighbridge_logs')
    return saved ? JSON.parse(saved) : []
  })

  // --- UI & Filtering States ---
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toasts, setToasts] = useState<Toast[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())

  // --- Sorting State ---
  const [sortConfig, setSortConfig] = useState<{
    key: keyof WeighbridgeLog | null
    direction: 'asc' | 'desc'
  }>({ key: 'serialNumber', direction: 'desc' })

  // --- Form Auto-Calculation Helper State ---
  // Suggest the next serial number
  const nextSerialNumber = useMemo(() => {
    if (logs.length === 0) return 1
    const serials = logs.map(l => l.serialNumber).filter(s => !isNaN(s))
    return serials.length > 0 ? Math.max(...serials) + 1 : 1
  }, [logs])

  const initialFormState = (): FormState => ({
    serialNumber: String(nextSerialNumber),
    date: new Date().toISOString().split('T')[0],
    name: '',
    vehicleNumber: '',
    rstNumber: '',
    grossWeight: '',
    tareWeight: '',
    netWeight: '0',
    rate: '',
    amount: '0',
  })

  const [form, setForm] = useState<FormState>(initialFormState)

  // Sync serial number recommendation when logs change (only if not editing and serial number is default)
  useEffect(() => {
    if (!editingId) {
      setForm(prev => ({
        ...prev,
        serialNumber: prev.serialNumber === '' || prev.serialNumber === String(nextSerialNumber - 1) 
          ? String(nextSerialNumber) 
          : prev.serialNumber
      }))
    }
  }, [nextSerialNumber, editingId])

  // --- Local Storage Sync ---
  useEffect(() => {
    localStorage.setItem('weighbridge_logs', JSON.stringify(logs))
  }, [logs])

  // --- Clock Component Tick ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // --- Auto-calculators for Value ---
  const netNum = parseFloat(form.netWeight) || 0
  const rateNum = parseFloat(form.rate) || 0

  const calculatedAmount = useMemo(() => {
    return Math.round(netNum * rateNum * 100) / 100
  }, [netNum, rateNum])

  // Update calculated fields in form state
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      amount: String(calculatedAmount),
    }))
  }, [calculatedAmount])

  // --- Toast Manager ---
  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  // --- Datadist Autocomplete Suggestions ---
  const uniqueNames = useMemo(() => Array.from(new Set(logs.map(l => l.name).filter(Boolean))), [logs])
  const uniqueVehicles = useMemo(() => Array.from(new Set(logs.map(l => l.vehicleNumber).filter(Boolean))), [logs])

  // --- Input Change Handler ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    let formattedValue = value

    if (name === 'vehicleNumber') {
      formattedValue = value.toUpperCase()
    }

    setForm(prev => ({
      ...prev,
      [name]: formattedValue
    }))
  }

  // --- Log Submission (Add / Edit) ---
  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault()

    const serialNum = parseInt(form.serialNumber)
    const gross = parseFloat(form.grossWeight)
    const tare = parseFloat(form.tareWeight)
    const net = parseFloat(form.netWeight)
    const rateVal = parseFloat(form.rate)

    // Form validation
    if (isNaN(serialNum) || serialNum <= 0) {
      triggerToast('Please enter a valid positive Serial Number.', 'error')
      return
    }
    if (!form.date) {
      triggerToast('Please select a Date.', 'error')
      return
    }
    if (!form.name.trim()) {
      triggerToast('Please enter a Customer or Supplier Name.', 'error')
      return
    }
    if (!form.vehicleNumber.trim()) {
      triggerToast('Please enter a Vehicle Number.', 'error')
      return
    }
    if (!form.rstNumber.trim()) {
      triggerToast('Please enter an RST Number.', 'error')
      return
    }
    if (isNaN(gross) || gross <= 0) {
      triggerToast('Please enter a valid Gross Weight greater than 0.', 'error')
      return
    }
    if (isNaN(tare) || tare < 0) {
      triggerToast('Please enter a valid Tare Weight.', 'error')
      return
    }
    if (isNaN(net) || net < 0) {
      triggerToast('Please enter a valid Net Weight.', 'error')
      return
    }
    if (isNaN(rateVal) || rateVal < 0) {
      triggerToast('Please enter a valid Rate.', 'error')
      return
    }

    const amt = Math.round(net * rateVal * 100) / 100

    const updatedLog: WeighbridgeLog = {
      id: editingId || Math.random().toString(36).substring(2, 9),
      serialNumber: serialNum,
      date: form.date,
      name: form.name.trim(),
      vehicleNumber: form.vehicleNumber.trim(),
      rstNumber: form.rstNumber.trim(),
      grossWeight: gross,
      tareWeight: tare,
      netWeight: net,
      rate: rateVal,
      amount: amt
    }

    if (editingId) {
      // Edit mode
      setLogs(prev => prev.map(log => log.id === editingId ? updatedLog : log))
      triggerToast(`Log Entry #${serialNum} updated successfully!`, 'success')
      setEditingId(null)
    } else {
      // Check duplicate serial number
      if (logs.some(l => l.serialNumber === serialNum)) {
        triggerToast(`Serial Number ${serialNum} already exists. Please use a unique one.`, 'error')
        return
      }
      // Add mode
      setLogs(prev => [updatedLog, ...prev])
      triggerToast(`Log Entry #${serialNum} created successfully!`, 'success')
    }

    // Reset Form
    setForm({
      serialNumber: String(editingId ? nextSerialNumber : nextSerialNumber + 1),
      date: form.date, // keep the date for speed entry
      name: '',
      vehicleNumber: '',
      rstNumber: '',
      grossWeight: '',
      tareWeight: '',
      netWeight: '',
      rate: form.rate, // keep rate for ease of repeated entry
      amount: '0'
    })
  }

  // --- Cancel Edit Mode ---
  const handleCancelEdit = () => {
    setEditingId(null)
    setForm(initialFormState())
    triggerToast('Edit cancelled.', 'info')
  }

  // --- Trigger Edit Mode ---
  const handleEditClick = (log: WeighbridgeLog) => {
    setEditingId(log.id)
    setForm({
      serialNumber: String(log.serialNumber),
      date: log.date,
      name: log.name,
      vehicleNumber: log.vehicleNumber,
      rstNumber: log.rstNumber,
      grossWeight: String(log.grossWeight),
      tareWeight: String(log.tareWeight),
      netWeight: String(log.netWeight),
      rate: String(log.rate),
      amount: String(log.amount),
    })
    triggerToast(`Editing Entry #${log.serialNumber}`, 'info')
  }

  // --- Delete Single Record ---
  const handleDeleteClick = (id: string, serial: number) => {
    if (window.confirm(`Are you sure you want to delete Log Entry #${serial}?`)) {
      setLogs(prev => prev.filter(log => log.id !== id))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (editingId === id) {
        setEditingId(null)
        setForm(initialFormState())
      }
      triggerToast(`Entry #${serial} deleted successfully.`, 'success')
    }
  }

  // --- Clear Database ---
  const handleClearAll = () => {
    if (window.confirm('WARNING: Are you sure you want to delete ALL weighbridge log records? This action is irreversible.')) {
      setLogs([])
      setSelectedIds(new Set())
      setEditingId(null)
      setForm(initialFormState())
      triggerToast('All data has been cleared.', 'success')
    }
  }

  // --- Multi-Select Row Handlers ---
  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = (filteredIds: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allFilteredSelected = filteredIds.every(id => next.has(id))

      if (allFilteredSelected) {
        // Deselect all filtered
        filteredIds.forEach(id => next.delete(id))
      } else {
        // Select all filtered
        filteredIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  // --- Sorting Handlers ---
  const handleSort = (key: keyof WeighbridgeLog) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // --- Filter and Sort Computations ---
  const filteredAndSortedLogs = useMemo(() => {
    let result = [...logs]

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(log => 
        log.name.toLowerCase().includes(query) ||
        log.vehicleNumber.toLowerCase().includes(query) ||
        log.rstNumber.toLowerCase().includes(query) ||
        String(log.serialNumber).includes(query)
      )
    }

    // Date range filter
    if (startDate) {
      result = result.filter(log => log.date >= startDate)
    }
    if (endDate) {
      result = result.filter(log => log.date <= endDate)
    }

    // Sort
    if (sortConfig.key) {
      const { key, direction } = sortConfig
      result.sort((a, b) => {
        const aVal = a[key]
        const bVal = b[key]
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return direction === 'asc' ? aVal - bVal : bVal - aVal
        }
        return direction === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal))
      })
    }

    return result
  }, [logs, searchQuery, startDate, endDate, sortConfig])

  // Get active selected IDs that are actually in the filtered set
  const filteredIds = useMemo(() => filteredAndSortedLogs.map(l => l.id), [filteredAndSortedLogs])
  const selectedFilteredCount = useMemo(() => 
    filteredIds.filter(id => selectedIds.has(id)).length
  , [filteredIds, selectedIds])

  // --- Statistics Computations ---
  const stats = useMemo(() => {
    const totalCount = logs.length
    const totalNetWeight = logs.reduce((sum, log) => sum + log.netWeight, 0)
    const totalAmount = logs.reduce((sum, log) => sum + log.amount, 0)
    
    // Formatting helper
    const formatWeight = (kg: number) => {
      if (kg >= 1000) {
        const tons = (kg / 1000).toFixed(2)
        return `${kg.toLocaleString()} kg (${tons} MT)`
      }
      return `${kg.toLocaleString()} kg`
    }

    return {
      totalCount,
      totalWeightFormatted: formatWeight(totalNetWeight),
      totalNetWeight,
      totalAmountFormatted: totalAmount.toLocaleString(undefined, { 
        style: 'currency', 
        currency: 'INR', // Indian Rupees fits RST/weighbridge terminology, can easily look generic as well
        maximumFractionDigits: 2 
      })
    }
  }, [logs])

  // --- Excel Export Engine ---
  const handleExportToExcel = (exportSelectedOnly = false) => {
    const logsToExport = exportSelectedOnly 
      ? logs.filter(log => selectedIds.has(log.id))
      : filteredAndSortedLogs

    if (logsToExport.length === 0) {
      triggerToast(exportSelectedOnly ? 'No rows selected for export.' : 'No data available to export.', 'error')
      return
    }

    // Format data into localized table format for business users
    const formattedData = logsToExport.map(log => ({
      'Serial Number': log.serialNumber,
      'Date': log.date,
      'Supplier/Customer Name': log.name,
      'Vehicle Number': log.vehicleNumber,
      'RST Number': log.rstNumber,
      'Gross Weight (kg)': log.grossWeight,
      'Tare Weight (kg)': log.tareWeight,
      'Net Weight (kg)': log.netWeight,
      'Rate per kg (₹)': log.rate,
      'Total Amount (₹)': log.amount
    }))

    // No TOTAL/Summary row added as per customer preference

    const worksheet = XLSX.utils.json_to_sheet(formattedData)

    // Set column widths for clean readability
    const wscols = [
      { wch: 15 }, // Serial Number
      { wch: 12 }, // Date
      { wch: 25 }, // Supplier Name
      { wch: 18 }, // Vehicle Number
      { wch: 15 }, // RST Number
      { wch: 18 }, // Gross Weight
      { wch: 18 }, // Tare Weight
      { wch: 18 }, // Net Weight
      { wch: 15 }, // Rate
      { wch: 18 }  // Total Amount
    ]
    worksheet['!cols'] = wscols

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Weighbridge Report')

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = exportSelectedOnly
      ? `Selected_Weighbridge_Logs_${dateStr}.xlsx`
      : `Weighbridge_Report_All_${dateStr}.xlsx`

    XLSX.writeFile(workbook, filename)
    triggerToast(`Exported ${logsToExport.length} records successfully as ${filename}!`, 'success')
  }

  return (
    <>
      {/* Dynamic Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="logo-badge">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18h4.5a3 3 0 013 3v2.25a3 3 0 01-3 3H12m0-8.25H7.5a3 3 0 00-3 3v2.25a3 3 0 003 3H12m0 0v-6.75m0 6.75H7.5a3 3 0 00-3 3v2.25a3 3 0 003 3H12m0 0h4.5a3 3 0 003-3V14.25a3 3 0 00-3-3H12" />
            </svg>
          </div>
          <div className="brand-titles">
            <h1>HUSK LOGISTICS</h1>
            <p>Weighbridge Cargo Registry & Weight Logger</p>
          </div>
        </div>
        
        <div className="time-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {currentTime.toLocaleDateString()} | {currentTime.toLocaleTimeString()}
        </div>
      </header>

      {/* Stats Board */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Total Logs Recorded</span>
            <span className="stat-value">{stats.totalCount}</span>
            <span className="stat-subtext">Active entries stored locally</span>
          </div>
          <div className="stat-icon primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Net Weight Processed</span>
            <span className="stat-value">{stats.totalWeightFormatted}</span>
            <span className="stat-subtext">Combined net weight of cargo</span>
          </div>
          <div className="stat-icon success">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Total Cargo Value</span>
            <span className="stat-value" style={{ color: 'var(--warning)' }}>{stats.totalAmountFormatted}</span>
            <span className="stat-subtext">Aggregated rates x weights</span>
          </div>
          <div className="stat-icon warning">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <section className="dashboard-body">
        {/* Logger Entry Form */}
        <div className="panel-card">
          <h2 className="panel-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {editingId ? 'Edit Entry Details' : 'Record Cargo Weight'}
          </h2>

          <form onSubmit={handleSaveLog} className="log-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="serialNumber">
                  Serial No.
                </label>
                <input
                  type="number"
                  id="serialNumber"
                  name="serialNumber"
                  value={form.serialNumber}
                  onChange={handleInputChange}
                  placeholder="e.g. 1"
                  className="form-input"
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="date">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={form.date}
                  onChange={handleInputChange}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div className="form-group full-width">
              <label className="form-label" htmlFor="name">
                Supplier / Customer Name
                <span className="hint">Autocompletes matches</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={form.name}
                onChange={handleInputChange}
                placeholder="Enter name"
                className="form-input"
                list="name-suggestions"
                required
              />
              <datalist id="name-suggestions">
                {uniqueNames.map(name => <option key={name} value={name} />)}
              </datalist>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="vehicleNumber">
                  Vehicle Plate
                </label>
                <input
                  type="text"
                  id="vehicleNumber"
                  name="vehicleNumber"
                  value={form.vehicleNumber}
                  onChange={handleInputChange}
                  placeholder="MH-12-AB-3456"
                  className="form-input"
                  list="vehicle-suggestions"
                  required
                />
                <datalist id="vehicle-suggestions">
                  {uniqueVehicles.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="rstNumber">
                  RST / Slip No.
                </label>
                <input
                  type="text"
                  id="rstNumber"
                  name="rstNumber"
                  value={form.rstNumber}
                  onChange={handleInputChange}
                  placeholder="RST-00921"
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="grossWeight">
                  Gross Weight <span className="hint">(kg)</span>
                </label>
                <input
                  type="number"
                  id="grossWeight"
                  name="grossWeight"
                  value={form.grossWeight}
                  onChange={handleInputChange}
                  placeholder="e.g. 15400"
                  className="form-input"
                  min="0"
                  step="any"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="tareWeight">
                  Tare Weight <span className="hint">(kg)</span>
                </label>
                <input
                  type="number"
                  id="tareWeight"
                  name="tareWeight"
                  value={form.tareWeight}
                  onChange={handleInputChange}
                  placeholder="e.g. 5200"
                  className="form-input"
                  min="0"
                  step="any"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="netWeight">
                  Net Weight <span className="hint">(kg)</span>
                </label>
                <input
                  type="number"
                  id="netWeight"
                  name="netWeight"
                  value={form.netWeight}
                  onChange={handleInputChange}
                  placeholder="e.g. 10200"
                  className="form-input"
                  min="0"
                  step="any"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="rate">
                  Rate <span className="hint">(per kg)</span>
                </label>
                <input
                  type="number"
                  id="rate"
                  name="rate"
                  value={form.rate}
                  onChange={handleInputChange}
                  placeholder="e.g. 4.50"
                  className="form-input"
                  min="0"
                  step="any"
                  required
                />
              </div>
            </div>

            <div className="form-group full-width">
              <label className="form-label" htmlFor="amount">
                Total Valuation Amount <span className="hint">(Auto, Net x Rate)</span>
              </label>
              <input
                type="text"
                id="amount"
                name="amount"
                value={`₹ ${parseFloat(form.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                disabled
                className="form-input calculated-amount"
              />
            </div>

            <div className="form-actions">
              {editingId ? (
                <>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                  <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>Cancel</button>
                </>
              ) : (
                <button type="submit" className="btn btn-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ marginRight: '0.2rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  Log Entry
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Data Records List */}
        <div className="panel-card" style={{ overflow: 'hidden' }}>
          {/* Toolbar & Filters */}
          <div className="toolbar-header">
            <div className="search-filter-group">
              <div className="search-wrapper">
                <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by Name, Vehicle, RST, or Sl. No..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="form-input search-input"
                />
              </div>

              <div className="date-filter-group">
                <input
                  type="date"
                  title="Start Date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="date-filter-input"
                />
                <span>to</span>
                <input
                  type="date"
                  title="End Date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="date-filter-input"
                />
                {(startDate || endDate) && (
                  <button 
                    type="button" 
                    title="Clear date filter"
                    onClick={() => { setStartDate(''); setEndDate('') }}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.95rem', padding: '0 4px' }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Export and Delete Selection Actions */}
            <div className="action-buttons-group">
              {selectedFilteredCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleExportToExcel(true)}
                  className="btn btn-success"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Selected ({selectedFilteredCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => handleExportToExcel(false)}
                className="btn btn-primary"
                disabled={filteredAndSortedLogs.length === 0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export All Excel
              </button>
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="btn btn-danger"
                  title="Clear all stored logs"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Records Table */}
          <div className="table-container">
            {filteredAndSortedLogs.length === 0 ? (
              <div className="empty-state">
                <svg className="empty-state-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3>No Logs Found</h3>
                <p>
                  {logs.length === 0
                    ? 'Begin by filling out the left form to record your first cargo weighbridge details.'
                    : 'No records match your active search filters or date range.'}
                </p>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th className="col-checkbox">
                      <input
                        type="checkbox"
                        checked={filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id))}
                        onChange={() => handleSelectAll(filteredIds)}
                      />
                    </th>
                    <th className="sortable" onClick={() => handleSort('serialNumber')}>
                      Sl. No.
                      {sortConfig.key === 'serialNumber' && (
                        <span className="sort-indicator">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th className="sortable" onClick={() => handleSort('date')}>
                      Date
                      {sortConfig.key === 'date' && (
                        <span className="sort-indicator">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th className="sortable" onClick={() => handleSort('name')}>
                      Supplier/Customer
                      {sortConfig.key === 'name' && (
                        <span className="sort-indicator">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th className="sortable" onClick={() => handleSort('vehicleNumber')}>
                      Vehicle No.
                      {sortConfig.key === 'vehicleNumber' && (
                        <span className="sort-indicator">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th className="sortable" onClick={() => handleSort('rstNumber')}>
                      RST No.
                      {sortConfig.key === 'rstNumber' && (
                        <span className="sort-indicator">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th className="sortable" onClick={() => handleSort('grossWeight')}>
                      Gross
                      {sortConfig.key === 'grossWeight' && (
                        <span className="sort-indicator">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th className="sortable" onClick={() => handleSort('tareWeight')}>
                      Tare
                      {sortConfig.key === 'tareWeight' && (
                        <span className="sort-indicator">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th className="sortable" onClick={() => handleSort('netWeight')}>
                      Net Weight
                      {sortConfig.key === 'netWeight' && (
                        <span className="sort-indicator">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th className="sortable" onClick={() => handleSort('rate')}>
                      Rate
                      {sortConfig.key === 'rate' && (
                        <span className="sort-indicator">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th className="sortable" onClick={() => handleSort('amount')}>
                      Amount
                      {sortConfig.key === 'amount' && (
                        <span className="sort-indicator">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedLogs.map(log => {
                    const isSelected = selectedIds.has(log.id)
                    return (
                      <tr 
                        key={log.id} 
                        className={isSelected ? 'selected-row' : ''}
                      >
                        <td className="col-checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectRow(log.id)}
                          />
                        </td>
                        <td>{log.serialNumber}</td>
                        <td>{log.date}</td>
                        <td>
                          <span className="highlight-name">{log.name}</span>
                        </td>
                        <td>
                          <span className="vehicle-plate">{log.vehicleNumber}</span>
                        </td>
                        <td>
                          <span className="rst-badge">{log.rstNumber}</span>
                        </td>
                        <td className="weight-badge gross">{log.grossWeight.toLocaleString()} kg</td>
                        <td className="weight-badge tare">{log.tareWeight.toLocaleString()} kg</td>
                        <td>
                          <span className="weight-badge net">{log.netWeight.toLocaleString()} kg</span>
                        </td>
                        <td>₹ {log.rate.toFixed(2)}</td>
                        <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                          ₹ {log.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="col-actions">
                          <div className="actions-cell">
                            <button
                              type="button"
                              onClick={() => handleEditClick(log)}
                              className="btn btn-secondary btn-icon-only"
                              title="Edit record"
                              style={{ padding: '0.35rem' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(log.id, log.serialNumber)}
                              className="btn btn-danger btn-icon-only"
                              title="Delete record"
                              style={{ padding: '0.35rem' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {/* Bottom summary footer */}
            {filteredAndSortedLogs.length > 0 && (
              <div className="table-footer-info">
                <span>
                  Showing {filteredAndSortedLogs.length} of {logs.length} logs
                </span>
                {selectedFilteredCount > 0 && (
                  <span>
                    Selected: {selectedFilteredCount} rows
                  </span>
                )}
                <span>
                  Filtered Net Weight:{' '}
                  {(() => {
                    const totalFilteredNet = filteredAndSortedLogs.reduce((sum, log) => sum + log.netWeight, 0)
                    if (totalFilteredNet >= 1000) {
                      return `${totalFilteredNet.toLocaleString()} kg (${(totalFilteredNet / 1000).toFixed(2)} MT)`
                    }
                    return `${totalFilteredNet.toLocaleString()} kg`
                  })()}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Floating Notifications UI */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <div className="toast-message">{toast.message}</div>
            <button 
              type="button" 
              className="toast-close" 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
