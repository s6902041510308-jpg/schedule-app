import { useState, useEffect, useCallback } from 'react'

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

function formatDate(date) {
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function WeeklyCalendar({ token }) {
  const [classes, setClasses] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [conflicts, setConflicts] = useState([])

  const weekNumber = getWeekNumber(currentDate)
  const weekStart = new Date(currentDate)
  weekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1)

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/classes', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setClasses(data)
    } catch (err) {
      console.error('Failed to fetch classes:', err)
    }
  }, [token])

  useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  // Detect conflicts
  useEffect(() => {
    const allClasses = classes.filter(c => {
      if (c.is_temporary) return c.temporary_week === weekNumber
      const cancelled = JSON.parse(c.cancelled_weeks || '[]')
      return !cancelled.includes(weekNumber)
    })

    const conflictList = []
    for (let i = 0; i < allClasses.length; i++) {
      for (let j = i + 1; j < allClasses.length; j++) {
        const a = allClasses[i]
        const b = allClasses[j]
        const aDays = JSON.parse(a.days)
        const bDays = JSON.parse(b.days)
        const commonDays = aDays.filter(d => bDays.includes(d))
        if (commonDays.length > 0) {
          const aStart = parseInt(a.start_time.split(':')[0]) * 60 + parseInt(a.start_time.split(':')[1])
          const aEnd = parseInt(a.end_time.split(':')[0]) * 60 + parseInt(a.end_time.split(':')[1])
          const bStart = parseInt(b.start_time.split(':')[0]) * 60 + parseInt(b.start_time.split(':')[1])
          const bEnd = parseInt(b.end_time.split(':')[0]) * 60 + parseInt(b.end_time.split(':')[1])
          if (aStart < bEnd && bStart < aEnd) {
            conflictList.push({ a, b, days: commonDays })
          }
        }
      }
    }
    setConflicts(conflictList)
  }, [classes, weekNumber])

  const getClassesForDayAndHour = (dayIndex, hour) => {
    return classes.filter(c => {
      const days = JSON.parse(c.days)
      if (!days.includes(dayIndex)) return false

      if (c.is_temporary) {
        return c.temporary_week === weekNumber
      }

      const cancelled = JSON.parse(c.cancelled_weeks || '[]')
      if (cancelled.includes(weekNumber)) return false

      const startHour = parseInt(c.start_time.split(':')[0])
      const endHour = parseInt(c.end_time.split(':')[0])
      return hour >= startHour && hour < endHour
    })
  }

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + direction * 7)
    setCurrentDate(newDate)
  }

  const handleCancelClass = async (classItem) => {
    try {
      const res = await fetch(`/api/classes/${classItem.id}/cancel-week`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ week: weekNumber })
      })
      if (res.ok) {
        fetchClasses()
        setShowCancelModal(false)
        setSelectedClass(null)
      }
    } catch (err) {
      console.error('Failed to cancel class:', err)
    }
  }

  const handleUncancelClass = async (classItem) => {
    try {
      const res = await fetch(`/api/classes/${classItem.id}/uncancel-week`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ week: weekNumber })
      })
      if (res.ok) {
        fetchClasses()
      }
    } catch (err) {
      console.error('Failed to uncancel class:', err)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ปฏิทินรายสัปดาห์</h1>
          <p className="text-gray-500">
            สัปดาห์ที่ {weekNumber} — {formatDate(weekStart)} ถึง {formatDate(weekEnd)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigateWeek(-1)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← สัปดาห์ก่อน
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            วันนี้
          </button>
          <button
            onClick={() => navigateWeek(1)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            สัปดาห์ถัดไป →
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + เพิ่มคลาส
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            🖨️ พิมพ์ PDF
          </button>
        </div>
      </div>

      {/* Conflict Warning */}
      {conflicts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-yellow-800 mb-2">⚠️ ตารางซ้ำซ้อน {conflicts.length} รายการ</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            {conflicts.map((c, i) => (
              <li key={i}>
                {c.a.subject} กับ {c.b.subject} — {c.days.map(d => DAYS[d]).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="grid grid-cols-8 border-b">
          <div className="p-3 bg-gray-50 font-medium text-sm text-gray-500">เวลา</div>
          {DAYS.map((day, i) => (
            <div key={i} className="p-3 bg-gray-50 font-medium text-sm text-center">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-8">
          {HOURS.map(hour => (
            <div key={hour} className="contents">
              <div className="p-2 text-xs text-gray-400 text-right border-r border-b bg-gray-50">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {DAYS.map((_, dayIndex) => {
                const dayClasses = getClassesForDayAndHour(dayIndex, hour)
                return (
                  <div
                    key={dayIndex}
                    className="min-h-[60px] border-r border-b p-1 relative"
                  >
                    {dayClasses.map(cls => (
                      <div
                        key={cls.id}
                        className={`text-xs p-1 rounded mb-1 cursor-pointer ${
                          cls.is_temporary
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                        onClick={() => {
                          setSelectedClass(cls)
                          setShowCancelModal(true)
                        }}
                      >
                        <div className="font-medium truncate">{cls.subject}</div>
                        <div className="truncate">{cls.teacher}</div>
                        <div className="truncate">{cls.room}</div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Add Class Modal */}
      {showAddModal && (
        <AddClassModal
          token={token}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            fetchClasses()
            setShowAddModal(false)
          }}
        />
      )}

      {/* Cancel/Uncancel Modal */}
      {showCancelModal && selectedClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {selectedClass.is_temporary ? 'คลาสชั่วคราว' : 'คลาสปกติ'} — {selectedClass.subject}
            </h2>
            <p className="text-gray-600 mb-4">
              สัปดาห์ที่ {weekNumber}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleCancelClass(selectedClass)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
              >
                ยกเลิกคลาสสัปดาห์นี้
              </button>
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setSelectedClass(null)
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddClassModal({ token, onClose, onCreated }) {
  const [form, setForm] = useState({
    subject: '',
    teacher: '',
    room: '',
    start_time: '09:00',
    end_time: '10:00',
    days: [],
    is_temporary: false,
    temporary_week: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        onCreated()
      }
    } catch (err) {
      console.error('Failed to create class:', err)
    }
  }

  const toggleDay = (dayIndex) => {
    setForm(prev => ({
      ...prev,
      days: prev.days.includes(dayIndex)
        ? prev.days.filter(d => d !== dayIndex)
        : [...prev.days, dayIndex]
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">เพิ่มคลาส</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทคลาส</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!form.is_temporary}
                  onChange={() => setForm(prev => ({ ...prev, is_temporary: false }))}
                />
                คลาสปกติ (เกิดซ้ำทุกสัปดาห์)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={form.is_temporary}
                  onChange={() => setForm(prev => ({ ...prev, is_temporary: true }))}
                />
                คลาสชั่วคราว (ครั้งเดียว)
              </label>
            </div>
          </div>

          {form.is_temporary && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">สัปดาห์ที่</label>
              <input
                type="number"
                value={form.temporary_week}
                onChange={(e) => setForm(prev => ({ ...prev, temporary_week: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="เช่น 5"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อวิชา</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่ออาจารย์</label>
            <input
              type="text"
              value={form.teacher}
              onChange={(e) => setForm(prev => ({ ...prev, teacher: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ห้องเรียน</label>
            <input
              type="text"
              value={form.room}
              onChange={(e) => setForm(prev => ({ ...prev, room: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เวลาเริ่ม</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm(prev => ({ ...prev, start_time: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เวลาสิ้นสุด</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm(prev => ({ ...prev, end_time: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">วันเรียน</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    form.days.includes(i)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              สร้างคลาส
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default WeeklyCalendar
