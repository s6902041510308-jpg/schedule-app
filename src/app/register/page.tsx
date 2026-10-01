'use client'

import { useState } from 'react'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน')
      return
    }

    if (password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }

    setLoading(true)

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        name: name,
        createdAt: new Date(),
      })

      // Sign out so user needs to login explicitly
      await signOut(auth)

      setSuccess(true)
      setTimeout(() => {
        window.location.href = '/login'
      }, 1500)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      if (errorMessage.includes('email-already-in-use')) {
        setError('อีเมลนี้ถูกใช้งานแล้ว')
      } else if (errorMessage.includes('invalid-email')) {
        setError('รูปแบบอีเมลไม่ถูกต้อง')
      } else if (errorMessage.includes('weak-password')) {
        setError('รหัสผ่านไม่ปลอดภัยพอ')
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">สมัครสมาชิกสำเร็จ!</h1>
          <p className="text-gray-700">กำลังไปหน้าเข้าสู่ระบบ...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">สมัครสมาชิก</h1>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              ชื่อ
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              required
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              ยืนยันรหัสผ่าน
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-700 mt-4">
          มีบัญชีแล้ว?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  )
}
