'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getActivities, addActivity, updateActivity, deleteActivity, getSubjects } from '@/lib/firestore'
import type { Activity, Subject } from '@/types'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/lib/auth-context'

export default function ActivitiesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    date: '',
    startTime: '',
    endTime: '',
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      loadActivities()
    }
  }, [user])

  const loadActivities = async (forceRefresh = false) => {
    if (!user) return
    setLoading(true)
    const data = await getActivities(user.uid, forceRefresh)
    setActivities(data)
    setLoading(false)
  }

  const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  const checkConflict = async (date: string, startTime: string, endTime: string, excludeActivityId?: string): Promise<string | null> => {
    if (!user) return null

    const [subjects, activities] = await Promise.all([
      getSubjects(user.uid),
      getActivities(user.uid),
    ])

    const dateObj = new Date(date)
    const dayOfWeek = dateObj.getDay()
    const dateStr = date

    const newStart = timeToMinutes(startTime)
    const newEnd = timeToMinutes(endTime)

    // Check subjects
    const subjectsOnDay = subjects.filter((s) => {
      if (s.type === 'main' && s.dayOfWeek === dayOfWeek) return true
      if (s.type === 'elective' && s.specificDate === dateStr) return true
      return false
    })

    for (const s of subjectsOnDay) {
      const sStart = timeToMinutes(s.startTime)
      const sEnd = timeToMinutes(s.endTime)
      if (newStart < sEnd && sStart < newEnd) {
        return `ชนกับวิชา "${s.name}" (${s.startTime}-${s.endTime})`
      }
    }

    // Check activities
    const activitiesOnDay = activities.filter((a) => {
      if (excludeActivityId && a.id === excludeActivityId) return false
      return a.date === dateStr
    })
    for (const a of activitiesOnDay) {
      const aStart = timeToMinutes(a.startTime)
      const aEnd = timeToMinutes(a.endTime)
      if (newStart < aEnd && aStart < newEnd) {
        return `ชนกับกิจกรรม "${a.name}" (${a.startTime}-${a.endTime})`
      }
    }

    return null
  }

  const resetForm = () => {
    setForm({ name: '', date: '', startTime: '', endTime: '' })
    setEditingActivity(null)
    setShowForm(false)
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setError('')
    setSuccess('')

    if (!form.name.trim()) {
      setError('กรุณากรอกชื่อกิจกรรม')
      return
    }
    if (!form.date) {
      setError('กรุณาเลือกวันที่')
      return
    }
    if (!form.startTime || !form.endTime) {
      setError('กรุณาเลือกเวลา')
      return
    }

    const conflictResult = await checkConflict(form.date, form.startTime, form.endTime, editingActivity?.id)
    if (conflictResult) {
      setError(`คำเตือน: ${conflictResult}`)
      return
    }

    setSaving(true)
    try {
      if (editingActivity) {
        await updateActivity(user.uid, editingActivity.id, {
          name: form.name,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
        })
        setSuccess('แก้ไขกิจกรรมสำเร็จ!')
      } else {
        await addActivity(user.uid, {
          name: form.name,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
        })
        setSuccess('เพิ่มกิจกรรมสำเร็จ!')
      }

      resetForm()
      loadActivities(true)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setError(`เกิดข้อผิดพลาด: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (activity: Activity) => {
    setForm({
      name: activity.name,
      date: activity.date,
      startTime: activity.startTime,
      endTime: activity.endTime,
    })
    setEditingActivity(activity)
    setShowForm(true)
  }

  const handleDelete = async (activityId: string) => {
    if (!user) return
    if (confirm('ต้องการลบกิจกรรมนี้?')) {
      await deleteActivity(user.uid, activityId)
      loadActivities(true)
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
          <h1 className="text-2xl font-bold text-gray-900">จัดการกิจกรรม</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            + เพิ่มกิจกรรม
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
              {editingActivity ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรมใหม่'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">ชื่อกิจกรรม *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                  placeholder="เช่น ปั่นจักรยาน, เล่นดนตรี"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">วันที่ *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                />
              </div>
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
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'กำลังบันทึก...' : (editingActivity ? 'บันทึกการแก้ไข' : 'เพิ่มกิจกรรม')}
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
          {activities.length === 0 ? (
            <p className="p-6 text-gray-700 text-center">ยังไม่มีกิจกรรม คลิก "เพิ่มกิจกรรม" เพื่อเริ่มต้น</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">กิจกรรม</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">วันที่</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">เวลา</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {activities.map((activity) => (
                  <tr key={activity.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{activity.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{activity.date}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{activity.startTime} - {activity.endTime}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(activity)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => handleDelete(activity.id)}
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
