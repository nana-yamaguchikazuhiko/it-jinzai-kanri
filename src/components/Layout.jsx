import Sidebar from './Sidebar'
import { Outlet } from 'react-router-dom'
import { T } from '../constants/theme'

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 232, display: 'flex', flexDirection: 'column', minHeight: '100vh', overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
