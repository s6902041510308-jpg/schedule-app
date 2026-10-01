'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getTerms, addTerm, updateTerm, deleteTerm, getSubjects, deleteSubject } from '@/lib/firestore'
import type { Term } from '@/types'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/lib/auth-context'

export default function TermsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTerm, setEditingTerm] = useState<Term | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      loadTerms()
    }
  }, [user])

  const loadTerms = async (forceRefresh = false) => {
    if (!user) return
    setLoading(true)
    const data = await getTerms(user.uid, forceRefresh)
    setTerms(data)
    setLoading(false)
  }

  const resetForm = () => {
    setForm({ name: '', startDate: '', endDate: '' })
    setEditingTerm(null)
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
      setError('กรุณากรอกชื่อเทอม')
      return
    }
    if (!form.startDate || !form.endDate) {
      setError('กรุณาเลือกวันที่เริ่มและวันจบเทอม')
      return
    }

    setSaving(true)
    try {
      if (editingTerm) {
        await updateTerm(user.uid, editingTerm.id, {
          name: form.name,
          startDate: form.startDate,
          endDate: form.endDate,
        })
        setSuccess('แก้ไขเทอมสำเร็จ!')
      } else {
        await addTerm(user.uid, {
          name: form.name,
          startDate: form.startDate,
          endDate: form.endDate,
        })
        setSuccess('เพิ่มเทอมสำเร็จ!')
      }

      resetForm()
      loadTerms(true)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setError(`เกิดข้อผิดพลาด: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (term: Term) => {
    setForm({
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
    })
    setEditingTerm(term)
    setShowForm(true)
  }

  const handleDelete = async (termId: string) => {
    if (!user) return

    // Check if there are subjects in this term
    const subjects = await getSubjects(user.uid)
    const subjectsInTerm = subjects.filter((s) => s.termId === termId)

    let confirmMessage = 'ต้องการลบเทอมนี้?'
    if (subjectsInTerm.length > 0) {
      confirmMessage = `เทอมนี้มีวิชา ${subjectsInTerm.length} วิชา\nหากลบเทอม วิชาทั้งหมดในเทอมนี้จะถูกลบด้วย\n\nต้องการลบเทอมนี้และวิชาทั้งหมดในเทอม?`
    }

    if (confirm(confirmMessage)) {
      // Delete all subjects in this term
      for (const subject of subjectsInTerm) {
        await deleteSubject(user.uid, subject.id)
      }
      // Delete the term
      await deleteTerm(user.uid, termId)
      loadTerms(true)
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
          <h1 className="text-2xl font-bold text-gray-900">จัดการเทอม</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            + เพิ่มเทอม
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
              {editingTerm ? 'แก้ไขเทอม' : 'เพิ่มเทอมใหม่'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">ชื่อเทอม</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                  placeholder="เช่น เทอม 1/2567"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">วันเริ่มเทอม</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-400 rounded-md text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">วันจบเทอม</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
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
                  {saving ? 'กำลังบันทึก...' : (editingTerm ? 'บันทึกการแก้ไข' : 'เพิ่มเทอม')}
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
          {terms.length === 0 ? (
            <p className="p-6 text-gray-700 text-center">ยังไม่มีเทอม คลิก "เพิ่มเทอม" เพื่อเริ่มต้น</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ชื่อเทอม</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">วันเริ่ม</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">วันจบ</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {terms.map((term) => (
                  <tr key={term.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{term.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{term.startDate}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{term.endDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(term)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => handleDelete(term.id)}
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
