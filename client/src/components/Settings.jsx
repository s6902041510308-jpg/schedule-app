import { useState, useEffect } from 'react'

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']

function Settings({ token }) {
  const [classes, setClasses] = useState([])
  const [editingClass, setEditingClass] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setClasses(data)
    } catch (err) {
      console.error('Failed to fetch classes:', err)
    }
  }

  useEffect(() => {
    fetchClasses()
  }, [token])

  const handleDelete = async (classId) => {
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        fetchClasses()
        setShowDeleteConfirm(null)
      }
    } catch (err) {
      console.error('Failed to delete class:', err)
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/classes/${editingClass.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: editingClass.subject,
          teacher: editingClass.teacher,
          room: editingClass.room,
          start_time: editingClass.start_time,
          end_time: editingClass.end_time,
          days: editingClass.days
        })
      })
      if (res.ok) {
        fetchClasses()
        setEditingClass(null)
      }
    } catch (err) {
      console.error('Failed to update class:', err)
    }
  }

  const regularClasses = classes.filter(c => !c.is_temporary)
  const temporaryClasses = classes.filter(c => c.is_temporary)

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ตั้งค่าคลาส</h1>

      {/* Regular Classes */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">คลาสปกติ (เกิดซ้ำทุกสัปดาห์)</h2>
        {regularClasses.length === 0 ? (
          <p className="text-gray-500">ยังไม่มีคลาสปกติ</p>
        ) : (
          <div className="space-y-3">
            {regularClasses.map(cls => (
              <div key={cls.id} className="bg-white rounded-lg border p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{cls.subject}</div>
                  <div className="text-sm text-gray-500">
                    {cls.teacher} • {cls.room} • {cls.start_time}–{cls.end_time}
                  </div>
                  <div className="text-xs text-gray-400">
                    {JSON.parse(cls.days).map(d => DAYS[d]).join(', ')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingClass(cls)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(cls)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Temporary Classes */}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">คลาสชั่วคราว</h2>
        {temporaryClasses.length === 0 ? (
          <p className="text-gray-500">ยังไม่มีคลาสชั่วคราว</p>
        ) : (
          <div className="space-y-3">
            {temporaryClasses.map(cls => (
              <div key={cls.id} className="bg-white rounded-lg border p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{cls.subject}</div>
                  <div className="text-sm text-gray-500">
                    {cls.teacher} • {cls.room} • {cls.start_time}–{cls.end_time}
                  </div>
                  <div className="text-xs text-gray-400">
                    สัปดาห์ที่ {cls.temporary_week} • {JSON.parse(cls.days).map(d => DAYS[d]).join(', ')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingClass(cls)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(cls)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingClass && (
        <EditClassModal
          classItem={editingClass}
          onClose={() => setEditingClass(null)}
          onSave={() => {
            fetchClasses()
            setEditingClass(null)
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">ยืนยันการลบ</h2>
            <p className="text-gray-600 mb-6">
              ต้องการลบคลาส "{showDeleteConfirm.subject}" ใช่ไหม? ไม่สามารถกู้คืนได้
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(showDeleteConfirm.id)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
              >
                ลบ
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditClassModal({ classItem, onClose, onSave }) {
  const [form, setForm] = useState({
    subject: classItem.subject,
    teacher: classItem.teacher,
    room: classItem.room,
    start_time: classItem.start_time,
    end_time: classItem.end_time,
    days: JSON.parse(classItem.days)
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/classes/${classItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        onSave()
      }
    } catch (err) {
      console.error('Failed to update class:', err)
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
        <h2 className="text-xl font-bold mb-4">แก้ไขคลาส</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              บันทึก
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

export default Settings
