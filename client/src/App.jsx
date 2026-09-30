import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import WeeklyCalendar from './components/WeeklyCalendar'
import Settings from './components/Settings'
import Navbar from './components/Navbar'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
  }, [token])

  if (!token) {
    return <Login onLogin={setToken} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onLogout={() => setToken(null)} />
      <Routes>
        <Route path="/" element={<WeeklyCalendar token={token} />} />
        <Route path="/settings" element={<Settings token={token} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  )
}

export default App
