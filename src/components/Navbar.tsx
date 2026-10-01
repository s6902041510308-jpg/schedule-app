'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut(auth)
    router.push('/login')
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          <div className="flex gap-6">
            <Link
              href="/"
              className={`text-sm font-medium ${pathname === '/' ? 'text-blue-600' : 'text-gray-800 hover:text-gray-900'}`}
            >
              ตารางเรียน
            </Link>
            <Link
              href="/subjects"
              className={`text-sm font-medium ${pathname === '/subjects' ? 'text-blue-600' : 'text-gray-800 hover:text-gray-900'}`}
            >
              จัดการวิชา
            </Link>
            <Link
              href="/activities"
              className={`text-sm font-medium ${pathname === '/activities' ? 'text-blue-600' : 'text-gray-800 hover:text-gray-900'}`}
            >
              จัดการกิจกรรม
            </Link>
            <Link
              href="/terms"
              className={`text-sm font-medium ${pathname === '/terms' ? 'text-blue-600' : 'text-gray-800 hover:text-gray-900'}`}
            >
              จัดการเทอม
            </Link>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-800 hover:text-gray-900 font-medium"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </nav>
  )
}
