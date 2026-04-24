import Sidebar from './Sidebar'
import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="flex min-h-screen" style={{ background: '#f0f4f8' }}>
      <Sidebar />
      <main className="flex-1 min-h-screen" style={{ marginLeft: 228 }}>
        <Outlet />
      </main>
    </div>
  )
}
