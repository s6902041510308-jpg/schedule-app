'use client'

import { useState } from 'react'
import { addException, getSubjects, getActivities } from '@/lib/firestore'
import type { Subject, Activity } from '@/types'
import { useAuth } from '@/lib/auth-context'

interface MoveSubjectModalProps {
  subject: Subject
  originalDate: string
  onClose: () => void
  onSuccess: () => void
}

export default function MoveSubjectModal({
  subject,
  originalDate,
  onClose,
  onSuccess,
}: MoveSubjectModalProps) {
  const { user } = useAuth()
  const [newDate, setNewDate] = useState('')
  const [newStartTime, setNewStartTime] = useState(subject.startTime)
  const [newEndTime, setNewEndTime] = useState(subject.endTime)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState<string | null>(null)

  const checkConflict = async (date: string, startTime: string, endTime: string): Promise<string | null> => {
    if (!user) return null

    const [subjects, activities] = await Promise.all([
      getSubjects(user.uid),
      getActivities(user.uid),
    ])

    const dateObj = new Date(date)
    const dayOfWeek = dateObj.getDay()
    const dateStr = date

    // Check subjects
    const subjectsOnDay = subjects.filter((s) => {
      if (s.type === 'main' && s.dayOfWeek === dayOfWeek) return true
      if (s.type === 'elective' && s.specificDate === dateStr) return true
      return false
    })

    for (const s of subjectsOnDay) {
      if (s.id === subject.id) continue
      if (startTime < s.endTime && endTime > s.startTime) {
        return `ชนกับวิชา "${s.name}" (${s.startTime}-${s.endTime})`
      }
    }

    // Check activities
    const activitiesOnDay = activities.filter((a) => a.date === dateStr)
    for (const a of activitiesOnDay) {
      if (startTime < a.endTime && endTime > a.startTime) {
        return `ชนกับกิจกรรม "${a.name}" (${a.startTime}-${a.endTime})`
      }
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError('')
    setConflict(null)

    // Check for conflicts
    const conflictResult = await checkConflict(newDate, newStartTime, newEndTime)
    if (conflictResult) {
      setConflict(conflictResult)
      setLoading(false)
      return
    }

    try {
      await addException(user.uid, {
        subjectId: subject.id,
        originalDate,
        type: 'move',
        newDate,
        newStartTime,
        newEndTime,
      })
      onSuccess()
      onClose()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">โยกย้ายวิชา</h2>
        <p className="text-sm text-gray-700 mb-4">
          วิชา: <span className="font-medium">{subject.name}</span>
          <br />
          วันเดิม: <span className="font-medium">{originalDate}</span>
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
            {error}
          </div>
        )}

        {conflict && (
          <div className="bg-yellow-50 text-yellow-700 p-3 rounded-md mb-4 text-sm border border-yellow-200">
            <p className="font-medium">คำเตือน: ชนกับวิชาอื่น</p>
            <p>{conflict}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              วันใหม่
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                เวลาเริ่ม
              </label>
              <input
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                เวลาเลิก
              </label>
              <input
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                required
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'กำลังบันทึก...' : 'โยกย้าย'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
