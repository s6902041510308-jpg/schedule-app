'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      if (errorMessage.includes('invalid-credential') || errorMessage.includes('wrong-password')) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      } else if (errorMessage.includes('user-not-found')) {
        setError('ไม่พบบัญชีที่ใช้อีเมลนี้')
      } else if (errorMessage.includes('invalid-email')) {
        setError('รูปแบบอีเมลไม่ถูกต้อง')
      } else if (errorMessage.includes('too-many-requests')) {
        setError('ลองหลายครั้งเกินไป กรุณารอสักครู่')
      } else {
        setError(`เกิดข้อผิดพลาด: ${errorMessage}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">เข้าสู่ระบบ</h1>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
            {error}
          </div>
        )}

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

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              รหัสผ่าน
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-700 mt-4">
          <Link href="/forgot-password" className="text-blue-600 hover:underline font-medium">
            ลืมรหัสผ่าน?
          </Link>
        </p>

        <p className="text-center text-sm text-gray-700 mt-2">
          ยังไม่มีบัญชี?{' '}
          <Link href="/register" className="text-blue-600 hover:underline font-medium">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </div>
  )
}
