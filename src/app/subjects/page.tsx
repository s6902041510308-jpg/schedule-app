'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSubjects, addSubject, updateSubject, deleteSubject, getActivities, getTerms } from '@/lib/firestore'
import type { Subject, Activity } from '@/types'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/lib/auth-context'

const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

export default function SubjectsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [terms, setTerms] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    code: '',
    type: 'main' as 'main' | 'elective',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '09:00',
    room: '',
    teacher: '',
    color: COLORS[0],
    specificDate: '',
    termId: '',
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      loadSubjects()
      loadTerms()
    }
  }, [user])

  const loadTerms = async () => {
    if (!user) return
    const data = await getTerms(user.uid)
    setTerms(data)
  }

  const loadSubjects = async (forceRefresh = false) => {
    if (!user) return
    setLoading(true)
    const data = await getSubjects(user.uid, forceRefresh)
    setSubjects(data)
    setLoading(false)
  }

  const resetForm = () => {
    setForm({
      name: '',
      code: '',
      type: 'main',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:00',
      room: '',
      teacher: '',
      color: COLORS[0],
      specificDate: '',
      termId: '',
    })
    setEditingSubject(null)
    setShowForm(false)
    setError('')
    setSuccess('')
  }

  const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const checkConflict = async (date: string, startTime: string, endTime: string, excludeSubjectId?: string): Promise<string | null> => {
    if (!user) return null

    const [subjects, activities, terms] = await Promise.all([
      getSubjects(user.uid),
      getActivities(user.uid),
      getTerms(user.uid),
    ])

    const dateObj = new Date(date)
    const dayOfWeek = dateObj.getDay()
    const dateStr = date

    const newStart = timeToMinutes(startTime)
    const newEnd = timeToMinutes(endTime)

    // Check subjects
    const subjectsOnDay = subjects.filter((s) => {
      if (excludeSubjectId && s.id === excludeSubjectId) return false
      if (s.type === 'main' && s.dayOfWeek === dayOfWeek) return true
      if (s.type === 'elective' && s.specificDate === dateStr) return true
      return false
    })

    for (const s of subjectsOnDay) {
      // Skip conflict check if subjects are in different terms
      if (form.termId && s.termId && form.termId !== s.termId) {
        const newTerm = terms.find((t) => t.id === form.termId)
        const existingTerm = terms.find((t) => t.id === s.termId)
        if (newTerm && existingTerm) {
          // Check if terms overlap
          const termsOverlap = newTerm.startDate <= existingTerm.endDate && existingTerm.startDate <= newTerm.endDate
          if (!termsOverlap) continue
        }
      }

      const sStart = timeToMinutes(s.startTime)
      const sEnd = timeToMinutes(s.endTime)
      // Overlap: start1 < end2 AND start2 < end1
      if (newStart < sEnd && sStart < newEnd) {
        return `ชนกับวิชา "${s.name}" (${s.startTime}-${s.endTime})`
      }
    }

    // Check activities
    const activitiesOnDay = activities.filter((a) => a.date === dateStr)
    for (const a of activitiesOnDay) {
      const aStart = timeToMinutes(a.startTime)
      const aEnd = timeToMinutes(a.endTime)
      if (newStart < aEnd && aStart < newEnd) {
        return `ชนกับกิจกรรม "${a.name}" (${a.startTime}-${a.endTime})`
      }
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('handleSubmit called', { user, form, editingSubject })
    if (!user) {
      console.log('No user')
      return
    }

    setError('')
    setSuccess('')

    // Validate required fields
    if (!form.name.trim()) {
      setError('กรุณากรอกชื่อวิชา')
      return
    }
    if (!form.code.trim()) {
      setError('กรุณากรอกรหัสวิชา')
      return
    }
    if (!form.startTime || !form.endTime) {
      setError('กรุณาเลือกเวลาเรียน')
      return
    }
    if (form.type === 'elective' && !form.specificDate) {
      setError('กรุณาเลือกวันที่เรียนสำหรับวิชาเสริม')
      return
    }

    // Check for conflicts
    // For main subjects, calculate the actual date based on day of week
    let conflictDate = form.specificDate
    if (form.type === 'main') {
      const today = new Date()
      const currentDayOfWeek = today.getDay()
      const targetDayOfWeek = form.dayOfWeek
      const diff = targetDayOfWeek - currentDayOfWeek
      const targetDate = new Date(today)
      targetDate.setDate(today.getDate() + diff)
      conflictDate = targetDate.toISOString().split('T')[0]
    }
    const conflictResult = await checkConflict(conflictDate, form.startTime, form.endTime, editingSubject?.id)
    if (conflictResult) {
      setError(`คำเตือน: ${conflictResult}`)
      return
    }

    setSaving(true)
    try {
      console.log('Saving to Firebase...')
      if (editingSubject) {
        await updateSubject(user.uid, editingSubject.id, {
          name: form.name,
          code: form.code,
          type: form.type,
          dayOfWeek: form.type === 'main' ? form.dayOfWeek : null,
          startTime: form.startTime,
          endTime: form.endTime,
          room: form.room,
          teacher: form.teacher,
          color: form.color,
          specificDate: form.type === 'elective' ? form.specificDate : null,
          termId: form.type === 'main' ? form.termId || null : null,
        })
        setSuccess('แก้ไขวิชาสำเร็จ!')
      } else {
        await addSubject(user.uid, {
          name: form.name,
          code: form.code,
          type: form.type,
          dayOfWeek: form.type === 'main' ? form.dayOfWeek : null,
          startTime: form.startTime,
          endTime: form.endTime,
          room: form.room,
          teacher: form.teacher,
          color: form.color,
          specificDate: form.type === 'elective' ? form.specificDate : null,
          termId: form.type === 'main' ? form.termId || null : null,
        })
        setSuccess('เพิ่มวิชาสำเร็จ!')
      }

      console.log('Save successful!')
      resetForm()
      loadSubjects(true)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      console.error('Save error:', errorMessage)
      setError(`เกิดข้อผิดพลาด: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (subject: Subject) => {
    setForm({
      name: subject.name,
      code: subject.code,
      type: subject.type,
      dayOfWeek: subject.dayOfWeek || 1,
      startTime: subject.startTime,
      endTime: subject.endTime,
      room: subject.room,
      teacher: subject.teacher,
      color: subject.color,
      specificDate: subject.specificDate || '',
      termId: subject.termId || '',
    })
    setEditingSubject(subject)
    setShowForm(true)
  }

  const handleDelete = async (subjectId: string) => {
    if (!user) return
    if (confirm('ต้องการลบวิชานี้ทั้งหมดตลอดเทอม?')) {
      await deleteSubject(user.uid, subjectId)
      loadSubjects(true)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">จัดการวิชา</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            + เพิ่มวิชา
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-700 p-3 rounded-md mb-4 text-sm border border-green-200">
            {success}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">
              {editingSubject ? 'แก้ไขวิชา' : 'เพิ่มวิชาใหม่'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">ประเภทวิชา</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'main' | 'elective' })}
                    className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                  >
                    <option value="main">วิชาหลัก (ประจำทุกอาทิตย์)</option>
                    <option value="elective">วิชาเสริม (กำหนดวันเอง)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">ชื่อวิชา *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                    placeholder="เช่น คณิตศาสตร์"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">รหัสวิชา *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                    placeholder="เช่น MATH101"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">สีประจำวิชา</label>
                  <div className="flex gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setForm({ ...form, color })}
                        className={`w-8 h-8 rounded-full border-2 ${form.color === color ? 'border-gray-800' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {form.type === 'main' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">วันเรียน</label>
                    <select
                      value={form.dayOfWeek}
                      onChange={(e) => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                    >
                      {DAYS.map((day, index) => (
                        <option key={index} value={index}>{day}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">เทอม</label>
                    <select
                      value={form.termId}
                      onChange={(e) => setForm({ ...form, termId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                    >
                      <option value="">ไม่มีเทอม (เรียนต่อเนื่อง)</option>
                      {terms.map((term) => (
                        <option key={term.id} value={term.id}>{term.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">วันที่เรียน *</label>
                  <input
                    type="date"
                    value={form.specificDate}
                    onChange={(e) => setForm({ ...form, specificDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">เวลาเริ่ม *</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">เวลาเลิก *</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">ห้องเรียน</label>
                  <input
                    type="text"
                    value={form.room}
                    onChange={(e) => setForm({ ...form, room: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                    placeholder="เช่น ม.2/1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">ครูผู้สอน</label>
                  <input
                    type="text"
                    value={form.teacher}
                    onChange={(e) => setForm({ ...form, teacher: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                    placeholder="เช่น ครูสมชาย"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'กำลังบันทึก...' : (editingSubject ? 'บันทึกการแก้ไข' : 'เพิ่มวิชา')}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {subjects.length === 0 ? (
            <p className="p-6 text-gray-700 text-center">ยังไม่มีวิชา คลิก "เพิ่มวิชา" เพื่อเริ่มต้น</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">วิชา</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ประเภท</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">วัน/เวลา</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ห้อง</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ครู</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {subjects.map((subject) => (
                  <tr key={subject.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: subject.color }}
                        />
                        <div>
                          <p className="font-medium text-gray-900">{subject.name}</p>
                          <p className="text-sm text-gray-600">{subject.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        subject.type === 'main' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {subject.type === 'main' ? 'วิชาหลัก' : 'วิชาเสริม'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {subject.type === 'main'
                        ? `ทุก${DAYS[subject.dayOfWeek || 0]} ${subject.startTime}-${subject.endTime}`
                        : `${subject.specificDate} ${subject.startTime}-${subject.endTime}`}
                      {subject.type === 'main' && subject.termId && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                          {terms.find((t) => t.id === subject.termId)?.name || 'เทอม'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{subject.room || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{subject.teacher || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(subject)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => handleDelete(subject.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
