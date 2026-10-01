'use client'

import { useState } from 'react'
import { addException } from '@/lib/firestore'
import type { Subject } from '@/types'
import { useAuth } from '@/lib/auth-context'

interface CancelSubjectModalProps {
  subject: Subject
  originalDate: string
  onClose: () => void
  onSuccess: () => void
}

export default function CancelSubjectModal({
  subject,
  originalDate,
  onClose,
  onSuccess,
}: CancelSubjectModalProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError('')

    try {
      await addException(user.uid, {
        subjectId: subject.id,
        originalDate,
        type: 'cancel',
        newDate: null,
        newStartTime: null,
        newEndTime: null,
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
        <h2 className="text-lg font-semibold mb-4 text-gray-900">ยกเลิกวิชา</h2>
        <p className="text-sm text-gray-700 mb-4">
          ต้องการยกเลิกวิชา <span className="font-medium">{subject.name}</span> ในวันที่{' '}
          <span className="font-medium">{originalDate}</span> ใช่ไหม?
          <br />
          <span className="text-gray-600">(วิชาจะหายจากตารางเฉพาะวันนั้น ไม่กระทบวันอื่น)</span>
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'กำลังยกเลิก...' : 'ยกเลิกวิชา'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
          >
            ปิด
          </button>
        </form>
      </div>
    </div>
  )
}
