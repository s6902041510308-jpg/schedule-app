import { Link, useLocation } from 'react-router-dom'

function Navbar({ onLogout }) {
  const location = useLocation()

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-xl font-bold text-blue-600">📅 Schedule App</Link>
          <div className="flex gap-4">
            <Link
              to="/"
              className={`text-sm font-medium ${
                location.pathname === '/' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ปฏิทิน
            </Link>
            <Link
              to="/settings"
              className={`text-sm font-medium ${
                location.pathname === '/settings' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ตั้งค่า
            </Link>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="text-sm text-gray-500 hover:text-red-600 transition"
        >
          ออกจากระบบ
        </button>
      </div>
    </nav>
  )
}

export default Navbar
