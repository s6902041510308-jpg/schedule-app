'use client'

import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await sendPasswordResetEmail(auth, email)
      setSuccess(true)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      if (errorMessage.includes('user-not-found')) {
        setError('ไม่พบบัญชีที่ใช้อีเมลนี้')
      } else if (errorMessage.includes('invalid-email')) {
        setError('รูปแบบอีเมลไม่ถูกต้อง')
      } else {
        setError(`เกิดข้อผิดพลาด: ${errorMessage}`)
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-green-600 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว!</h1>
          <p className="text-gray-700 mb-4">
            กรุณาตรวจสอบอีเมล <span className="font-medium">{email}</span> เพื่อรีเซ็ตรหัสผ่าน
          </p>
          <Link
            href="/login"
            className="text-blue-600 hover:underline font-medium"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">รีเซ็ตรหัสผ่าน</h1>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
            {error}
          </div>
        )}

        <p className="text-gray-700 text-sm mb-4">
          กรอกอีเมลที่ใช้สมัครสมาชิก ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              อีเมล
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-700 mt-4">
          จำรหัสผ่านได้แล้ว?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  )
}
